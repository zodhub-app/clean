use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

#[derive(Serialize, Clone)]
pub struct CacheEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub location: String, // "user" for now
}

#[derive(Serialize)]
pub struct CleanResult {
    pub freed: u64,
    pub removed: usize,
    pub errors: Vec<String>,
    /// Elementos abiertos por otro programa que se dejaron intactos. No es un
    /// fallo; se devuelve como número para que el frontend lo traduzca.
    pub skipped_in_use: usize,
    /// Elementos que fallaron por otro motivo. Aparte, para no disfrazarlos.
    pub skipped_failed: usize,
}

fn home_dir() -> Option<PathBuf> {
    let h = crate::platform::home_dir();
    if h.as_os_str().is_empty() {
        None
    } else {
        Some(h)
    }
}

/// Carpeta de cachés del usuario, según el sistema:
///   macOS   → `~/Library/Caches`
///   Windows → `%LOCALAPPDATA%\Temp` (los temporales del usuario)
///   Linux   → `~/.cache` (estándar XDG)
fn user_cache_root() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        home_dir().map(|h| h.join("Library/Caches"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .map(|p| p.join("Temp"))
    }
    #[cfg(target_os = "linux")]
    {
        home_dir().map(|h| h.join(".cache"))
    }
}

/// Raíces de caché que ZodHub Pulse puede tocar. Cualquier ruta fuera de
/// estas se rechaza (guarda de seguridad).
fn allowed_roots() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    // Caché del sistema: solo existe como tal en macOS.
    #[cfg(target_os = "macos")]
    v.push(PathBuf::from("/Library/Caches"));
    if let Some(r) = user_cache_root() {
        v.push(r);
    }
    v
}

/// Solo se tocan rutas ESTRICTAMENTE dentro de las raíces de caché permitidas.
///
/// Se usa `platform::is_inside`, que normaliza antes de comparar: resuelve los
/// `..` (si no, `…/Caches/../../Documents` pasaría el filtro) y en Windows
/// ignora mayúsculas (donde `C:\Users` y `c:\users` son lo mismo).
fn is_allowed(path: &Path) -> bool {
    allowed_roots()
        .iter()
        .any(|root| crate::platform::is_inside(path, root))
}

/// Recursive on-disk size. Never follows symlinks.
fn path_size(path: &Path) -> u64 {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return 0,
    };
    if meta.file_type().is_symlink() {
        return 0;
    }
    if meta.is_file() {
        // Espacio REAL en disco, igual que el resto de la app. Antes este panel
        // usaba el tamaño lógico mientras Almacenamiento usaba bloques: dos
        // pantallas daban números distintos para la MISMA carpeta.
        return crate::platform::size_on_disk(&meta);
    }
    if meta.is_dir() {
        let mut total = 0;
        if let Ok(rd) = fs::read_dir(path) {
            for e in rd.flatten() {
                total += path_size(&e.path());
            }
        }
        return total;
    }
    0
}

#[tauri::command]
pub fn scan_caches() -> Result<Vec<CacheEntry>, String> {
    let root = user_cache_root().ok_or("No se pudo localizar la carpeta de cachés")?;

    // Top-level entries (one per app/bundle id).
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Ok(rd) = fs::read_dir(&root) {
        for e in rd.flatten() {
            paths.push(e.path());
        }
    }

    let idx = AtomicUsize::new(0);
    let results: Mutex<Vec<CacheEntry>> = Mutex::new(Vec::new());
    let workers = std::thread::available_parallelism()
        .map(|x| x.get())
        .unwrap_or(4)
        .min(8);

    std::thread::scope(|s| {
        for _ in 0..workers {
            s.spawn(|| loop {
                let i = idx.fetch_add(1, Ordering::Relaxed);
                if i >= paths.len() {
                    break;
                }
                let p = &paths[i];
                let name = p
                    .file_name()
                    .map(|x| x.to_string_lossy().to_string())
                    .unwrap_or_default();
                if name == ".DS_Store" {
                    continue;
                }
                let size = path_size(p);
                if size == 0 {
                    continue;
                }
                let entry = CacheEntry {
                    id: p.to_string_lossy().to_string(),
                    name,
                    path: p.to_string_lossy().to_string(),
                    size,
                    location: "user".to_string(),
                };
                results.lock().unwrap().push(entry);
            });
        }
    });

    let mut out = results.into_inner().unwrap();
    out.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(out)
}

#[tauri::command]
pub fn clean_caches(paths: Vec<String>) -> Result<CleanResult, String> {
    let mut freed = 0u64;
    let mut removed = 0usize;
    let mut errors: Vec<String> = Vec::new();
    let mut admin: Vec<(PathBuf, u64)> = Vec::new();
    let mut in_use = 0usize;
    let mut failed = 0usize;

    for ps in &paths {
        let p = PathBuf::from(ps);
        if !is_allowed(&p) {
            errors.push(format!("Ruta no permitida: {ps}"));
            continue;
        }
        if !p.exists() {
            continue;
        }
        let size = path_size(&p);
        // Borrado tolerante: lo bloqueado se salta y se sigue con el resto.
        let w = crate::platform::wipe(&p, false);
        freed += w.freed;
        removed += w.removed;
        in_use += w.in_use;
        failed += w.failed;

        if w.denied > 0 {
            // Lo que falla por permisos se agrupa para pedir admin UNA sola vez.
            admin.push((p.clone(), size.saturating_sub(w.freed)));
        }
    }

    // Lo que necesita permisos elevados va en UNA sola petición de admin.
    if !admin.is_empty() {
        let admin_paths: Vec<PathBuf> = admin.iter().map(|(p, _)| p.clone()).collect();
        match remove_with_admin(&admin_paths) {
            Ok(_) => {
                // Se COMPRUEBA qué desapareció de verdad, en vez de dar por
                // liberado el tamaño estimado antes. `rm -rf` devuelve 0 en
                // varios casos aunque no haya borrado todo, así que fiarse de
                // su código de salida era inventarse la cifra.
                for (p, size_pendiente) in &admin {
                    if p.exists() {
                        // Sigue ahí: no se ha liberado nada de esta ruta.
                        errors.push(format!("{}: no se pudo eliminar", p.display()));
                    } else {
                        freed += size_pendiente;
                        removed += 1;
                    }
                }
            }
            Err(e) => errors.push(format!("Admin: {e}")),
        }
    }

    Ok(CleanResult {
        freed,
        removed,
        errors,
        skipped_in_use: in_use,
        skipped_failed: failed,
    })
}

#[cfg(target_os = "macos")]
fn shell_quote(p: &Path) -> String {
    let s = p.to_string_lossy();
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Fuera de macOS no elevamos privilegios: si un archivo no se puede borrar por
/// permisos, se informa con claridad en vez de intentar un truco de elevación.
#[cfg(not(target_os = "macos"))]
fn remove_with_admin(_paths: &[PathBuf]) -> Result<(), String> {
    Err("Estos archivos requieren permisos de administrador; ciérralos o ejecuta la app como administrador".into())
}

/// Deletes paths using one authenticated `rm -rf` via osascript. macOS shows
/// the standard admin password dialog. Paths are already validated by caller.
#[cfg(target_os = "macos")]
fn remove_with_admin(paths: &[PathBuf]) -> Result<(), String> {
    let joined = paths
        .iter()
        .map(|p| shell_quote(p))
        .collect::<Vec<_>>()
        .join(" ");
    let shell_cmd = format!("/bin/rm -rf {joined}");
    let escaped = shell_cmd.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!("do shell script \"{escaped}\" with administrator privileges");

    let out = crate::platform::cmd("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

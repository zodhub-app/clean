// Explorador de archivos/carpetas grandes (Fase 1). SOLO LECTURA.
// Escanea UN nivel: por cada hijo inmediato de la carpeta, su tamaño real
// (recursivo). El frontend permite entrar en subcarpetas (drill-down) para ir
// localizando qué ocupa. No borra nada.
//
// Multiplataforma: los tamaños se calculan con `walkdir` (antes `du -sk`, solo
// Unix), la Papelera va por el crate `trash` (antes Finder vía osascript) y
// «revelar» se adapta a Finder/Explorador/gestor XDG. Ver `platform.rs`.

use crate::platform;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct ScanEntry {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
}

#[derive(Serialize)]
pub struct ScanResult {
    path: String,
    parent: Option<String>,
    total: u64,
    entries: Vec<ScanEntry>,
    /// Entradas que no se pudieron leer (permisos, protección de privacidad de
    /// macOS…). Si no es cero, `total` es un MÍNIMO, no el tamaño real. Antes
    /// se descartaban en silencio y el usuario veía un total más bajo que el
    /// del Finder sin ninguna pista de por qué.
    unreadable: usize,
}

fn resolve(path: &str) -> PathBuf {
    if path.is_empty() || path == "~" {
        platform::home_dir()
    } else {
        PathBuf::from(path)
    }
}

#[tauri::command]
pub async fn scan_dir(path: String) -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = resolve(&path);
        if !dir.is_dir() {
            return Err("No es una carpeta".to_string());
        }

        // Hijos inmediatos (sin seguir symlinks al enumerar).
        let mut children: Vec<PathBuf> = Vec::new();
        let rd = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for e in rd.flatten() {
            children.push(e.path());
        }

        // Tamaño real de cada hijo (recursivo, sin seguir enlaces).
        let mut unreadable = 0usize;
        let mut entries: Vec<ScanEntry> = children
            .iter()
            .map(|c| {
                let m = platform::measure(c);
                unreadable += m.unreadable;
                ScanEntry {
                    name: c
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    size: m.bytes,
                    is_dir: c.is_dir(),
                    path: c.to_string_lossy().to_string(),
                }
            })
            .collect();
        entries.sort_by(|a, b| b.size.cmp(&a.size));

        Ok(ScanResult {
            total: entries.iter().map(|e| e.size).sum(),
            parent: dir.parent().map(|p| p.to_string_lossy().to_string()),
            path: dir.to_string_lossy().to_string(),
            entries,
            unreadable,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Muestra el elemento en el explorador de archivos del sistema (lo revela, no
/// lo abre). El nombre del comando se mantiene por compatibilidad con el frontend.
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    platform::reveal(&path)
}

#[derive(Serialize)]
pub struct TrashResult {
    moved: u32,
    /// Tamaño de lo movido a la Papelera. **NO es espacio liberado.**
    ///
    /// Mover a la Papelera no libera ni un byte: el archivo sigue en el mismo
    /// disco, en `~/.Trash`. El espacio se recupera al VACIARLA. El campo se
    /// llamaba `freed` y la interfaz decía «liberado X», que era falso; ahora
    /// se llama por lo que es y la interfaz dice «movido a la Papelera».
    moved_bytes: u64,
    errors: Vec<String>,
}

/// Mueve elementos a la Papelera del sistema (recuperable). Valida cada ruta con
/// la guarda de seguridad común. Devuelve cuántos se movieron, cuánto ocupaban
/// y los errores.
#[tauri::command]
pub async fn move_to_trash(paths: Vec<String>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut moved = 0u32;
        let mut moved_bytes = 0u64;
        let mut errors = Vec::new();
        for ps in paths {
            let p = PathBuf::from(&ps);
            if let Err(e) = platform::is_deletable(&p) {
                errors.push(format!("{ps}: {e}"));
                continue;
            }
            if !p.exists() {
                continue;
            }
            // Medimos antes de mover: después ya no está en su sitio.
            let before = platform::dir_size(&p);
            match platform::move_to_trash(&p) {
                Ok(()) => {
                    moved += 1;
                    moved_bytes += before;
                }
                Err(e) => errors.push(format!("{ps}: {e}")),
            }
        }
        TrashResult {
            moved,
            moved_bytes,
            errors,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

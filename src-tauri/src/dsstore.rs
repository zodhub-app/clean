use serde::Serialize;
use std::fs::File;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::CompressionMethod;

/// Files/dirs that should never end up inside a clean archive.
fn is_junk(name: &str) -> bool {
    name == ".DS_Store"
        || name.starts_with("._") // AppleDouble resource forks
        || name == "__MACOSX"
        || name == ".Spotlight-V100"
        || name == ".fseventsd"
        || name == ".Trashes"
        || name == ".DocumentRevisions-V100"
        || name == ".TemporaryItems"
}

#[derive(Serialize)]
pub struct CompressResult {
    entries: usize,
    skipped: usize,
    size: u64,
    dest: String,
}

#[tauri::command]
pub fn clean_zip(paths: Vec<String>, dest: String) -> Result<CompressResult, String> {
    let result = (|| -> Result<CompressResult, String> {
    let file = File::create(&dest).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut entries = 0usize;
    let mut skipped = 0usize;

    for ps in &paths {
        let src = PathBuf::from(ps);
        let name = src
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        if src.is_file() {
            if is_junk(&name) {
                skipped += 1;
                continue;
            }
            add_file(&mut zip, &src, &name, opts)?;
            entries += 1;
        } else if src.is_dir() {
            // Prefix entries with the folder's own name (like Finder does).
            //
            // Si `src` fuera una raíz (`/` o `C:\`) no tiene padre. Antes se
            // recurría a `/` como comodín, que en Windows no es prefijo de
            // nada: `strip_prefix` fallaba para TODAS las entradas y salía un
            // zip vacío sin dar ningún error. Usando el propio `src` el zip
            // sale con rutas relativas correctas.
            let prefix_base = src.parent().unwrap_or(src.as_path());
            let walker = WalkDir::new(&src)
                .into_iter()
                .filter_entry(|e| {
                    !is_junk(e.file_name().to_string_lossy().as_ref())
                });
            for entry in walker.filter_map(|e| e.ok()) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let p = entry.path();
                let rel = match p.strip_prefix(prefix_base) {
                    Ok(r) => r,
                    Err(_) => continue,
                };
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                add_file(&mut zip, p, &rel_str, opts)?;
                entries += 1;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    let size = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    Ok(CompressResult {
        entries,
        skipped,
        size,
        dest: dest.clone(),
    })
    })();
    // Si algo falló a mitad, no dejamos un .zip truncado.
    if result.is_err() {
        let _ = std::fs::remove_file(&dest);
    }
    result
}

fn add_file(
    zip: &mut ZipWriter<File>,
    path: &Path,
    name: &str,
    opts: SimpleFileOptions,
) -> Result<(), String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    zip.start_file(name, opts).map_err(|e| e.to_string())?;
    std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct SweepResult {
    removed: usize,
    freed: u64,
    errors: Vec<String>,
}

#[tauri::command]
pub fn sweep_ds_store(roots: Vec<String>) -> Result<SweepResult, String> {
    let mut removed = 0usize;
    let mut freed = 0u64;
    let mut errors: Vec<String> = Vec::new();

    for r in &roots {
        // Misma guarda que el resto de la app: solo dentro de la carpeta de
        // usuario. Aunque aquí solo se borren archivos llamados exactamente
        // «.DS_Store», el comando es invocable desde el frontend y no debe ser
        // la única puerta sin cerrojo. Barato de comprobar, imposible de
        // olvidar el día que alguien amplíe el patrón de nombres.
        if let Err(e) = crate::platform::is_deletable(std::path::Path::new(r)) {
            errors.push(format!("{r}: {e}"));
            continue;
        }
        for entry in WalkDir::new(r).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && entry.file_name() == ".DS_Store" {
                let p = entry.path();
                let size = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                match std::fs::remove_file(p) {
                    Ok(_) => {
                        removed += 1;
                        freed += size;
                    }
                    Err(e) => errors.push(format!("{}: {e}", p.display())),
                }
            }
        }
    }

    Ok(SweepResult {
        removed,
        freed,
        errors,
    })
}

// Los `.DS_Store` son un invento de macOS: el ajuste de «no crearlos en unidades
// de red» solo existe ahí. Fuera de macOS estos dos comandos no aplican y la
// interfaz oculta la sección entera.

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_network_stores_disabled() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn set_network_stores_disabled(_disabled: bool) -> Result<(), String> {
    Err("Este ajuste solo existe en macOS".into())
}

/// Whether macOS is set to NOT write .DS_Store on network volumes.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_network_stores_disabled() -> bool {
    let out = crate::platform::cmd("defaults")
        .args([
            "read",
            "com.apple.desktopservices",
            "DSDontWriteNetworkStores",
        ])
        .output();
    match out {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "1",
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn set_network_stores_disabled(disabled: bool) -> Result<(), String> {
    let val = if disabled { "true" } else { "false" };
    let out = crate::platform::cmd("defaults")
        .args([
            "write",
            "com.apple.desktopservices",
            "DSDontWriteNetworkStores",
            "-bool",
            val,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

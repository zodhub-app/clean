// Explorador de archivos/carpetas grandes (Fase 1). SOLO LECTURA.
// Escanea UN nivel: por cada hijo inmediato de la carpeta, su tamaño real
// (recursivo, medido con `du`). El frontend permite entrar en subcarpetas
// (drill-down) para ir localizando qué ocupa. No borra nada.

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

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
}

fn resolve(path: &str) -> PathBuf {
    if path.is_empty() || path == "~" {
        PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/".into()))
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

        // Tamaño de cada hijo con UN solo `du -sk` (varios argumentos, sin shell
        // → nombres con espacios seguros). Devuelve "<kb>\t<ruta>" por línea.
        let mut sizes: HashMap<String, u64> = HashMap::new();
        if !children.is_empty() {
            let mut cmd = Command::new("du");
            cmd.arg("-sk");
            for c in &children {
                cmd.arg(c);
            }
            if let Ok(out) = cmd.output() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    if let Some(tab) = line.find('\t') {
                        let kb = line[..tab].trim().parse::<u64>().unwrap_or(0);
                        sizes.insert(line[tab + 1..].to_string(), kb * 1024);
                    }
                }
            }
        }

        let mut entries: Vec<ScanEntry> = children
            .iter()
            .map(|c| {
                let ps = c.to_string_lossy().to_string();
                ScanEntry {
                    name: c
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    size: *sizes.get(&ps).unwrap_or(&0),
                    is_dir: c.is_dir(),
                    path: ps,
                }
            })
            .collect();
        entries.sort_by(|a, b| b.size.cmp(&a.size));

        Ok(ScanResult {
            total: entries.iter().map(|e| e.size).sum(),
            parent: dir.parent().map(|p| p.to_string_lossy().to_string()),
            path: dir.to_string_lossy().to_string(),
            entries,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Muestra el elemento en Finder (lo revela, no lo abre).
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(&path)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct TrashResult {
    moved: u32,
    freed: u64,
    errors: Vec<String>,
}

fn du_bytes(path: &str) -> u64 {
    Command::new("du")
        .arg("-sk")
        .arg(path)
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .split_whitespace()
                .next()
                .and_then(|n| n.parse::<u64>().ok())
        })
        .map(|kb| kb * 1024)
        .unwrap_or(0)
}

/// Guarda de seguridad: solo se puede enviar a la Papelera algo DENTRO de la
/// carpeta de usuario, y nunca la propia carpeta de inicio ni sus carpetas
/// críticas de primer nivel. El sistema y otras cuentas quedan fuera.
fn is_deletable(p: &std::path::Path) -> Result<(), String> {
    let home = PathBuf::from(std::env::var("HOME").unwrap_or_default());
    if home.as_os_str().is_empty() {
        return Err("No se encontró la carpeta de usuario".into());
    }
    if !p.starts_with(&home) {
        return Err("Protegido: solo dentro de tu carpeta de usuario".into());
    }
    if p == home {
        return Err("Protegido: carpeta de inicio".into());
    }
    let critical = [
        "Documents",
        "Desktop",
        "Library",
        "Pictures",
        "Movies",
        "Music",
        "Public",
    ];
    if let Ok(rel) = p.strip_prefix(&home) {
        if rel.components().count() == 1 {
            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                if critical.contains(&name) {
                    return Err(format!("Protegido: {name}"));
                }
            }
        }
    }
    Ok(())
}

/// Mueve elementos a la Papelera (recuperable), vía Finder. Valida cada ruta
/// con `is_deletable`. Devuelve cuántos se movieron, cuánto se liberó y errores.
#[tauri::command]
pub async fn move_to_trash(paths: Vec<String>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut moved = 0u32;
        let mut freed = 0u64;
        let mut errors = Vec::new();
        for ps in paths {
            let p = PathBuf::from(&ps);
            if let Err(e) = is_deletable(&p) {
                errors.push(format!("{ps}: {e}"));
                continue;
            }
            if !p.exists() {
                continue;
            }
            let before = du_bytes(&ps);
            let script = format!(
                "tell application \"Finder\" to move POSIX file \"{}\" to trash",
                ps.replace('\\', "\\\\").replace('"', "\\\"")
            );
            match Command::new("osascript").arg("-e").arg(&script).output() {
                Ok(o) if o.status.success() => {
                    moved += 1;
                    freed += before;
                }
                Ok(o) => errors.push(format!(
                    "{ps}: {}",
                    String::from_utf8_lossy(&o.stderr).trim()
                )),
                Err(e) => errors.push(format!("{ps}: {e}")),
            }
        }
        TrashResult {
            moved,
            freed,
            errors,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

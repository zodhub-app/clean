// "Liberar espacio" — escaneo y limpieza de TODA la basura recuperable:
// cachés del sistema/apps, logs, Docker, Xcode, gestores de paquetes, modelos
// de IA y Papelera. La basura regenerable se BORRA de verdad (libera espacio al
// instante); Docker usa prune (sin volúmenes → datos a salvo); la Papelera se
// vacía. Rutas fijas y conocidas bajo el usuario → seguro.

use serde::Serialize;
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use sysinfo::Disks;

/// Espacio libre real del disco principal (para medir lo liberado de verdad).
fn free_bytes() -> u64 {
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .find(|d| d.mount_point() == Path::new("/"))
        .or_else(|| disks.list().iter().max_by_key(|d| d.total_space()))
        .map(|d| d.available_space())
        .unwrap_or(0)
}

#[derive(Serialize)]
pub struct DevItem {
    key: String,
    kind: String, // "file" | "docker" | "trash"
    size: u64,
    paths: Vec<String>,
}

#[derive(Serialize)]
pub struct CleanResult {
    freed: u64,
    errors: Vec<String>,
}

fn home() -> String {
    std::env::var("HOME").unwrap_or_default()
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

// Categorías de ficheros (borrado permanente; todas regenerables).
const FILE_KEYS: [&str; 12] = [
    "user-caches",
    "browser-caches",
    "logs",
    "xcode-derived",
    "xcode-archives",
    "xcode-devicesupport",
    "coresimulator",
    "npm",
    "pnpm",
    "huggingface",
    "ollama",
    "lmstudio",
];

/// Cachés de navegadores que NO viven en ~/Library/Caches (perfiles de Chromium
/// y Firefox). Solo carpetas de caché puras (no cookies/sesiones).
fn browser_cache_paths(h: &str) -> Vec<String> {
    let mut out = Vec::new();
    let chromium = [
        format!("{h}/Library/Application Support/Google/Chrome"),
        format!("{h}/Library/Application Support/BraveSoftware/Brave-Browser"),
        format!("{h}/Library/Application Support/Microsoft Edge"),
        format!("{h}/Library/Application Support/Chromium"),
        format!("{h}/Library/Application Support/Vivaldi"),
    ];
    let subs = [
        "Cache",
        "Code Cache",
        "GPUCache",
        "DawnCache",
        "GrShaderCache",
        "Service Worker/CacheStorage",
    ];
    for base in &chromium {
        if let Ok(rd) = std::fs::read_dir(base) {
            for e in rd.flatten() {
                let p = e.path();
                if !p.is_dir() {
                    continue;
                }
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let is_profile = name == "Default"
                    || name == "Guest Profile"
                    || name == "System Profile"
                    || name.starts_with("Profile ");
                if is_profile {
                    for s in &subs {
                        let c = format!("{}/{}", p.to_string_lossy(), s);
                        if Path::new(&c).exists() {
                            out.push(c);
                        }
                    }
                }
            }
        }
    }
    let ff = format!("{h}/Library/Application Support/Firefox/Profiles");
    if let Ok(rd) = std::fs::read_dir(&ff) {
        for e in rd.flatten() {
            let c = format!("{}/cache2", e.path().to_string_lossy());
            if Path::new(&c).exists() {
                out.push(c);
            }
        }
    }
    out
}

/// Mueve un elemento a la Papelera (recuperable). Para las copias de iOS.
fn trash_path(path: &str) -> Result<(), String> {
    let script = format!(
        "tell application \"Finder\" to move POSIX file \"{}\" to trash",
        path.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let out = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn candidates(key: &str, h: &str) -> Vec<String> {
    match key {
        "user-caches" => vec![format!("{h}/Library/Caches")],
        "browser-caches" => browser_cache_paths(h),
        "logs" => vec![format!("{h}/Library/Logs")],
        "ios-backups" => vec![format!(
            "{h}/Library/Application Support/MobileSync/Backup"
        )],
        "xcode-derived" => vec![format!("{h}/Library/Developer/Xcode/DerivedData")],
        "xcode-archives" => vec![format!("{h}/Library/Developer/Xcode/Archives")],
        "xcode-devicesupport" => vec![format!("{h}/Library/Developer/Xcode/iOS DeviceSupport")],
        "coresimulator" => vec![format!("{h}/Library/Developer/CoreSimulator/Caches")],
        "npm" => vec![format!("{h}/.npm/_cacache")],
        "pnpm" => vec![format!("{h}/Library/pnpm/store"), format!("{h}/.pnpm-store")],
        "huggingface" => vec![format!("{h}/.cache/huggingface")],
        "ollama" => vec![format!("{h}/.ollama/models")],
        "lmstudio" => vec![format!("{h}/.cache/lm-studio"), format!("{h}/.lmstudio")],
        "trash" => vec![format!("{h}/.Trash")],
        _ => vec![],
    }
}

fn existing(key: &str, h: &str) -> Vec<String> {
    candidates(key, h)
        .into_iter()
        .filter(|p| Path::new(p).exists())
        .collect()
}

fn parse_size(s: &str) -> u64 {
    let s = s.trim();
    let num: String = s.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    let unit = s[num.len()..].trim().to_uppercase();
    let n: f64 = num.parse().unwrap_or(0.0);
    let mult = match unit.as_str() {
        "KB" => 1e3,
        "MB" => 1e6,
        "GB" => 1e9,
        "TB" => 1e12,
        _ => 1.0,
    };
    (n * mult) as u64
}

fn docker_reclaimable() -> Option<u64> {
    let out = Command::new("docker").args(["system", "df"]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut total = 0u64;
    for line in text.lines().skip(1) {
        if let Some(paren) = line.rfind('(') {
            if let Some(tok) = line[..paren].split_whitespace().last() {
                total += parse_size(tok);
            }
        }
    }
    Some(total)
}

fn parse_reclaimed(s: &str) -> u64 {
    for line in s.lines() {
        if let Some(idx) = line.find("Total reclaimed space:") {
            return parse_size(line[idx + "Total reclaimed space:".len()..].trim());
        }
    }
    0
}

#[tauri::command]
pub async fn list_dev_junk() -> Vec<DevItem> {
    tauri::async_runtime::spawn_blocking(|| {
        let h = home();
        let mut items = Vec::new();
        for key in FILE_KEYS {
            let paths = existing(key, &h);
            if paths.is_empty() {
                continue;
            }
            let size: u64 = paths.iter().map(|p| du_bytes(p)).sum();
            if size == 0 {
                continue;
            }
            items.push(DevItem {
                key: key.to_string(),
                kind: "file".to_string(),
                size,
                paths,
            });
        }
        // Copias de seguridad de iOS (recuperable → Papelera, no en "limpiar todo").
        let ios = existing("ios-backups", &h);
        if !ios.is_empty() {
            let size: u64 = ios.iter().map(|p| du_bytes(p)).sum();
            if size > 0 {
                items.push(DevItem {
                    key: "ios-backups".to_string(),
                    kind: "backup".to_string(),
                    size,
                    paths: ios,
                });
            }
        }
        // Papelera.
        let trash = existing("trash", &h);
        if !trash.is_empty() {
            let size: u64 = trash.iter().map(|p| du_bytes(p)).sum();
            if size > 0 {
                items.push(DevItem {
                    key: "trash".to_string(),
                    kind: "trash".to_string(),
                    size,
                    paths: trash,
                });
            }
        }
        // Docker.
        if let Some(recl) = docker_reclaimable() {
            items.push(DevItem {
                key: "docker".to_string(),
                kind: "docker".to_string(),
                size: recl,
                paths: vec![],
            });
        }
        items.sort_by(|a, b| b.size.cmp(&a.size));
        items
    })
    .await
    .unwrap_or_default()
}

fn empty_trash() -> Result<(), String> {
    // Vacía la Papelera vía Finder; ignora el -128 (papelera ya vacía).
    let script = "tell application \"Finder\"\n\
                  try\n\
                  empty the trash\n\
                  on error em number en\n\
                  if en is not -128 then error em number en\n\
                  end try\n\
                  end tell";
    let out = Command::new("osascript")
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

/// Borra permanentemente las rutas de una categoría de ficheros. Devuelve el
/// espacio liberado (tamaño medido antes) y los errores.
fn wipe_files(key: &str, h: &str) -> (u64, Vec<String>) {
    let mut freed = 0u64;
    let mut errors = Vec::new();
    for p in existing(key, h) {
        let before = du_bytes(&p);
        let out = Command::new("rm").arg("-rf").arg(&p).output();
        match out {
            Ok(_) => freed += before, // rm -rf es best-effort; espacio ~liberado
            Err(e) => errors.push(format!("{p}: {e}")),
        }
    }
    (freed, errors)
}

#[tauri::command]
pub async fn clean_dev(key: String) -> Result<CleanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let h = home();
        if key == "docker" {
            return match Command::new("docker").args(["system", "prune", "-af"]).output() {
                Ok(o) if o.status.success() => CleanResult {
                    freed: parse_reclaimed(&String::from_utf8_lossy(&o.stdout)),
                    errors: vec![],
                },
                Ok(o) => CleanResult {
                    freed: 0,
                    errors: vec![String::from_utf8_lossy(&o.stderr).trim().to_string()],
                },
                Err(e) => CleanResult {
                    freed: 0,
                    errors: vec![e.to_string()],
                },
            };
        }
        // Copias de iOS: a la Papelera (recuperable, son valiosas). Como no
        // liberan hasta vaciar la Papelera, reportamos el tamaño movido (du).
        if key == "ios-backups" {
            let mut freed = 0u64;
            let mut errors = Vec::new();
            for p in existing("ios-backups", &h) {
                let before = du_bytes(&p);
                match trash_path(&p) {
                    Ok(()) => freed += before,
                    Err(e) => errors.push(format!("{p}: {e}")),
                }
            }
            return CleanResult { freed, errors };
        }

        // Ficheros o Papelera: medimos el espacio libre REAL antes/después
        // (du no puede con rutas protegidas como la Papelera y subestimaría).
        let before = free_bytes();
        let mut errors = Vec::new();
        if key == "trash" {
            if let Err(e) = empty_trash() {
                errors.push(e);
            }
        } else {
            let (_f, mut e) = wipe_files(&key, &h);
            errors.append(&mut e);
        }
        std::thread::sleep(Duration::from_millis(700));
        let after = free_bytes();
        CleanResult {
            freed: after.saturating_sub(before),
            errors,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

/// Limpieza de un botón: borra TODAS las categorías de ficheros + vacía la
/// Papelera. NO toca Docker (tiene su propio botón por seguridad de volúmenes).
#[tauri::command]
pub async fn clean_all_junk() -> Result<CleanResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let h = home();
        let before = free_bytes();
        let mut errors = Vec::new();
        for key in FILE_KEYS {
            let (_f, mut e) = wipe_files(key, &h);
            errors.append(&mut e);
        }
        if let Err(e) = empty_trash() {
            errors.push(e);
        }
        std::thread::sleep(Duration::from_millis(900));
        let after = free_bytes();
        CleanResult {
            freed: after.saturating_sub(before),
            errors,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

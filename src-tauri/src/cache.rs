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
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// Cache roots MacUp is allowed to touch. Anything outside these is rejected.
fn allowed_roots() -> Vec<PathBuf> {
    let mut v = vec![PathBuf::from("/Library/Caches")];
    if let Some(h) = home_dir() {
        v.push(h.join("Library/Caches"));
    }
    v
}

fn is_allowed(path: &Path) -> bool {
    allowed_roots()
        .iter()
        .any(|root| path.starts_with(root) && path != root)
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
        return meta.len();
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

fn remove_path(p: &Path) -> std::io::Result<()> {
    let meta = fs::symlink_metadata(p)?;
    if meta.is_dir() && !meta.file_type().is_symlink() {
        fs::remove_dir_all(p)
    } else {
        fs::remove_file(p)
    }
}

#[tauri::command]
pub fn scan_caches() -> Result<Vec<CacheEntry>, String> {
    let home = home_dir().ok_or("No se pudo localizar la carpeta de inicio")?;
    let root = home.join("Library/Caches");

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
        match remove_path(&p) {
            Ok(_) => {
                freed += size;
                removed += 1;
            }
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                admin.push((p, size));
            }
            Err(e) => errors.push(format!("{ps}: {e}")),
        }
    }

    // Anything that needed elevated rights goes through one admin prompt.
    if !admin.is_empty() {
        let admin_paths: Vec<PathBuf> = admin.iter().map(|(p, _)| p.clone()).collect();
        match remove_with_admin(&admin_paths) {
            Ok(_) => {
                for (_, size) in &admin {
                    freed += size;
                    removed += 1;
                }
            }
            Err(e) => errors.push(format!("Admin: {e}")),
        }
    }

    Ok(CleanResult {
        freed,
        removed,
        errors,
    })
}

fn shell_quote(p: &Path) -> String {
    let s = p.to_string_lossy();
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Deletes paths using one authenticated `rm -rf` via osascript. macOS shows
/// the standard admin password dialog. Paths are already validated by caller.
fn remove_with_admin(paths: &[PathBuf]) -> Result<(), String> {
    let joined = paths
        .iter()
        .map(|p| shell_quote(p))
        .collect::<Vec<_>>()
        .join(" ");
    let shell_cmd = format!("/bin/rm -rf {joined}");
    let escaped = shell_cmd.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!("do shell script \"{escaped}\" with administrator privileges");

    let out = std::process::Command::new("osascript")
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

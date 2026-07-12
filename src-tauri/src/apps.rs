// Desinstalador de aplicaciones. Lista las apps con su tamaño, detecta la
// "basura" que dejan repartida por ~/Library (por bundle id / nombre) y permite
// desinstalar app + restos a la PAPELERA (recuperable), con guardas de seguridad.

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
pub struct AppInfo {
    name: String,
    path: String,
    size: u64,
    bundle_id: String,
}

#[derive(Serialize)]
pub struct Leftover {
    path: String,
    size: u64,
}

#[derive(Serialize)]
pub struct LeftoverResult {
    total: u64,
    items: Vec<Leftover>,
}

#[derive(Serialize)]
pub struct TrashResult {
    moved: u32,
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

/// Lee el CFBundleIdentifier del Info.plist (defaults maneja plist binario).
fn bundle_id(app: &Path) -> String {
    let info = format!("{}/Contents/Info", app.to_string_lossy());
    Command::new("defaults")
        .arg("read")
        .arg(&info)
        .arg("CFBundleIdentifier")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn list_apps() -> Vec<AppInfo> {
    tauri::async_runtime::spawn_blocking(|| {
        let h = home();
        let mut dirs = vec![PathBuf::from("/Applications")];
        if !h.is_empty() {
            dirs.push(PathBuf::from(format!("{h}/Applications")));
        }
        let mut paths: Vec<PathBuf> = Vec::new();
        for d in dirs {
            if let Ok(rd) = std::fs::read_dir(&d) {
                for e in rd.flatten() {
                    let p = e.path();
                    if p.extension().and_then(|x| x.to_str()) == Some("app") {
                        paths.push(p);
                    }
                }
            }
        }
        // Tamaño de todas las apps en UN solo `du -sk`.
        let mut sizes: HashMap<String, u64> = HashMap::new();
        if !paths.is_empty() {
            let mut cmd = Command::new("du");
            cmd.arg("-sk");
            for p in &paths {
                cmd.arg(p);
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
        let mut apps: Vec<AppInfo> = paths
            .iter()
            .map(|p| {
                let ps = p.to_string_lossy().to_string();
                AppInfo {
                    name: p
                        .file_stem()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    size: *sizes.get(&ps).unwrap_or(&0),
                    bundle_id: bundle_id(p),
                    path: ps,
                }
            })
            .collect();
        apps.sort_by(|a, b| b.size.cmp(&a.size));
        apps
    })
    .await
    .unwrap_or_default()
}

/// Restos que una app deja repartidos, por bundle id y por nombre.
#[tauri::command]
pub async fn app_leftovers(bundle_id: String, name: String) -> LeftoverResult {
    tauri::async_runtime::spawn_blocking(move || {
        let h = home();
        let mut cands: Vec<String> = Vec::new();
        if !bundle_id.is_empty() {
            let id = &bundle_id;
            cands.push(format!("{h}/Library/Caches/{id}"));
            cands.push(format!("{h}/Library/Application Support/{id}"));
            cands.push(format!("{h}/Library/Preferences/{id}.plist"));
            cands.push(format!("{h}/Library/Logs/{id}"));
            cands.push(format!("{h}/Library/Containers/{id}"));
            cands.push(format!("{h}/Library/Saved Application State/{id}.savedState"));
            cands.push(format!("{h}/Library/HTTPStorages/{id}"));
            cands.push(format!("{h}/Library/WebKit/{id}"));
            cands.push(format!("{h}/Library/Cookies/{id}.binarycookies"));
        }
        if !name.is_empty() {
            cands.push(format!("{h}/Library/Caches/{name}"));
            cands.push(format!("{h}/Library/Application Support/{name}"));
            cands.push(format!("{h}/Library/Logs/{name}"));
        }
        let mut items = Vec::new();
        let mut total = 0u64;
        for c in cands {
            if Path::new(&c).exists() {
                let sz = du_bytes(&c);
                total += sz;
                items.push(Leftover { path: c, size: sz });
            }
        }
        LeftoverResult { total, items }
    })
    .await
    .unwrap_or(LeftoverResult {
        total: 0,
        items: vec![],
    })
}


fn trash_one(path: &str) -> Result<(), String> {
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

/// Desinstala: mueve la app y sus restos a la Papelera. Guardas: la app debe
/// estar en /Applications o ~/Applications y acabar en .app; los restos deben
/// estar bajo ~/Library. Todo recuperable desde la Papelera.
#[tauri::command]
pub async fn uninstall_app(app_path: String, leftovers: Vec<String>) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let h = home();
        let mut targets: Vec<String> = Vec::new();

        // La app.
        let ok_app = app_path.ends_with(".app")
            && (app_path.starts_with("/Applications/")
                || (!h.is_empty() && app_path.starts_with(&format!("{h}/Applications/"))));
        if !ok_app {
            return TrashResult {
                moved: 0,
                freed: 0,
                errors: vec![format!("{app_path}: protegido / no es una app en Aplicaciones")],
            };
        }
        targets.push(app_path.clone());

        // Restos: SOLO bajo ~/Library.
        let libp = format!("{h}/Library/");
        for l in leftovers {
            if !h.is_empty() && l.starts_with(&libp) {
                targets.push(l);
            }
        }

        let mut moved = 0u32;
        let mut freed = 0u64;
        let mut errors = Vec::new();
        for tpath in targets {
            if !Path::new(&tpath).exists() {
                continue;
            }
            let before = du_bytes(&tpath);
            match trash_one(&tpath) {
                Ok(()) => {
                    moved += 1;
                    freed += before;
                }
                Err(e) => errors.push(format!("{tpath}: {e}")),
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

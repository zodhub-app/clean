// Desinstalador de aplicaciones. Lista las apps con su tamaño, detecta la
// "basura" que dejan repartida por ~/Library (por bundle id / nombre) y permite
// desinstalar app + restos a la PAPELERA (recuperable), con guardas de seguridad.

use crate::platform;
use serde::Serialize;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
use std::path::Path;

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
    /// Tamaño de lo movido a la Papelera. **NO es espacio liberado**: el
    /// archivo sigue en el mismo disco hasta que se vacía la Papelera.
    moved_bytes: u64,
    errors: Vec<String>,
}

fn home() -> String {
    platform::home_dir().to_string_lossy().to_string()
}

/// Tamaño real de una ruta. Multiplataforma (antes `du -sk`, solo Unix).
fn du_bytes(path: &str) -> u64 {
    platform::dir_size(Path::new(path))
}

/// Lee el CFBundleIdentifier del Info.plist (defaults maneja plist binario).
#[cfg(target_os = "macos")]
fn bundle_id(app: &Path) -> String {
    let info = format!("{}/Contents/Info", app.to_string_lossy());
    crate::platform::cmd("defaults")
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
    tauri::async_runtime::spawn_blocking(list_apps_impl)
        .await
        .unwrap_or_default()
}

/// macOS: los `.app` de /Applications y ~/Applications (paquetes autocontenidos).
#[cfg(target_os = "macos")]
fn list_apps_impl() -> Vec<AppInfo> {
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
    let mut apps: Vec<AppInfo> = paths
        .iter()
        .map(|p| AppInfo {
            name: p
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            size: platform::dir_size(p),
            bundle_id: bundle_id(p),
            path: p.to_string_lossy().to_string(),
        })
        .collect();
    apps.sort_by(|a, b| b.size.cmp(&a.size));
    apps
}

/// Windows: los programas no son paquetes autocontenidos, así que el inventario
/// real vive en el REGISTRO (claves Uninstall de 64 bits, 32 bits y del usuario).
/// Se consulta con PowerShell y salida JSON. `bundle_id` transporta el
/// UninstallString: es el «handle» para desinstalar de forma oficial.
#[cfg(target_os = "windows")]
fn list_apps_impl() -> Vec<AppInfo> {
    const PS: &str = r#"
$paths = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
Get-ItemProperty $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
  Select-Object @{N='name';E={$_.DisplayName}},
                @{N='location';E={$_.InstallLocation}},
                @{N='uninstall';E={$_.UninstallString}},
                @{N='kb';E={$_.EstimatedSize}} |
  ConvertTo-Json -Compress
"#;
    let out = match crate::platform::cmd("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", PS])
        .output()
    {
        Ok(o) => o,
        Err(_) => return vec![],
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let json: serde_json::Value = match serde_json::from_str(text.trim()) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    // Con un solo programa, PowerShell devuelve un objeto en vez de un array.
    let arr = match json.as_array() {
        Some(a) => a.clone(),
        None => vec![json],
    };

    let mut apps: Vec<AppInfo> = arr
        .iter()
        .filter_map(|v| {
            let name = v.get("name")?.as_str()?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let location = v
                .get("location")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let uninstall = v
                .get("uninstall")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            // EstimatedSize del registro viene en KB. Si falta y conocemos la
            // carpeta, la medimos de verdad; si no, 0 (honesto: «sin dato»).
            let size = match v.get("kb").and_then(|x| x.as_u64()) {
                Some(kb) => kb * 1024,
                None if !location.is_empty() => platform::dir_size(Path::new(&location)),
                None => 0,
            };
            Some(AppInfo {
                name,
                size,
                path: location,
                bundle_id: uninstall,
            })
        })
        .collect();
    apps.sort_by(|a, b| b.size.cmp(&a.size));
    apps
}

/// Linux: el inventario lo lleva el gestor de paquetes; aún no implementado.
/// Devolver vacío es honesto (la UI mostrará que no hay datos, no datos falsos).
#[cfg(target_os = "linux")]
fn list_apps_impl() -> Vec<AppInfo> {
    vec![]
}

/// Restos que una app deja repartidos, por bundle id y por nombre.
#[tauri::command]
pub async fn app_leftovers(bundle_id: String, name: String) -> LeftoverResult {
    tauri::async_runtime::spawn_blocking(move || {
        let cands = leftover_candidates(&bundle_id, &name);
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

/// Windows: los restos típicos son carpetas con el nombre del programa (o de su
/// fabricante) en AppData/ProgramData. `bundle_id` no aplica aquí (transporta el
/// UninstallString), así que se busca por NOMBRE.
#[cfg(target_os = "windows")]
fn leftover_candidates(_bundle_id: &str, name: &str) -> Vec<String> {
    if name.is_empty() {
        return vec![];
    }
    let h = home();
    let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Local"));
    let roaming = std::env::var("APPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Roaming"));
    let progdata = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into());
    vec![
        format!("{local}\\{name}"),
        format!("{roaming}\\{name}"),
        format!("{progdata}\\{name}"),
    ]
}

/// Linux: configuración y cachés bajo las rutas XDG.
#[cfg(target_os = "linux")]
fn leftover_candidates(_bundle_id: &str, name: &str) -> Vec<String> {
    if name.is_empty() {
        return vec![];
    }
    let h = home();
    vec![
        format!("{h}/.config/{name}"),
        format!("{h}/.cache/{name}"),
        format!("{h}/.local/share/{name}"),
    ]
}

/// macOS: restos repartidos por ~/Library, por bundle id y por nombre.
#[cfg(target_os = "macos")]
fn leftover_candidates(bundle_id: &str, name: &str) -> Vec<String> {
    let h = home();
    let mut cands: Vec<String> = Vec::new();
    {
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
    }
    cands
}

/// Envía a la Papelera del sistema (recuperable). Multiplataforma.
fn trash_one(path: &str) -> Result<(), String> {
    platform::move_to_trash(Path::new(path))
}

/// Desinstala una aplicación. El comportamiento correcto depende del sistema:
///
/// * **macOS**: una app es un paquete `.app` autocontenido → se manda a la
///   Papelera junto con sus restos (todo recuperable).
/// * **Windows**: los programas se reparten entre Program Files, el registro y
///   servicios. Borrar carpetas dejaría el sistema a medias, así que se **lanza
///   el desinstalador oficial** (igual que «Aplicaciones instaladas» de Windows)
///   y aparte se ofrecen los restos para enviarlos a la Papelera de reciclaje.
///
/// `uninstaller` es opcional: en Windows transporta el UninstallString del
/// registro (el frontend lo envía desde `bundle_id`).
#[tauri::command]
pub async fn uninstall_app(
    app_path: String,
    leftovers: Vec<String>,
    uninstaller: Option<String>,
) -> Result<TrashResult, String> {
    tauri::async_runtime::spawn_blocking(move || uninstall_impl(app_path, leftovers, uninstaller))
        .await
        .map_err(|e| e.to_string())
}

/// Windows: lanza el desinstalador oficial y manda los restos a la Papelera.
#[cfg(target_os = "windows")]
fn uninstall_impl(
    _app_path: String,
    leftovers: Vec<String>,
    uninstaller: Option<String>,
) -> TrashResult {
    use std::os::windows::process::CommandExt;

    let mut errors: Vec<String> = Vec::new();

    // 1) Desinstalador oficial. `raw_arg` evita que Rust re-entrecomille la
    //    cadena del registro (suele venir ya con comillas, o ser msiexec /X{...}).
    match uninstaller.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(cmd) => {
            // ÚNICA excepción a `platform::cmd`: el desinstalador es un proceso
            // interactivo que el usuario TIENE que ver para poder responderle.
            // Aquí ocultar la ventana dejaría un proceso invisible esperando.
            if let Err(e) = std::process::Command::new("cmd")
                .arg("/C")
                .raw_arg(&cmd)
                .spawn()
            {
                errors.push(format!("No se pudo abrir el desinstalador: {e}"));
            }
        }
        None => errors.push(
            "Este programa no publica un desinstalador; quítalo desde Configuración de Windows"
                .into(),
        ),
    }

    // 2) Restos → Papelera de reciclaje (solo dentro de AppData/ProgramData).
    let mut moved = 0u32;
    let mut moved_bytes = 0u64;
    for l in leftovers {
        let p = Path::new(&l);
        if !is_leftover_ok(p) {
            errors.push(format!("{l}: protegido"));
            continue;
        }
        if !p.exists() {
            continue;
        }
        let before = platform::dir_size(p);
        match trash_one(&l) {
            Ok(()) => {
                moved += 1;
                moved_bytes += before;
            }
            Err(e) => errors.push(format!("{l}: {e}")),
        }
    }

    TrashResult {
        moved,
        moved_bytes,
        errors,
    }
}

/// Guarda de seguridad para los restos en Windows: solo dentro de las carpetas
/// de datos de aplicación, y nunca la raíz de ninguna de ellas.
#[cfg(target_os = "windows")]
fn is_leftover_ok(p: &Path) -> bool {
    // `is_inside` normaliza antes de comparar. Importa especialmente aquí: el
    // nombre del programa sale del registro de Windows, es texto arbitrario de
    // terceros y podría contener `..` o separadores.
    ["LOCALAPPDATA", "APPDATA", "ProgramData"]
        .iter()
        .filter_map(|k| std::env::var(k).ok())
        .any(|r| crate::platform::is_inside(p, Path::new(&r)))
}

/// Linux: la desinstalación la debe hacer el gestor de paquetes del sistema.
#[cfg(target_os = "linux")]
fn uninstall_impl(
    _app_path: String,
    _leftovers: Vec<String>,
    _uninstaller: Option<String>,
) -> TrashResult {
    TrashResult {
        moved: 0,
        moved_bytes: 0,
        errors: vec![
            "En Linux, desinstala con el gestor de paquetes de tu distribución".to_string(),
        ],
    }
}

/// macOS: app + restos a la Papelera. Guardas: la app debe estar en
/// /Applications o ~/Applications y acabar en .app; los restos, bajo ~/Library.
#[cfg(target_os = "macos")]
fn uninstall_impl(
    app_path: String,
    leftovers: Vec<String>,
    _uninstaller: Option<String>,
) -> TrashResult {
    {
        let h = home();
        let mut targets: Vec<String> = Vec::new();

        // La app.
        let ok_app = app_path.ends_with(".app")
            && (app_path.starts_with("/Applications/")
                || (!h.is_empty() && app_path.starts_with(&format!("{h}/Applications/"))));
        if !ok_app {
            return TrashResult {
                moved: 0,
                moved_bytes: 0,
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
        let mut moved_bytes = 0u64;
        let mut errors = Vec::new();
        for tpath in targets {
            if !Path::new(&tpath).exists() {
                continue;
            }
            let before = du_bytes(&tpath);
            match trash_one(&tpath) {
                Ok(()) => {
                    moved += 1;
                    moved_bytes += before;
                }
                Err(e) => errors.push(format!("{tpath}: {e}")),
            }
        }
        TrashResult {
            moved,
            moved_bytes,
            errors,
        }
    }
}

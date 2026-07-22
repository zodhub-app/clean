// "Liberar espacio" — escaneo y limpieza de TODA la basura recuperable:
// cachés del sistema/apps, logs, Docker, Xcode, gestores de paquetes, modelos
// de IA y Papelera. La basura regenerable se BORRA de verdad (libera espacio al
// instante); Docker usa prune (sin volúmenes → datos a salvo); la Papelera se
// vacía. Rutas fijas y conocidas bajo el usuario → seguro.

use crate::platform;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct DevItem {
    key: String,
    kind: String, // "file" | "docker" | "trash"
    size: u64,
    paths: Vec<String>,
}

#[derive(Serialize, Default)]
pub struct CleanResult {
    /// Bytes que DEJAN DE OCUPAR disco. Solo lo eliminado de verdad.
    freed: u64,
    /// Bytes movidos a la Papelera. Van aparte de `freed` a propósito: mover
    /// algo a la Papelera no libera nada hasta que se vacía.
    moved_bytes: u64,
    /// Fallos de verdad: algo que el usuario pidió y no se pudo hacer.
    errors: Vec<String>,
    /// Elementos que se dejaron intactos por estar abiertos por otro programa.
    /// NO es un error: en carpetas temporales siempre hay alguno. Se devuelve
    /// como número (no como frase) para que el frontend lo traduzca.
    skipped_in_use: usize,
    /// Elementos que harían falta permisos de administrador para borrar.
    skipped_denied: usize,
    /// Elementos que fallaron por otro motivo (disco lleno, error de E/S…).
    /// Van aparte para no hacerlos pasar por «archivo en uso», que sería una
    /// explicación falsa y mandaría al usuario a buscar donde no es.
    skipped_failed: usize,
}

fn home() -> String {
    platform::home_dir().to_string_lossy().to_string()
}

/// Tamaño real de una ruta. Multiplataforma (antes `du -sk`, solo Unix).
fn du_bytes(path: &str) -> u64 {
    platform::dir_size(Path::new(path))
}

// Categorías de ficheros (borrado permanente; todas regenerables). Cambian
// según el sistema: Xcode/simuladores solo existen en macOS; NuGet y Gradle son
// lo típico en Windows. Las claves comunes se mantienen para no tocar el frontend.
#[cfg(target_os = "macos")]
const FILE_KEYS: &[&str] = &[
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

#[cfg(target_os = "windows")]
const FILE_KEYS: &[&str] = &[
    "user-caches",
    "browser-caches",
    "npm",
    "pnpm",
    "nuget",
    "gradle",
    "huggingface",
    "ollama",
    "lmstudio",
];

#[cfg(target_os = "linux")]
const FILE_KEYS: &[&str] = &[
    "user-caches",
    "browser-caches",
    "npm",
    "pnpm",
    "gradle",
    "huggingface",
    "ollama",
    "lmstudio",
];

/// Cachés de navegadores que NO viven en ~/Library/Caches (perfiles de Chromium
/// y Firefox). Solo carpetas de caché puras (no cookies/sesiones).
fn browser_cache_paths(h: &str) -> Vec<String> {
    let mut out = Vec::new();

    #[cfg(target_os = "macos")]
    let chromium = [
        format!("{h}/Library/Application Support/Google/Chrome"),
        format!("{h}/Library/Application Support/BraveSoftware/Brave-Browser"),
        format!("{h}/Library/Application Support/Microsoft Edge"),
        format!("{h}/Library/Application Support/Chromium"),
        format!("{h}/Library/Application Support/Vivaldi"),
    ];

    // En Windows los perfiles de Chromium viven en %LOCALAPPDATA%.
    #[cfg(target_os = "windows")]
    let chromium = {
        let l = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Local"));
        [
            format!("{l}\\Google\\Chrome\\User Data"),
            format!("{l}\\BraveSoftware\\Brave-Browser\\User Data"),
            format!("{l}\\Microsoft\\Edge\\User Data"),
            format!("{l}\\Chromium\\User Data"),
            format!("{l}\\Vivaldi\\User Data"),
        ]
    };

    #[cfg(target_os = "linux")]
    let chromium = [
        format!("{h}/.config/google-chrome"),
        format!("{h}/.config/BraveSoftware/Brave-Browser"),
        format!("{h}/.config/microsoft-edge"),
        format!("{h}/.config/chromium"),
        format!("{h}/.config/vivaldi"),
    ];
    // Subcarpetas de caché dentro de cada perfil. Van como tramos sueltos y se
    // unen con `Path::join`: concatenar con "/" a mano generaba rutas mixtas
    // tipo `C:\...\Default/Cache`, que funcionan por casualidad pero rompen
    // cualquier comparación de cadenas y se ven fatal en la interfaz.
    let subs: [&[&str]; 6] = [
        &["Cache"],
        &["Code Cache"],
        &["GPUCache"],
        &["DawnCache"],
        &["GrShaderCache"],
        &["Service Worker", "CacheStorage"],
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
                    for parts in &subs {
                        let mut c = p.clone();
                        for part in *parts {
                            c.push(*part);
                        }
                        if c.exists() {
                            out.push(c.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    #[cfg(target_os = "macos")]
    let ff = format!("{h}/Library/Application Support/Firefox/Profiles");
    #[cfg(target_os = "windows")]
    let ff = {
        let l = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Local"));
        format!("{l}\\Mozilla\\Firefox\\Profiles")
    };
    #[cfg(target_os = "linux")]
    let ff = format!("{h}/.cache/mozilla/firefox");

    if let Ok(rd) = std::fs::read_dir(&ff) {
        for e in rd.flatten() {
            let c = e.path().join("cache2");
            if c.exists() {
                out.push(c.to_string_lossy().to_string());
            }
        }
    }
    out
}

/// Mueve un elemento a la Papelera del sistema (recuperable). Multiplataforma.
fn trash_path(path: &str) -> Result<(), String> {
    platform::move_to_trash(Path::new(path))
}

/// Quita de la lista las rutas que ya están DENTRO de otra de la lista.
///
/// Sin esto, el titular «Recuperable» podía contar los mismos bytes dos veces:
/// en Linux, por ejemplo, `user-caches` es `~/.cache`, que CONTIENE
/// `~/.cache/huggingface` y `~/.cache/lm-studio`, que además son categorías
/// propias. El usuario veía sumados dos veces los mismos gigas.
///
/// Se ordena de menos profunda a más profunda y se descarta toda ruta contenida
/// en una anterior: se queda la más externa, que es la que se va a borrar.
fn drop_nested(mut paths: Vec<String>) -> Vec<String> {
    paths.sort_by_key(|p| p.matches(std::path::MAIN_SEPARATOR).count());
    let mut kept: Vec<String> = Vec::new();
    for p in paths {
        let pp = Path::new(&p);
        if kept
            .iter()
            .any(|k| platform::is_inside(pp, Path::new(k)))
        {
            continue; // ya cuenta dentro de otra ruta de la lista
        }
        kept.push(p);
    }
    kept
}

/// Tamaño de la Papelera.
///
/// En Windows, `C:\$Recycle.Bin` está protegida y recorrerla a mano devuelve
/// una cifra ridícula (unos pocos bytes), que es peor que no dar ninguna:
/// parece que la papelera está vacía cuando no lo está. Se pregunta al Shell,
/// que es quien sabe de verdad lo que hay dentro.
#[cfg(target_os = "windows")]
fn trash_size(_paths: &[String]) -> u64 {
    const PS: &str = "$s=(New-Object -ComObject Shell.Application).NameSpace(0xA); \
                      if($null -eq $s){0} else { \
                      ($s.Items() | ForEach-Object { $_.Size } | Measure-Object -Sum).Sum }";
    let out = match crate::platform::cmd("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", PS])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return 0,
    };
    String::from_utf8_lossy(&out.stdout)
        .trim()
        .parse::<f64>()
        .map(|v| v.max(0.0) as u64)
        .unwrap_or(0)
}

#[cfg(not(target_os = "windows"))]
fn trash_size(paths: &[String]) -> u64 {
    paths.iter().map(|p| du_bytes(p)).sum()
}

#[cfg(target_os = "windows")]
fn candidates(key: &str, h: &str) -> Vec<String> {
    let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Local"));
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Roaming"));
    match key {
        "user-caches" => vec![format!("{local}\\Temp")],
        "browser-caches" => browser_cache_paths(h),
        "npm" => vec![
            format!("{h}\\.npm\\_cacache"),
            format!("{appdata}\\npm-cache\\_cacache"),
        ],
        "pnpm" => vec![format!("{local}\\pnpm\\store"), format!("{h}\\.pnpm-store")],
        "nuget" => vec![format!("{h}\\.nuget\\packages")],
        "gradle" => vec![format!("{h}\\.gradle\\caches")],
        "huggingface" => vec![format!("{h}\\.cache\\huggingface")],
        "ollama" => vec![format!("{h}\\.ollama\\models")],
        "lmstudio" => vec![format!("{h}\\.cache\\lm-studio"), format!("{h}\\.lmstudio")],
        // Papelera de reciclaje: se lista para poder vaciarla. El tamaño puede
        // quedarse corto si Windows no deja leer parte de la carpeta; lo que se
        // reporta como liberado se mide con el espacio libre real antes/después.
        "trash" => {
            let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
            vec![format!("{drive}\\$Recycle.Bin")]
        }
        _ => vec![],
    }
}

#[cfg(target_os = "linux")]
fn candidates(key: &str, h: &str) -> Vec<String> {
    match key {
        "user-caches" => vec![format!("{h}/.cache")],
        "browser-caches" => browser_cache_paths(h),
        "npm" => vec![format!("{h}/.npm/_cacache")],
        "pnpm" => vec![format!("{h}/.local/share/pnpm/store"), format!("{h}/.pnpm-store")],
        "gradle" => vec![format!("{h}/.gradle/caches")],
        "huggingface" => vec![format!("{h}/.cache/huggingface")],
        "ollama" => vec![format!("{h}/.ollama/models")],
        "lmstudio" => vec![format!("{h}/.cache/lm-studio"), format!("{h}/.lmstudio")],
        "trash" => vec![format!("{h}/.local/share/Trash")],
        _ => vec![],
    }
}

#[cfg(target_os = "macos")]
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
    // `drop_nested` evita contar dos veces una carpeta que ya está dentro de
    // otra de la misma categoría (ver su documentación).
    drop_nested(
        candidates(key, h)
            .into_iter()
            .filter(|p| Path::new(p).exists())
            .collect(),
    )
}

fn parse_size(s: &str) -> u64 {
    let s = s.trim();
    let num: String = s.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    let unit = s[num.len()..].trim().to_uppercase();
    let n: f64 = num.parse().unwrap_or(0.0);
    // Docker escribe en decimal (KB/MB/GB), pero acepta también las binarias.
    // El caso `_ => 1.0` de antes era una trampa: una unidad no reconocida se
    // trataba como BYTES, así que «1.5MiB» se convertía en 1 byte y la cifra
    // salía un millón de veces más pequeña sin que nadie se enterara. Ahora una
    // unidad desconocida devuelve 0, que al menos es visiblemente raro.
    let mult = match unit.as_str() {
        "B" | "" => 1.0,
        "KB" => 1e3,
        "MB" => 1e6,
        "GB" => 1e9,
        "TB" => 1e12,
        "KIB" => 1024.0,
        "MIB" => 1024.0 * 1024.0,
        "GIB" => 1024.0 * 1024.0 * 1024.0,
        "TIB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => return 0,
    };
    (n * mult) as u64
}

fn docker_reclaimable() -> Option<u64> {
    let out = crate::platform::cmd("docker").args(["system", "df"]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut total = 0u64;
    for line in text.lines().skip(1) {
        // Los VOLÚMENES no se cuentan: el botón ejecuta `docker system prune -af`
        // SIN `--volumes`, a propósito, porque ahí viven los datos de las bases
        // de datos y borrarlos sin avisar sería catastrófico. Incluirlos en el
        // «recuperable» era prometer un espacio que la app no iba a liberar.
        if line.to_ascii_lowercase().contains("volumes") {
            continue;
        }
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
        for &key in FILE_KEYS {
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
            let size: u64 = trash_size(&trash);
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

/// Windows: `Clear-RecycleBin` es la forma oficial (y segura) de vaciar la
/// Papelera de reciclaje. Vacía la de todas las unidades.
#[cfg(target_os = "windows")]
fn empty_trash() -> Result<(), String> {
    let out = crate::platform::cmd("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; exit 0",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Linux: depende del escritorio; se informa en vez de arriesgar.
#[cfg(target_os = "linux")]
fn empty_trash() -> Result<(), String> {
    Err("Vaciar la Papelera todavía no está disponible en Linux".into())
}

#[cfg(target_os = "macos")]
fn empty_trash() -> Result<(), String> {
    // Vacía la Papelera vía Finder; ignora el -128 (papelera ya vacía).
    let script = "tell application \"Finder\"\n\
                  try\n\
                  empty the trash\n\
                  on error em number en\n\
                  if en is not -128 then error em number en\n\
                  end try\n\
                  end tell";
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

/// Escapa una cadena para incrustarla en un literal de AppleScript
/// (`do shell script "..."`): primero las barras invertidas, luego las comillas.
#[cfg(target_os = "macos")]
fn applescript_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// ¿Es seguro barrer esta carpeta como root? Filtro deliberadamente estricto:
/// debe ser una carpeta existente, dentro de un ámbito permitido (la Library del
/// usuario o las cachés/logs del sistema), sin caracteres que puedan romper el
/// script, y nunca una ruta peligrosamente corta o de datos.
#[cfg(target_os = "macos")]
fn admin_path_ok(p: &str, h: &str) -> bool {
    if !Path::new(p).is_dir() {
        return false;
    }
    // Solo caracteres seguros para incrustar entre comillas dobles en el shell.
    if p.contains(|c: char| matches!(c, '"' | '\'' | '\\' | '$' | '`' | '*' | '\n' | '\r'))
        || p.contains("..")
    {
        return false;
    }
    let lib = format!("{h}/Library/");
    let in_user_lib = p.starts_with(&lib);
    let in_sys = p == "/Library/Caches"
        || p == "/Library/Logs"
        || p.starts_with("/Library/Caches/")
        || p.starts_with("/Library/Logs/");
    (in_user_lib || in_sys) && p.len() > 8 && p != "/Library"
}

/// Carpetas de basura del SISTEMA que la limpieza normal no puede tocar por
/// permisos: cachés y logs de root (dentro de las carpetas del usuario y en
/// `/Library`). Solo cachés/logs regenerables; jamás datos ni modelos de IA.
#[cfg(target_os = "macos")]
fn admin_targets(h: &str) -> Vec<String> {
    let mut dirs: Vec<String> = Vec::new();
    // Las mismas carpetas de caché/log del usuario, para barrer lo que dentro
    // pertenece a root y la pasada normal dejó intacto (los "N necesitan admin").
    for key in [
        "user-caches",
        "browser-caches",
        "logs",
        "xcode-derived",
        "xcode-archives",
        "xcode-devicesupport",
        "coresimulator",
    ] {
        dirs.extend(existing(key, h));
    }
    // Cachés y logs del propio sistema (fuera del usuario; exigen admin).
    dirs.push("/Library/Caches".to_string());
    dirs.push("/Library/Logs".to_string());

    // Filtro de seguridad + sin duplicados.
    let mut seen = std::collections::HashSet::new();
    dirs.into_iter()
        .filter(|p| admin_path_ok(p, h))
        .filter(|p| seen.insert(p.clone()))
        .collect()
}

/// Fuera de macOS aún no está: en Windows/Linux la elevación y las rutas de
/// caché del sistema son distintas. Se dice claramente en vez de fingir.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn clean_system_admin() -> Result<CleanResult, String> {
    Err("La limpieza con permisos de administrador solo está disponible en macOS por ahora".into())
}

/// Limpieza CON PERMISOS DE ADMINISTRADOR: vacía el contenido de las cachés y
/// logs del sistema (propiedad de root) que la limpieza normal deja intactas —
/// justo lo que la app reporta como «necesitan permisos de administrador». Pide
/// la contraseña UNA vez (osascript) y reporta el espacio realmente liberado
/// (libre antes/después, la misma fuente que el panel). Conserva las carpetas;
/// solo borra su contenido regenerable. Nunca toca datos del usuario.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn clean_system_admin() -> Result<CleanResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let h = home();
        let targets = admin_targets(&h);
        if targets.is_empty() {
            return Ok(CleanResult::default());
        }

        let (_t0, _u0, free_before) = crate::storage::disk_usage();

        // Un solo comando elevado: por cada carpeta, borra su CONTENIDO
        // (mindepth 1, se conserva la carpeta). `find … -delete` va en
        // profundidad y no sigue enlaces simbólicos; los errores por fichero
        // suelto se ignoran para no abortar todo el barrido.
        // `|| true` por carpeta: si un fichero suelto no se puede borrar, `find`
        // devuelve error y `do shell script` lo tomaría como fallo TOTAL. Con
        // esto seguimos con el resto y no reportamos un error falso; lo liberado
        // se mide igualmente por el espacio libre antes/después.
        let shell = targets
            .iter()
            .map(|d| format!("/usr/bin/find \"{d}\" -mindepth 1 -delete 2>/dev/null || true"))
            .collect::<Vec<_>>()
            .join("; ");
        let script = format!(
            "do shell script \"{}\" with administrator privileges",
            applescript_escape(&shell)
        );

        let out = crate::platform::cmd("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            // -128 = el usuario canceló el diálogo de contraseña: no es un fallo.
            if err.contains("-128") || err.to_lowercase().contains("user canceled") {
                return Ok(CleanResult::default());
            }
            return Err(err);
        }

        let (_t1, _u1, free_after) = crate::storage::disk_usage();
        Ok(CleanResult {
            freed: free_after.saturating_sub(free_before),
            ..Default::default()
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Borra permanentemente las rutas de una categoría de ficheros. Devuelve el
/// espacio liberado (tamaño medido antes) y los errores.
fn wipe_files(key: &str, h: &str) -> crate::platform::Wipe {
    let mut total = crate::platform::Wipe::default();
    for p in existing(key, h) {
        let path = Path::new(&p);
        // Dos decisiones importantes aquí:
        //
        // 1. Borrado TOLERANTE: lo que esté en uso se salta y se sigue con el
        //    resto, en lugar de abortar y no limpiar nada (ver platform::wipe).
        //
        // 2. `keep_root = true` SIEMPRE: se vacía el contenido pero la carpeta
        //    contenedora se queda. Antes se intentaba adivinar cuáles eran «del
        //    sistema» por su nombre, lo cual fallaba con `Cache`, `GPUCache`,
        //    `.gradle\caches`… y borrar el directorio de caché de un navegador
        //    abierto le rompe el perfil hasta que reinicia. Conservarlo no
        //    cuesta nada (una carpeta vacía ocupa cero) y evita el problema.
        total.add(crate::platform::wipe(path, true));
    }
    total
}

/// Tamaño de la Papelera JUSTO ANTES de vaciarla.
///
/// Al vaciar la Papelera es el sistema quien borra, así que no podemos contar
/// los bytes uno a uno como en el resto. Lo honesto es medir cuánto había
/// dentro inmediatamente antes: eso es exactamente lo que se va a eliminar.
fn trash_bytes(h: &str) -> u64 {
    trash_size(&existing("trash", h))
}

#[tauri::command]
pub async fn clean_dev(key: String) -> Result<CleanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let h = home();
        if key == "docker" {
            return match crate::platform::cmd("docker").args(["system", "prune", "-af"]).output() {
                Ok(o) if o.status.success() => CleanResult {
                    freed: parse_reclaimed(&String::from_utf8_lossy(&o.stdout)),
                    ..Default::default()
                },
                Ok(o) => CleanResult {
                    errors: vec![String::from_utf8_lossy(&o.stderr).trim().to_string()],
                    ..Default::default()
                },
                Err(e) => CleanResult {
                    errors: vec![e.to_string()],
                    ..Default::default()
                },
            };
        }
        // Copias de iOS: van a la Papelera, no se borran (son valiosas y el
        // usuario debe poder recuperarlas). Mover a la Papelera NO libera
        // espacio, así que `freed` se queda a cero y se informa aparte de
        // cuánto se ha movido. Antes se devolvía el tamaño movido en `freed` y
        // la interfaz cantaba «Liberados X»: era falso y el propio comentario
        // de este bloque lo reconocía.
        if key == "ios-backups" {
            let mut moved_bytes = 0u64;
            let mut errors = Vec::new();
            for p in existing("ios-backups", &h) {
                let before = du_bytes(&p);
                match trash_path(&p) {
                    Ok(()) => moved_bytes += before,
                    Err(e) => errors.push(format!("{p}: {e}")),
                }
            }
            return CleanResult {
                freed: 0,
                moved_bytes,
                errors,
                ..Default::default()
            };
        }

        // Ficheros o Papelera.
        //
        // Se informa SOLO de lo que la app elimina de verdad, contado byte a
        // byte. Antes se comparaba con el espacio libre del disco antes/después
        // y se tomaba la cifra mayor; eso hacía que la app se apuntara todo lo
        // que el sistema soltaba por su cuenta en ese momento (espacio
        // purgable, instantáneas APFS…) y anunciara decenas de gigas cuando
        // había borrado unos pocos. Una cifra inflada es peor que una modesta.
        let mut errors = Vec::new();
        let mut w = crate::platform::Wipe::default();
        let freed;
        if key == "trash" {
            let inside = trash_bytes(&h); // medido ANTES de vaciarla
            freed = match empty_trash() {
                Ok(()) => inside,
                Err(e) => {
                    errors.push(e);
                    0 // si no se pudo vaciar, no se ha liberado nada
                }
            };
        } else {
            w = wipe_files(&key, &h);
            freed = w.freed;
        }
        CleanResult {
            freed,
            moved_bytes: 0, // este camino borra de verdad, no mueve nada
            errors,
            skipped_in_use: w.in_use,
            skipped_denied: w.denied,
            skipped_failed: w.failed,
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
        let mut errors = Vec::new();
        let mut w = crate::platform::Wipe::default();
        for key in FILE_KEYS {
            w.add(wipe_files(key, &h));
        }

        // La Papelera se mide antes de vaciarla; el resto se cuenta al borrar.
        // Nada de deltas de espacio libre: ver el comentario en `clean_dev`.
        let trash = trash_bytes(&h);
        let freed = match empty_trash() {
            Ok(()) => w.freed + trash,
            Err(e) => {
                errors.push(e);
                w.freed
            }
        };

        CleanResult {
            freed,
            moved_bytes: 0, // este camino borra de verdad, no mueve nada
            errors,
            skipped_in_use: w.in_use,
            skipped_denied: w.denied,
            skipped_failed: w.failed,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

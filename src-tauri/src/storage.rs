// Panel de Almacenamiento (Fase 0). SOLO LECTURA: no borra nada.
//   - Uso global del disco (total/usado/libre).
//   - Desglose por volúmenes APFS (System, Data, VM, Preboot…) leído de
//     `diskutil apfs list` — los mismos datos que Utilidad de Discos.
//   - "Áreas" que más ocupan (cachés, dev, IA, Descargas, Papelera…), medidas
//     con `du` (rápido y honesto: cuenta bloques reales en disco).
//   - Nº de instantáneas APFS locales (adelanto de la Fase 2).
//   - Histórico: guarda una muestra (throttled) para ver el crecimiento.

use crate::platform;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
#[cfg(target_os = "macos")]
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::Disks;

#[derive(Serialize)]
pub struct VolumeInfo {
    name: String,
    role: String,
    consumed: u64,
}

#[derive(Serialize)]
pub struct AreaInfo {
    key: String,
    path: String,
    size: u64,
    exists: bool,
}

#[derive(Serialize)]
pub struct StorageStats {
    total: u64,
    used: u64,
    free: u64,
    snapshots: u32,
    volumes: Vec<VolumeInfo>,
    areas: Vec<AreaInfo>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Sample {
    t: u64, // unix secs
    total: u64,
    used: u64,
    free: u64,
}

fn home() -> String {
    platform::home_dir().to_string_lossy().to_string()
}
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Disco principal: el volumen del sistema ("/" en macOS/Linux, la unidad del
/// sistema en Windows). Si no se identifica, el de mayor capacidad.
fn disk_usage() -> (u64, u64, u64) {
    let disks = Disks::new_with_refreshed_list();
    #[cfg(target_os = "windows")]
    let root = {
        let d = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        PathBuf::from(format!("{d}\\"))
    };
    #[cfg(not(target_os = "windows"))]
    let root = PathBuf::from("/");

    let main = disks
        .list()
        .iter()
        .find(|d| d.mount_point() == root.as_path());
    let chosen = main.or_else(|| disks.list().iter().max_by_key(|d| d.total_space()));
    match chosen {
        Some(d) => {
            let t = d.total_space();
            let a = d.available_space();
            (t, t.saturating_sub(a), a)
        }
        None => (0, 0, 0),
    }
}

/// Tamaño real de un área. Multiplataforma (antes `du -sk`, solo Unix).
fn area_size(path: &str) -> (u64, bool) {
    let p = Path::new(path);
    if !p.exists() {
        return (0, false);
    }
    (platform::dir_size(p), true)
}

/// Áreas que más suelen ocupar, según el sistema. Las claves (`key`) se
/// mantienen entre sistemas para que el frontend no tenga que cambiar.
fn areas() -> Vec<AreaInfo> {
    let h = home();

    #[cfg(target_os = "macos")]
    let specs: Vec<(&str, String)> = vec![
        ("caches", format!("{h}/Library/Caches")),
        ("xcode", format!("{h}/Library/Developer/Xcode/DerivedData")),
        ("docker", format!("{h}/Library/Containers/com.docker.docker")),
        ("huggingface", format!("{h}/.cache/huggingface")),
        ("ollama", format!("{h}/.ollama")),
        ("downloads", format!("{h}/Downloads")),
        ("trash", format!("{h}/.Trash")),
        ("applications", "/Applications".to_string()),
    ];

    #[cfg(target_os = "windows")]
    let specs: Vec<(&str, String)> = {
        let local =
            std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Local"));
        let appdata =
            std::env::var("APPDATA").unwrap_or_else(|_| format!("{h}\\AppData\\Roaming"));
        vec![
            ("caches", format!("{local}\\Temp")),
            ("docker", format!("{local}\\Docker")),
            ("huggingface", format!("{h}\\.cache\\huggingface")),
            ("ollama", format!("{h}\\.ollama")),
            ("downloads", format!("{h}\\Downloads")),
            ("nuget", format!("{h}\\.nuget\\packages")),
            ("npm", format!("{appdata}\\npm-cache")),
            (
                "applications",
                std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into()),
            ),
        ]
    };

    #[cfg(target_os = "linux")]
    let specs: Vec<(&str, String)> = vec![
        ("caches", format!("{h}/.cache")),
        ("docker", format!("{h}/.local/share/docker")),
        ("huggingface", format!("{h}/.cache/huggingface")),
        ("ollama", format!("{h}/.ollama")),
        ("downloads", format!("{h}/Downloads")),
        ("trash", format!("{h}/.local/share/Trash")),
        ("applications", "/opt".to_string()),
    ];

    specs
        .iter()
        .map(|(k, p)| {
            let (size, exists) = area_size(p);
            AreaInfo {
                key: k.to_string(),
                path: p.clone(),
                size,
                exists,
            }
        })
        .collect()
}

/// Volúmenes del equipo. En macOS se leen los contenedores APFS (roles System,
/// Data, VM, Preboot…). Fuera de macOS no existe ese concepto, así que se listan
/// las unidades/puntos de montaje reales con su espacio consumido.
#[cfg(target_os = "macos")]
fn volumes() -> Vec<VolumeInfo> {
    apfs_volumes()
}

#[cfg(not(target_os = "macos"))]
fn volumes() -> Vec<VolumeInfo> {
    Disks::new_with_refreshed_list()
        .list()
        .iter()
        .map(|d| VolumeInfo {
            name: d.mount_point().to_string_lossy().to_string(),
            role: d.file_system().to_string_lossy().to_string(),
            consumed: d.total_space().saturating_sub(d.available_space()),
        })
        .collect()
}

/// Parsea `diskutil apfs list`: por cada volumen, rol + nombre + consumo.
#[cfg(target_os = "macos")]
fn apfs_volumes() -> Vec<VolumeInfo> {
    let out = match Command::new("diskutil").arg("apfs").arg("list").output() {
        Ok(o) => o,
        Err(_) => return vec![],
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut vols = Vec::new();
    let (mut name, mut role) = (String::new(), String::new());
    for line in text.lines() {
        let l = line.trim();
        if let Some(rest) = l.strip_prefix("APFS Volume Disk (Role):") {
            // "disk3s1 (System)" -> rol entre los últimos paréntesis
            role = rest
                .rfind('(')
                .zip(rest.rfind(')'))
                .and_then(|(o, c)| if c > o { Some(rest[o + 1..c].trim().to_string()) } else { None })
                .unwrap_or_default();
        } else if let Some(rest) = l.strip_prefix("Name:") {
            let n = rest.trim();
            name = n.split(" (").next().unwrap_or(n).trim().to_string();
        } else if let Some(rest) = l.strip_prefix("Capacity Consumed:") {
            // "699,761,000,000 B (699.8 GB)" -> dígitos antes de " B"
            let consumed = rest
                .find(" B")
                .map(|b| {
                    rest[..b]
                        .chars()
                        .filter(|c| c.is_ascii_digit())
                        .collect::<String>()
                })
                .and_then(|d| d.parse::<u64>().ok())
                .unwrap_or(0);
            if !name.is_empty() {
                vols.push(VolumeInfo {
                    name: std::mem::take(&mut name),
                    role: std::mem::take(&mut role),
                    consumed,
                });
            }
        }
    }
    vols
}

/// Instantáneas locales. Solo macOS por ahora: en Windows el equivalente son
/// las Instantáneas de volumen (VSS) y requieren admin — se abordará aparte.
/// Devolver 0 es honesto: significa «no hay dato», y la UI no inventa nada.
#[cfg(not(target_os = "macos"))]
fn snapshot_count() -> u32 {
    0
}

#[cfg(target_os = "macos")]
fn snapshot_count() -> u32 {
    match Command::new("tmutil")
        .arg("listlocalsnapshots")
        .arg("/")
        .output()
    {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .lines()
            .filter(|l| l.contains("com.apple.TimeMachine"))
            .count() as u32,
        Err(_) => 0,
    }
}

/// Dónde se guarda el histórico de almacenamiento, según el sistema:
///   macOS   → ~/Library/Application Support/com.viper.macup/
///   Windows → %APPDATA%\com.viper.macup\
///   Linux   → ~/.local/share/com.viper.macup/
fn history_path() -> Option<PathBuf> {
    let h = platform::home_dir();
    if h.as_os_str().is_empty() {
        return None;
    }

    #[cfg(target_os = "macos")]
    let dir = h.join("Library/Application Support/com.viper.macup");
    #[cfg(target_os = "windows")]
    let dir = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| h.join("AppData/Roaming"))
        .join("com.viper.macup");
    #[cfg(target_os = "linux")]
    let dir = h.join(".local/share/com.viper.macup");

    Some(dir.join("storage-history.json"))
}
fn read_history() -> Vec<Sample> {
    history_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
/// Añade una muestra como mucho una vez cada ~12 h (para ver el crecimiento
/// real sin ensuciar con muchas muestras del mismo día).
fn record_sample(total: u64, used: u64, free: u64) {
    let path = match history_path() {
        Some(p) => p,
        None => return,
    };
    let mut samples = read_history();
    let now = now_secs();
    let recent = samples.last().map_or(false, |s| now.saturating_sub(s.t) < 12 * 3600);
    if recent {
        return;
    }
    samples.push(Sample { t: now, total, used, free });
    let n = samples.len();
    if n > 400 {
        samples.drain(0..n - 400);
    }
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&path, serde_json::to_string(&samples).unwrap_or_default());
}

#[tauri::command]
pub async fn storage_stats() -> StorageStats {
    tauri::async_runtime::spawn_blocking(|| {
        let (total, used, free) = disk_usage();
        record_sample(total, used, free);
        StorageStats {
            total,
            used,
            free,
            snapshots: snapshot_count(),
            volumes: volumes(),
            areas: areas(),
        }
    })
    .await
    .unwrap_or(StorageStats {
        total: 0,
        used: 0,
        free: 0,
        snapshots: 0,
        volumes: vec![],
        areas: vec![],
    })
}

#[tauri::command]
pub fn storage_history() -> Vec<Sample> {
    read_history()
}

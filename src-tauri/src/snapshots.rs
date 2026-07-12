// Fase 2 — Instantáneas APFS / Time Machine locales.
// macOS guarda "copias locales" de Time Machine dentro del disco. Se acumulan y
// ocupan espacio recuperable (parte de lo que Utilidad de Discos cuenta como
// usado). macOS NO expone el tamaño exacto por instantánea, así que aquí:
//   - Listamos cuántas hay y de qué fecha (para entender de dónde sale).
//   - Al liberar, medimos el espacio libre antes/después y reportamos lo real.
// Liberar usa `tmutil thinlocalsnapshots` con permiso de administrador.

use serde::Serialize;
use std::path::Path;
use std::process::Command;
use sysinfo::Disks;

#[derive(Serialize)]
pub struct Snapshot {
    name: String,
    date: String, // "YYYY-MM-DD-HHMMSS"
}

#[derive(Serialize)]
pub struct ThinResult {
    freed: u64,
    count_before: u32,
    count_after: u32,
}

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

fn parse_snapshots() -> Vec<Snapshot> {
    let text = Command::new("tmutil")
        .arg("listlocalsnapshots")
        .arg("/")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();
    text.lines()
        .filter_map(|l| {
            let l = l.trim();
            let idx = l.find("com.apple.TimeMachine.")?;
            let rest = &l[idx + "com.apple.TimeMachine.".len()..];
            let date = rest.strip_suffix(".local").unwrap_or(rest).to_string();
            Some(Snapshot {
                name: l.to_string(),
                date,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn list_snapshots() -> Vec<Snapshot> {
    tauri::async_runtime::spawn_blocking(parse_snapshots)
        .await
        .unwrap_or_default()
}

/// Libera TODAS las instantáneas locales (thin agresivo, urgencia 4). Pide
/// contraseña de administrador. Reporta el espacio realmente recuperado.
#[tauri::command]
pub async fn thin_snapshots() -> Result<ThinResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let count_before = parse_snapshots().len() as u32;
        let before = free_bytes();

        let script = "do shell script \"/usr/bin/tmutil thinlocalsnapshots / 999999999999999 4\" with administrator privileges";
        let out = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }

        // Pequeña espera para que el sistema refleje el espacio liberado.
        std::thread::sleep(std::time::Duration::from_millis(900));
        let after = free_bytes();
        let count_after = parse_snapshots().len() as u32;

        Ok(ThinResult {
            freed: after.saturating_sub(before),
            count_before,
            count_after,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

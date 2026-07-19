use crate::system::AppState;
use serde::Serialize;
#[cfg(target_os = "macos")]

#[derive(Serialize)]
pub struct MemoryStats {
    total: u64,
    used: u64,
    available: u64,
    free: u64,
    swap_used: u64,
    swap_total: u64,
    // Desglose (bytes) leído de vm_stat.
    wired: u64,
    active: u64,
    inactive: u64,
    compressed: u64,
    cached: u64,
}

#[tauri::command]
pub fn memory_stats(state: tauri::State<AppState>) -> MemoryStats {
    let mut sys = state.sys.lock().unwrap_or_else(|e| e.into_inner());
    sys.refresh_memory();

    let (wired, active, inactive, compressed, cached) = mem_breakdown();

    MemoryStats {
        total: sys.total_memory(),
        used: sys.used_memory(),
        available: sys.available_memory(),
        free: sys.free_memory(),
        swap_used: sys.used_swap(),
        swap_total: sys.total_swap(),
        wired,
        active,
        inactive,
        compressed,
        cached,
    }
}

/// Desglose de memoria por categorías. En macOS se lee de `vm_stat`; fuera de
/// macOS esas categorías (wired/active/inactive/compressed/cached) no existen tal
/// cual, así que devolvemos ceros y el frontend oculta el desglose (honestidad).
#[cfg(target_os = "macos")]
fn mem_breakdown() -> (u64, u64, u64, u64, u64) {
    parse_vm_stat()
}

#[cfg(not(target_os = "macos"))]
fn mem_breakdown() -> (u64, u64, u64, u64, u64) {
    (0, 0, 0, 0, 0)
}

/// Returns (wired, active, inactive, compressed, cached) in bytes from `vm_stat`.
/// Inactive groups inactive + speculative + purgeable (reclaimable). Degrades to
/// zeros if vm_stat isn't available.
#[cfg(target_os = "macos")]
fn parse_vm_stat() -> (u64, u64, u64, u64, u64) {
    let output = match crate::platform::cmd("vm_stat").output() {
        Ok(o) => o,
        Err(_) => return (0, 0, 0, 0, 0),
    };
    let text = String::from_utf8_lossy(&output.stdout);

    // Page size (16384 on Apple Silicon, 4096 on Intel).
    let mut page_size: u64 = 4096;
    if let Some(idx) = text.find("page size of ") {
        let rest = &text[idx + "page size of ".len()..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(ps) = digits.parse::<u64>() {
            if ps > 0 {
                page_size = ps;
            }
        }
    }

    // pages for a given "key:" line
    let pages = |key: &str| -> u64 {
        for line in text.lines() {
            if let Some(rest) = line.trim().strip_prefix(key) {
                let v: String = rest.chars().filter(|c| c.is_ascii_digit()).collect();
                return v.parse::<u64>().unwrap_or(0);
            }
        }
        0
    };

    let wired = pages("Pages wired down:") * page_size;
    let active = pages("Pages active:") * page_size;
    let inactive = (pages("Pages inactive:")
        + pages("Pages speculative:")
        + pages("Pages purgeable:"))
        * page_size;
    let compressed = pages("Pages occupied by compressor:") * page_size;
    let cached = pages("File-backed pages:") * page_size;

    (wired, active, inactive, compressed, cached)
}

/// Frees inactive/cached memory via `purge` (needs admin). macOS shows the
/// standard password dialog. Rarely necessary — surfaced honestly in the UI.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn purge_memory() -> Result<(), String> {
    let out = crate::platform::cmd("osascript")
        .arg("-e")
        .arg("do shell script \"/usr/sbin/purge\" with administrator privileges")
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Fuera de macOS la purga manual de RAM no aplica del mismo modo (el SO ya la
/// gestiona). Se devuelve un error claro; el frontend oculta el botón según el SO.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn purge_memory() -> Result<(), String> {
    Err("La liberación manual de memoria solo está disponible en macOS".into())
}

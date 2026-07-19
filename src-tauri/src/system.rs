use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Components, Disks, ProcessRefreshKind, ProcessesToUpdate, System};

/// Shared system handle so CPU deltas are measured between polls.
pub struct AppState {
    pub sys: Mutex<System>,
}

impl AppState {
    pub fn new() -> Self {
        let mut sys = System::new();
        // Prime CPU so the first real reading has a baseline to diff against.
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        AppState {
            sys: Mutex::new(sys),
        }
    }
}

#[derive(Serialize)]
pub struct SystemStats {
    cpu_usage: f32,
    mem_used: u64,
    mem_total: u64,
    swap_used: u64,
    swap_total: u64,
    disk_used: u64,
    disk_total: u64,
    uptime_secs: u64,
    /// Hottest sensor (°C). None si el Mac no expone sensores (no se inventa).
    temp: Option<f32>,
    host_name: String,
}

#[tauri::command]
pub fn system_stats(state: tauri::State<AppState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap_or_else(|e| e.into_inner());
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let mem_used = sys.used_memory();
    let mem_total = sys.total_memory();
    let swap_used = sys.used_swap();
    let swap_total = sys.total_swap();

    let disks = Disks::new_with_refreshed_list();
    let mut disk_total = 0u64;
    let mut disk_used = 0u64;

    // Volumen principal: "/" en macOS/Linux; la unidad del sistema (p. ej. C:\)
    // en Windows.
    #[cfg(target_os = "windows")]
    let root = {
        let d = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        std::path::PathBuf::from(format!("{d}\\"))
    };
    #[cfg(not(target_os = "windows"))]
    let root = std::path::PathBuf::from("/");

    for disk in disks.list() {
        if disk.mount_point() == root.as_path() {
            disk_total = disk.total_space();
            disk_used = disk.total_space().saturating_sub(disk.available_space());
            break;
        }
    }
    // Fallback: aggregate every disk if "/" wasn't reported.
    if disk_total == 0 {
        for disk in disks.list() {
            disk_total += disk.total_space();
            disk_used += disk
                .total_space()
                .saturating_sub(disk.available_space());
        }
    }

    // Temperatura de la CPU (real, vía SMC). NO usamos el máximo de todos los
    // sensores: eso incluye GPU/reguladores de voltaje, que corren más calientes
    // y daban lecturas exageradas. Filtramos a sensores de CPU y promediamos.
    // Sin sensores accesibles → None (nunca se inventa un valor).
    let components = Components::new_with_refreshed_list();
    let mut cpu: Vec<f32> = Vec::new();
    let mut all: Vec<f32> = Vec::new();
    for c in &components {
        let t = c.temperature();
        if !t.is_finite() || t <= 5.0 || t >= 110.0 {
            continue; // descarta lecturas no plausibles
        }
        all.push(t);
        let label = c.label().to_lowercase();
        if label.contains("cpu")
            || label.contains("core")
            || label.contains("package")
            || label.contains("peci")
            || label.starts_with("tc") // claves SMC de CPU: TC0D, TC0P…
        {
            cpu.push(t);
        }
    }
    let temp: Option<f32> = if !cpu.is_empty() {
        Some(cpu.iter().sum::<f32>() / cpu.len() as f32) // promedio de CPU
    } else if !all.is_empty() {
        // Sin sensor de CPU identificable: mediana (representativo, no el pico).
        all.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        Some(all[all.len() / 2])
    } else {
        None
    };

    SystemStats {
        cpu_usage,
        mem_used,
        mem_total,
        swap_used,
        swap_total,
        disk_used,
        disk_total,
        uptime_secs: System::uptime(),
        temp,
        host_name: System::host_name().unwrap_or_else(|| "tu equipo".into()),
    }
}

/// Sistema operativo actual: "macos" | "windows" | "linux". El frontend lo usa
/// para adaptar textos («tu Mac» / «tu PC» / «tu equipo») y ocultar funciones
/// específicas de un SO.
#[tauri::command]
pub fn os_name() -> String {
    std::env::consts::OS.to_string()
}

#[derive(Serialize)]
pub struct SensorInfo {
    label: String,
    temp: f32,
}

/// Lista cruda de todos los sensores de temperatura (debug): para identificar
/// con exactitud cuál es el de la CPU en cada Mac.
#[tauri::command]
pub fn list_sensors() -> Vec<SensorInfo> {
    let components = Components::new_with_refreshed_list();
    components
        .iter()
        .map(|c| SensorInfo {
            label: c.label().to_string(),
            temp: c.temperature(),
        })
        .collect()
}

#[derive(Serialize, Clone)]
pub struct ProcInfo {
    pid: u32,
    name: String,
    cpu: f32, // % of total machine (0..100)
    mem: u64, // bytes
}

#[derive(Serialize)]
pub struct TopProcesses {
    by_cpu: Vec<ProcInfo>,
    by_mem: Vec<ProcInfo>,
    total: usize,
}

#[tauri::command]
pub fn top_processes(state: tauri::State<AppState>) -> TopProcesses {
    let mut sys = state.sys.lock().unwrap_or_else(|e| e.into_inner());
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::everything(),
    );

    let ncpu = std::thread::available_parallelism()
        .map(|x| x.get())
        .unwrap_or(1) as f32;

    let mut all: Vec<ProcInfo> = sys
        .processes()
        .iter()
        .map(|(pid, p)| ProcInfo {
            pid: pid.as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu: p.cpu_usage() / ncpu, // normalize across cores → 0..100
            mem: p.memory(),
        })
        .collect();

    let total = all.len();
    let mut by_mem = all.clone();

    all.sort_by(|a, b| {
        b.cpu
            .partial_cmp(&a.cpu)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    by_mem.sort_by(|a, b| b.mem.cmp(&a.mem));

    TopProcesses {
        by_cpu: all.into_iter().take(8).collect(),
        by_mem: by_mem.into_iter().take(8).collect(),
        total,
    }
}

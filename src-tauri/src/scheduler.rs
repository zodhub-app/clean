// Mantenimiento programado. El CONTRATO es el mismo en todos los sistemas
// (list_schedules / set_schedule / run_task_now, con cadencias manual, daily,
// weekly y monthly a las 03:00), pero el motor por debajo cambia:
//
//   macOS   → LaunchAgents de launchd (plist) ejecutando un script /bin/sh
//   Windows → Programador de tareas (`schtasks`) ejecutando un script PowerShell
//   Linux   → aún sin implementar (systemd user timers); se informa con claridad
//
// Todo en espacio de usuario: ninguna tarea pide permisos de administrador.

use crate::platform;
use serde::Serialize;
use std::collections::HashMap;

#[cfg(target_os = "macos")]
use std::path::{Path, PathBuf};

const PREFIX: &str = "com.viper.macup";

fn home() -> Result<String, String> {
    let h = platform::home_dir();
    if h.as_os_str().is_empty() {
        return Err("No se encontró la carpeta de usuario".to_string());
    }
    Ok(h.to_string_lossy().to_string())
}

/// Carpeta de datos de la app, según el sistema.
fn support_dir(home: &str) -> String {
    #[cfg(target_os = "macos")]
    {
        format!("{home}/Library/Application Support/{PREFIX}")
    }
    #[cfg(target_os = "windows")]
    {
        let base =
            std::env::var("APPDATA").unwrap_or_else(|_| format!("{home}\\AppData\\Roaming"));
        format!("{base}\\{PREFIX}")
    }
    #[cfg(target_os = "linux")]
    {
        format!("{home}/.local/share/{PREFIX}")
    }
}

/// Tareas que tienen sentido en cada sistema. `.DS_Store` es exclusivo de macOS.
fn task_keys() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &["dsstore", "cache", "trash", "cleanup"]
    }
    #[cfg(not(target_os = "macos"))]
    {
        &["cache", "trash", "cleanup"]
    }
}

// ─────────────────────────── Cuerpo de cada tarea ───────────────────────────

/// Windows: PowerShell. `Clear-RecycleBin` es la forma oficial de vaciar la
/// Papelera de reciclaje. Igual que en macOS, la limpieza automática es
/// CONSERVADORA: no toca modelos de IA ni paquetes caros de re-descargar.
#[cfg(target_os = "windows")]
fn task_script(task: &str, _home: &str) -> Option<String> {
    let body = match task {
        "cache" => {
            "Remove-Item -Path \"$env:LOCALAPPDATA\\Temp\\*\" -Recurse -Force -ErrorAction SilentlyContinue"
                .to_string()
        }
        "trash" => "Clear-RecycleBin -Force -ErrorAction SilentlyContinue".to_string(),
        "cleanup" => "Remove-Item -Path \"$env:LOCALAPPDATA\\Temp\\*\" -Recurse -Force -ErrorAction SilentlyContinue\n\
             Remove-Item -Path \"$env:APPDATA\\npm-cache\\_cacache\\*\" -Recurse -Force -ErrorAction SilentlyContinue\n\
             Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
            .to_string(),
        _ => return None,
    };
    // `$ErrorActionPreference` a Continue: los fallos parciales (archivos en uso)
    // son normales al limpiar cachés y no deben marcar la tarea como fallida.
    Some(format!("$ErrorActionPreference = 'Continue'\n{body}\nexit 0\n"))
}

#[cfg(target_os = "linux")]
fn task_script(_task: &str, _home: &str) -> Option<String> {
    None
}

/// The shell body for each schedulable task. All user-space, no admin needed.
#[cfg(target_os = "macos")]
fn task_script(task: &str, home: &str) -> Option<String> {
    let body = match task {
        // Best-effort: borra los .DS_Store accesibles. `find`/`rm` devuelven un
        // código != 0 si tropiezan con cualquier archivo bloqueado o carpeta
        // protegida por TCC (algo normal y esperable), y como el stderr va a
        // /dev/null llegaría un "error" vacío. Forzamos exit 0 para que los
        // fallos parciales no marquen la tarea como fallida.
        //
        // Importante: PODAMOS directorios pesados o sensibles (Library, .Trash,
        // node_modules, fototecas y paquetes .app). Recorrer ~/Library o iCloud
        // entero tarda eternidades y hace que el sistema se atasque.
        "dsstore" => format!(
            "find \"{home}\" \\( \
                -path \"{home}/Library\" -o \
                -path \"{home}/.Trash\" -o \
                -name node_modules -o \
                -name '*.photoslibrary' -o \
                -name '*.app' \
             \\) -prune -o \
             -name .DS_Store -type f -delete 2>/dev/null; exit 0"
        ),
        "cache" => format!("rm -rf \"{home}/Library/Caches/\"* 2>/dev/null; exit 0"),
        // "Liberar espacio": limpieza amplia pero CONSERVADORA para el modo
        // automático (cachés, logs, Xcode, cachés de paquetes) + vaciar Papelera.
        // NO borra modelos de IA (caros de re-descargar) ni toca Docker.
        "cleanup" => format!(
            "for d in \
               \"{home}/Library/Caches\" \
               \"{home}/Library/Logs\" \
               \"{home}/Library/Developer/Xcode/DerivedData\" \
               \"{home}/Library/Developer/Xcode/Archives\" \
               \"{home}/Library/Developer/CoreSimulator/Caches\" \
               \"{home}/.npm/_cacache\" \
               \"{home}/Library/pnpm/store\"; do rm -rf \"$d\"/* 2>/dev/null; done; \
             osascript \
               -e 'tell application \"Finder\"' \
               -e 'try' \
               -e 'empty the trash' \
               -e 'on error em number en' \
               -e 'if en is not -128 then error em number en' \
               -e 'end try' \
               -e 'end tell' 2>/dev/null; exit 0"
        ),
        // Emptying the Trash via Finder is the only reliable way: ~/.Trash is
        // TCC-protected, so a plain `rm` fails in a packaged app. Finder has the
        // rights and also handles trashes on other volumes.
        //
        // Finder shows its own "are you sure?" warning before emptying; we
        // silence it for the duration (guarded by `try`) and restore it after,
        // so ZodHub CleanPC's own flow controls the confirmation, not a stray dialog.
        //
        // Also: when the Trash is ALREADY empty, `empty the trash` itself
        // returns error -128. We swallow exactly that code (empty = success) and
        // re-raise any other error so real failures still surface.
        "trash" => {
            "osascript \
             -e 'tell application \"Finder\"' \
             -e 'set wt to true' \
             -e 'try' \
             -e 'set wt to warns before emptying of trash' \
             -e 'set warns before emptying of trash to false' \
             -e 'end try' \
             -e 'try' \
             -e 'empty the trash' \
             -e 'on error em number en' \
             -e 'if en is not -128 then error em number en' \
             -e 'end try' \
             -e 'try' \
             -e 'set warns before emptying of trash to wt' \
             -e 'end try' \
             -e 'end tell'"
                .to_string()
        }
        _ => return None,
    };
    Some(format!("#!/bin/sh\n{body}\n"))
}

// ───────────────────────── Registro de la programación ─────────────────────────

/// Windows: Programador de tareas. `/F` sobrescribe si ya existía.
#[cfg(target_os = "windows")]
fn install_schedule(task: &str, cadence: &str, script_path: &str) -> Result<(), String> {
    let sc = match cadence {
        "daily" => "DAILY",
        "weekly" => "WEEKLY",
        "monthly" => "MONTHLY",
        _ => return Err("Cadencia inválida".into()),
    };
    let name = format!("{PREFIX}.{task}");
    let tr = format!(
        "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{script_path}\""
    );
    let out = crate::platform::cmd("schtasks")
        .args([
            "/Create", "/F", "/TN", &name, "/TR", &tr, "/SC", sc, "/ST", "03:00",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(target_os = "windows")]
fn remove_schedule(task: &str) {
    let name = format!("{PREFIX}.{task}");
    let _ = crate::platform::cmd("schtasks")
        .args(["/Delete", "/F", "/TN", &name])
        .output();
}

#[cfg(target_os = "linux")]
fn install_schedule(_task: &str, _cadence: &str, _script_path: &str) -> Result<(), String> {
    Err("La programación automática aún no está disponible en Linux".into())
}

#[cfg(target_os = "linux")]
fn remove_schedule(_task: &str) {}

/// launchd StartCalendarInterval (always at 03:00) for a cadence.
#[cfg(target_os = "macos")]
fn calendar_interval(cadence: &str) -> Option<String> {
    let base = "<key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer>";
    match cadence {
        "daily" => Some(format!("<dict>{base}</dict>")),
        "weekly" => Some(format!(
            "<dict><key>Weekday</key><integer>0</integer>{base}</dict>"
        )),
        "monthly" => Some(format!(
            "<dict><key>Day</key><integer>1</integer>{base}</dict>"
        )),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn build_plist(label: &str, script: &str, interval: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>{script}</string>
  </array>
  <key>StartCalendarInterval</key>
  {interval}
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
"#
    )
}

/// GUI launchd domain target for the current user, e.g. "gui/501".
#[cfg(target_os = "macos")]
fn gui_domain() -> String {
    let uid = crate::platform::cmd("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    format!("gui/{uid}")
}

#[cfg(target_os = "macos")]
fn unload_agent(plist: &Path) {
    // bootout removes the job from the user's GUI domain (modern API).
    let _ = crate::platform::cmd("launchctl")
        .arg("bootout")
        .arg(gui_domain())
        .arg(plist)
        .output();
}

#[cfg(target_os = "macos")]
fn load_agent(plist: &Path) -> Result<(), String> {
    unload_agent(plist); // bootstrap fails if already loaded → bootout first
    let out = crate::platform::cmd("launchctl")
        .arg("bootstrap")
        .arg(gui_domain())
        .arg(plist)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

// ─────────────────────────────── Estado guardado ───────────────────────────────

fn state_file(support: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        format!("{support}\\schedules.json")
    }
    #[cfg(not(target_os = "windows"))]
    {
        format!("{support}/schedules.json")
    }
}
fn read_state(support: &str) -> HashMap<String, String> {
    std::fs::read_to_string(state_file(support))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
fn save_state(support: &str, task: &str, cadence: &str) -> Result<(), String> {
    let mut m = read_state(support);
    if cadence == "manual" {
        m.remove(task);
    } else {
        m.insert(task.to_string(), cadence.to_string());
    }
    std::fs::create_dir_all(support).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&m).unwrap_or_else(|_| "{}".into());
    std::fs::write(state_file(support), json).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct ScheduleInfo {
    task: String,
    cadence: String,
}

#[tauri::command]
pub fn list_schedules() -> Vec<ScheduleInfo> {
    let support = match home() {
        Ok(h) => support_dir(&h),
        Err(_) => return vec![],
    };
    let m = read_state(&support);
    task_keys()
        .iter()
        .map(|t| ScheduleInfo {
            task: t.to_string(),
            cadence: m.get(*t).cloned().unwrap_or_else(|| "manual".into()),
        })
        .collect()
}

#[tauri::command]
pub fn set_schedule(task: String, cadence: String) -> Result<(), String> {
    let home = home()?;
    let support = support_dir(&home);
    set_schedule_impl(&home, &support, &task, &cadence)
}

/// Windows: crea/borra la tarea en el Programador de tareas.
#[cfg(target_os = "windows")]
fn set_schedule_impl(
    home: &str,
    support: &str,
    task: &str,
    cadence: &str,
) -> Result<(), String> {
    let scripts = format!("{support}\\scripts");
    std::fs::create_dir_all(&scripts).map_err(|e| e.to_string())?;

    // Se quita siempre la tarea previa antes de (re)crearla.
    remove_schedule(task);
    if cadence == "manual" {
        return save_state(support, task, cadence);
    }

    let body = task_script(task, home).ok_or("Tarea desconocida")?;
    let script_path = format!("{scripts}\\{task}.ps1");
    std::fs::write(&script_path, body).map_err(|e| e.to_string())?;
    install_schedule(task, cadence, &script_path)?;
    save_state(support, task, cadence)
}

/// Linux: pendiente (systemd user timers). Se permite volver a «manual» para
/// que el usuario pueda desactivar, pero no programar en falso.
#[cfg(target_os = "linux")]
fn set_schedule_impl(
    _home: &str,
    support: &str,
    task: &str,
    cadence: &str,
) -> Result<(), String> {
    if cadence == "manual" {
        return save_state(support, task, cadence);
    }
    Err("La programación automática aún no está disponible en Linux".into())
}

/// macOS: LaunchAgent de launchd con el script en Application Support.
#[cfg(target_os = "macos")]
fn set_schedule_impl(
    home: &str,
    support: &str,
    task: &str,
    cadence: &str,
) -> Result<(), String> {
    let scripts = format!("{support}/scripts");
    std::fs::create_dir_all(&scripts).map_err(|e| e.to_string())?;
    let agents = format!("{home}/Library/LaunchAgents");
    std::fs::create_dir_all(&agents).map_err(|e| e.to_string())?;

    let label = format!("{PREFIX}.{task}");
    let plist_path = PathBuf::from(format!("{agents}/{label}.plist"));

    // Always remove any existing agent first.
    if plist_path.exists() {
        unload_agent(&plist_path);
        let _ = std::fs::remove_file(&plist_path);
    }

    if cadence == "manual" {
        return save_state(support, task, cadence);
    }

    let body = task_script(task, home).ok_or("Tarea desconocida")?;
    let script_path = format!("{scripts}/{task}.sh");
    std::fs::write(&script_path, body).map_err(|e| e.to_string())?;

    let interval = calendar_interval(cadence).ok_or("Cadencia inválida")?;
    let plist = build_plist(&label, &script_path, &interval);
    std::fs::write(&plist_path, plist).map_err(|e| e.to_string())?;
    load_agent(&plist_path)?;

    save_state(support, task, cadence)
}

/// Async + spawn_blocking: el barrido de .DS_Store puede tardar (recorre el
/// disco). Si esto corriera como comando síncrono, Tauri lo ejecutaría en el
/// hilo principal y la app (y a veces el sistema) se bloquearía con la pelota de
/// playa. En un hilo de bloqueo aparte, la UI sigue fluida y el loader se ve.
#[tauri::command]
pub async fn run_task_now(task: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home = home()?;
        let body = task_script(&task, &home).ok_or("Tarea desconocida")?;

        #[cfg(target_os = "windows")]
        let out = crate::platform::cmd("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &body,
            ])
            .output()
            .map_err(|e| e.to_string())?;

        #[cfg(not(target_os = "windows"))]
        let out = crate::platform::cmd("/bin/sh")
            .arg("-c")
            .arg(&body)
            .output()
            .map_err(|e| e.to_string())?;

        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

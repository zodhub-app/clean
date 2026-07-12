use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

const PREFIX: &str = "com.viper.macup";

fn home() -> Result<String, String> {
    std::env::var("HOME").map_err(|_| "No se encontró HOME".to_string())
}
fn support_dir(home: &str) -> String {
    format!("{home}/Library/Application Support/{PREFIX}")
}

/// The shell body for each schedulable task. All user-space, no admin needed.
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
        // so MacUp's own flow controls the confirmation, not a stray dialog.
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

/// launchd StartCalendarInterval (always at 03:00) for a cadence.
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
fn gui_domain() -> String {
    let uid = Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    format!("gui/{uid}")
}

fn unload_agent(plist: &Path) {
    // bootout removes the job from the user's GUI domain (modern API).
    let _ = Command::new("launchctl")
        .arg("bootout")
        .arg(gui_domain())
        .arg(plist)
        .output();
}

fn load_agent(plist: &Path) -> Result<(), String> {
    unload_agent(plist); // bootstrap fails if already loaded → bootout first
    let out = Command::new("launchctl")
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

fn state_file(support: &str) -> String {
    format!("{support}/schedules.json")
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
    ["dsstore", "cache", "trash", "cleanup"]
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
        return save_state(&support, &task, &cadence);
    }

    let body = task_script(&task, &home).ok_or("Tarea desconocida")?;
    let script_path = format!("{scripts}/{task}.sh");
    std::fs::write(&script_path, body).map_err(|e| e.to_string())?;

    let interval = calendar_interval(&cadence).ok_or("Cadencia inválida")?;
    let plist = build_plist(&label, &script_path, &interval);
    std::fs::write(&plist_path, plist).map_err(|e| e.to_string())?;
    load_agent(&plist_path)?;

    save_state(&support, &task, &cadence)
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
        let out = Command::new("/bin/sh")
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

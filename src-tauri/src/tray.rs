// Icono de ZodHub CleanPC en la barra de menús de macOS (tray). Opcional: se activa o
// desactiva desde Ajustes y la preferencia se guarda en disco, así arranca
// como el usuario lo dejó. Da un acceso directo aunque la ventana esté cerrada.

use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

const TRAY_ID: &str = "macup-tray";

fn pref_file() -> Option<PathBuf> {
    crate::platform::app_data_dir().map(|d| d.join("tray.json"))
}

/// Por defecto visible (como CleanMyMac). Si el usuario lo desactiva, se guarda
/// `false` y se respeta en el siguiente arranque.
pub fn tray_enabled() -> bool {
    match pref_file().and_then(|p| std::fs::read_to_string(p).ok()) {
        Some(s) => !s.contains("false"),
        None => true,
    }
}

fn save_pref(enabled: bool) {
    if let Some(p) = pref_file() {
        if let Some(dir) = p.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let body = if enabled {
            "{\"visible\":true}"
        } else {
            "{\"visible\":false}"
        };
        let _ = std::fs::write(p, body);
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Crea el icono de la barra de menús con su menú (Abrir / Salir). Idempotente.
pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }
    let open = MenuItem::with_id(app, "open", "Abrir ZodHub CleanPC", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Salir de ZodHub CleanPC", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &sep, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[tauri::command]
pub fn get_tray_visible() -> bool {
    tray_enabled()
}

#[tauri::command]
pub fn set_tray_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    save_pref(visible);
    if visible {
        build_tray(&app).map_err(|e| e.to_string())?;
    } else {
        let _ = app.remove_tray_by_id(TRAY_ID);
    }
    Ok(())
}

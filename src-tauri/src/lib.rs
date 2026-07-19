mod apps;
mod cache;
mod devclean;
mod dsstore;
mod duplicates;
mod memory;
mod network;
mod scanner;
mod scheduler;
mod snapshots;
mod storage;
mod system;
mod tray;

use apps::{app_leftovers, list_apps, uninstall_app};
use cache::{clean_caches, scan_caches};
use devclean::{clean_all_junk, clean_dev, list_dev_junk};
use duplicates::find_duplicates;
use dsstore::{
    clean_zip, get_network_stores_disabled, set_network_stores_disabled, sweep_ds_store,
};
use memory::{memory_stats, purge_memory};
use network::network_stats;
use scanner::{move_to_trash, reveal_in_finder, scan_dir};
use scheduler::{list_schedules, run_task_now, set_schedule};
use snapshots::{list_snapshots, thin_snapshots};
use storage::{storage_history, storage_stats};
use system::{list_sensors, os_name, system_stats, top_processes, AppState};
use tauri::Manager;
use tray::{get_tray_visible, set_tray_visible};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init());

    // Updater + process solo en escritorio (macOS/Windows/Linux). El frontend
    // llama a `check()` al arrancar; la descarga/verificación/instalación real la
    // hace este plugin en Rust (regla de oro).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .manage(AppState::new())
        .setup(|app| {
            if tray::tray_enabled() {
                tray::build_tray(app.handle())?;
            }
            // Con el icono de la barra de menús activo, cerrar la ventana solo
            // la oculta: ZodHub CleanPC sigue vivo en la barra (como CleanMyMac). Sin el
            // icono, cerrar cierra la app como siempre.
            if let Some(win) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if tray::tray_enabled() {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system_stats,
            list_sensors,
            top_processes,
            os_name,
            scan_caches,
            clean_caches,
            network_stats,
            memory_stats,
            purge_memory,
            clean_zip,
            sweep_ds_store,
            get_network_stores_disabled,
            set_network_stores_disabled,
            list_schedules,
            set_schedule,
            run_task_now,
            get_tray_visible,
            set_tray_visible,
            storage_stats,
            storage_history,
            scan_dir,
            reveal_in_finder,
            move_to_trash,
            list_apps,
            app_leftovers,
            uninstall_app,
            list_dev_junk,
            clean_dev,
            clean_all_junk,
            list_snapshots,
            thin_snapshots,
            find_duplicates
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Utilidades multiplataforma compartidas por el resto de módulos.
//
// Filosofía (ver ROADMAP_MULTIPLATAFORMA.md): preferimos una implementación
// única con crates portables antes que ramas por SO. Solo se ramifica cuando el
// sistema operativo obliga (p. ej. «revelar en el explorador»).

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Carpeta de usuario, en cualquier sistema.
/// macOS/Linux usan `HOME`; Windows usa `USERPROFILE`.
pub fn home_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    let v = std::env::var("USERPROFILE");
    #[cfg(not(target_os = "windows"))]
    let v = std::env::var("HOME");
    v.map(PathBuf::from).unwrap_or_default()
}

/// Tamaño real de un archivo o carpeta (recursivo), en bytes.
///
/// Sustituye a `du -sk` (que solo existe en Unix). NUNCA sigue enlaces
/// simbólicos, para no contar dos veces ni salirse del árbol.
pub fn dir_size(path: &Path) -> u64 {
    match std::fs::symlink_metadata(path) {
        Ok(md) if md.is_file() => return md.len(),
        Ok(md) if md.file_type().is_symlink() => return 0,
        Err(_) => return 0,
        _ => {}
    }
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// Muestra un elemento en el explorador de archivos del sistema (lo revela,
/// no lo abre): Finder en macOS, Explorador en Windows, gestor XDG en Linux.
pub fn reveal(path: &str) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .output()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        // `explorer /select,<ruta>` selecciona el elemento en su carpeta.
        // OJO: explorer.exe devuelve código de salida != 0 aunque funcione, así
        // que lanzamos y no comprobamos el estado.
        Command::new("explorer")
            .arg(format!("/select,{path}"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Sin forma universal de «seleccionar»: abrimos la carpeta contenedora.
        let p = Path::new(path);
        let dir = p.parent().unwrap_or(p);
        Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Carpetas de primer nivel dentro del home que NUNCA se pueden borrar enteras.
/// Cambian según el sistema (macOS tiene Library/Movies; Windows, Videos…).
pub fn protected_top_level() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &[
            "Documents",
            "Desktop",
            "Downloads",
            "Library",
            "Pictures",
            "Movies",
            "Music",
            "Public",
        ]
    }
    #[cfg(target_os = "windows")]
    {
        &[
            "Documents",
            "Desktop",
            "Downloads",
            "Pictures",
            "Videos",
            "Music",
            "AppData",
            "OneDrive",
        ]
    }
    #[cfg(target_os = "linux")]
    {
        &[
            "Documents",
            "Desktop",
            "Downloads",
            "Pictures",
            "Videos",
            "Music",
            "Public",
            ".config",
            ".local",
        ]
    }
}

/// Guarda de seguridad común: solo se puede enviar a la Papelera algo DENTRO de
/// la carpeta de usuario, nunca el propio home ni sus carpetas críticas.
pub fn is_deletable(p: &Path) -> Result<(), String> {
    let home = home_dir();
    if home.as_os_str().is_empty() {
        return Err("No se encontró la carpeta de usuario".into());
    }
    if !p.starts_with(&home) {
        return Err("Protegido: solo dentro de tu carpeta de usuario".into());
    }
    if p == home {
        return Err("Protegido: carpeta de inicio".into());
    }
    if let Ok(rel) = p.strip_prefix(&home) {
        if rel.components().count() == 1 {
            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                if protected_top_level().contains(&name) {
                    return Err(format!("Protegido: {name}"));
                }
            }
        }
    }
    Ok(())
}

/// Envía una ruta a la Papelera/Papelera de reciclaje del sistema (recuperable).
/// Multiplataforma vía el crate `trash`.
pub fn move_to_trash(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

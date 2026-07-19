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

/// Carpeta donde la app guarda sus datos (preferencias, histórico, scripts):
///   macOS   → ~/Library/Application Support/com.viper.macup
///   Windows → %APPDATA%\com.viper.macup
///   Linux   → ~/.local/share/com.viper.macup
///
/// El identificador se mantiene aunque el producto se llame «ZodHub CleanPC»:
/// cambiarlo haría que los usuarios existentes perdieran sus ajustes.
pub fn app_data_dir() -> Option<PathBuf> {
    let h = home_dir();
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
    Some(dir)
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

/// Resultado de un borrado tolerante.
#[derive(Default, Debug, Clone, Copy)]
pub struct Wipe {
    /// Bytes realmente liberados (solo de lo que se pudo borrar).
    pub freed: u64,
    /// Elementos eliminados.
    pub removed: usize,
    /// Elementos omitidos por estar EN USO por otro proceso.
    pub in_use: usize,
    /// Elementos omitidos por falta de permisos.
    pub denied: usize,
}

impl Wipe {
    fn merge(&mut self, o: Wipe) {
        self.freed += o.freed;
        self.removed += o.removed;
        self.in_use += o.in_use;
        self.denied += o.denied;
    }
}

/// ¿El error significa «el archivo está abierto por otro proceso»?
///
/// En Windows son los códigos 32 (ERROR_SHARING_VIOLATION) y 33
/// (ERROR_LOCK_VIOLATION); en Unix, `ETXTBSY`. Es la situación NORMAL al
/// limpiar carpetas temporales: siempre hay algo abierto.
fn is_busy(e: &std::io::Error) -> bool {
    matches!(e.raw_os_error(), Some(32) | Some(33) | Some(26))
}

/// Borrado recursivo **tolerante**: elimina todo lo que puede y salta lo que
/// está bloqueado, en vez de abortar la operación entera.
///
/// Motivo: `std::fs::remove_dir_all` falla al primer archivo en uso y deja el
/// resto sin tocar. En `%LOCALAPPDATA%\Temp` eso ocurre siempre (Windows
/// mantiene archivos abiertos ahí), así que la limpieza no borraba nada y
/// devolvía un error alarmante. Ahora se borra lo que se puede y se informa de
/// cuántos elementos quedaron en uso, que no es un fallo sino lo esperable.
///
/// `keep_root`: si es `true`, se vacía el contenido pero se conserva la carpeta
/// (necesario para carpetas del sistema como `Temp` o `Caches`, que deben
/// seguir existiendo).
pub fn wipe(path: &Path, keep_root: bool) -> Wipe {
    let mut w = Wipe::default();

    let md = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return w, // no existe: nada que hacer
    };

    // Los enlaces simbólicos se borran como enlace; nunca se recorren.
    if md.file_type().is_symlink() || !md.is_dir() {
        let size = md.len();
        match std::fs::remove_file(path) {
            Ok(()) => {
                w.freed += size;
                w.removed += 1;
            }
            Err(e) if is_busy(&e) => w.in_use += 1,
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => w.denied += 1,
            Err(_) => w.in_use += 1,
        }
        return w;
    }

    // Directorio: primero el contenido, uno a uno.
    if let Ok(rd) = std::fs::read_dir(path) {
        for entry in rd.flatten() {
            w.merge(wipe(&entry.path(), false));
        }
    }

    // Y ahora la propia carpeta, que solo desaparecerá si quedó vacía.
    if !keep_root {
        match std::fs::remove_dir(path) {
            Ok(()) => w.removed += 1,
            Err(e) if is_busy(&e) => w.in_use += 1,
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => w.denied += 1,
            Err(_) => {} // no estaba vacía: ya se ha contado lo de dentro
        }
    }
    w
}

/// Frase para el usuario cuando parte de la limpieza no pudo completarse.
/// Devuelve `None` si salió todo, para no dar avisos cuando no hace falta.
pub fn wipe_note(w: &Wipe) -> Option<String> {
    match (w.in_use, w.denied) {
        (0, 0) => None,
        (n, 0) => Some(format!(
            "{n} elemento(s) en uso por otros programas; se han dejado intactos"
        )),
        (0, d) => Some(format!("{d} elemento(s) requieren permisos de administrador")),
        (n, d) => Some(format!(
            "{n} elemento(s) en uso y {d} sin permisos; el resto se ha limpiado"
        )),
    }
}

/// Bandera `CREATE_NO_WINDOW` de la API de Windows.
///
/// Sin ella, CADA proceso hijo de consola (`powershell`, `cmd`, `schtasks`,
/// `explorer`…) abre y cierra una ventana negra. Como la app lanza varios por
/// segundo para refrescar la telemetría, el resultado es un parpadeo continuo
/// que parece un virus. En macOS y Linux no existe el problema.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Constructor de comandos que debe usar TODO el proyecto en lugar de
/// `std::process::Command::new`. En Windows oculta la consola; en el resto de
/// sistemas es exactamente igual que el constructor normal.
///
/// Regla: si añades un `Command` nuevo, créalo con esta función. No hay ningún
/// caso en esta app en el que queramos enseñarle una terminal al usuario.
pub fn cmd(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut c = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c
}

/// Muestra un elemento en el explorador de archivos del sistema (lo revela,
/// no lo abre): Finder en macOS, Explorador en Windows, gestor XDG en Linux.
pub fn reveal(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        cmd("open")
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
        cmd("explorer")
            .arg(format!("/select,{path}"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Sin forma universal de «seleccionar»: abrimos la carpeta contenedora.
        let p = Path::new(path);
        let dir = p.parent().unwrap_or(p);
        cmd("xdg-open")
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

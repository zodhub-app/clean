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
    measure(path).bytes
}

/// Resultado de medir una ruta.
#[derive(Default, Debug, Clone, Copy)]
pub struct Measure {
    /// Espacio real en disco, sin contar dos veces lo compartido.
    pub bytes: u64,
    /// Entradas que no se pudieron leer (permisos, TCC…). Si esto no es cero,
    /// `bytes` es un MÍNIMO, no el total: hay que decírselo al usuario.
    pub unreadable: usize,
}

/// Mide una ruta como lo hace `du`, para que las dos cifras coincidan.
///
/// Tres decisiones que marcan la diferencia frente a sumar tamaños a lo bruto:
///
/// 1. **Espacio en disco, no tamaño declarado** (ver `size_on_disk`).
/// 2. **Se cuentan los bloques de los directorios**, que también ocupan. `du`
///    los cuenta; no hacerlo subestimaba en árboles con muchas carpetas, como
///    `node_modules`.
/// 3. **No se cuenta dos veces lo compartido.** Si varias rutas apuntan al
///    mismo inodo (enlaces duros), ocupan UNA vez. `du` deduplica así; sin
///    esto, la store de pnpm o `/Applications` salían muy infladas y el
///    usuario borraba esperando recuperar un espacio que no existía.
pub fn measure(path: &Path) -> Measure {
    let mut out = Measure::default();

    #[cfg(unix)]
    let mut seen: std::collections::HashSet<(u64, u64)> = std::collections::HashSet::new();

    let md = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => {
            out.unreadable = 1;
            return out;
        }
    };
    // Un enlace simbólico no ocupa lo que apunta: no se sigue ni se suma.
    if md.file_type().is_symlink() {
        return out;
    }
    if !md.is_dir() {
        out.bytes = size_on_disk(&md);
        return out;
    }

    for entry in WalkDir::new(path).follow_links(false) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => {
                out.unreadable += 1;
                continue;
            }
        };
        // Los enlaces simbólicos no ocupan el destino.
        if entry.file_type().is_symlink() {
            continue;
        }
        let m = match entry.metadata() {
            Ok(m) => m,
            Err(_) => {
                out.unreadable += 1;
                continue;
            }
        };
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            // Mismo inodo ya contado = enlace duro. Ocupa una sola vez.
            if !seen.insert((m.dev(), m.ino())) {
                continue;
            }
        }
        out.bytes += size_on_disk(&m);
    }
    out
}

/// Espacio que un archivo ocupa DE VERDAD en el disco.
///
/// Esto no es lo mismo que su tamaño «lógico» (`metadata.len()`), que es lo que
/// el archivo dice pesar. La diferencia puede ser enorme y llevaba a que el
/// Explorador sumara más de lo que cabe en el disco:
///
/// - **Archivos de la nube.** iCloud Drive (`~/Library/Mobile Documents`,
///   `~/Library/CloudStorage`) y OneDrive dejan marcadores: el archivo aparece
///   con su tamaño completo pero NO está descargado. Ocupa cero.
/// - **Archivos dispersos** (máquinas virtuales, imágenes de disco): declaran
///   un tamaño grande y solo reservan los bloques que han usado.
///
/// Se mide el espacio real porque es la única cifra útil aquí: lo que el
/// usuario quiere saber es cuánto sitio recupera si borra algo.
pub fn size_on_disk(md: &std::fs::Metadata) -> u64 {
    #[cfg(unix)]
    {
        // `blocks()` cuenta bloques de 512 bytes REALMENTE asignados. Es la
        // misma cifra que da `du`, y por eso coincide con el Finder.
        use std::os::unix::fs::MetadataExt;
        md.blocks().saturating_mul(512)
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // Marcadores de archivos en la nube (OneDrive «Archivos a petición»):
        // el contenido no está en el disco, así que no ocupa.
        const FILE_ATTRIBUTE_OFFLINE: u32 = 0x0000_1000;
        const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x0004_0000;
        const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;
        const CLOUD: u32 =
            FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS;
        if md.file_attributes() & CLOUD != 0 {
            return 0;
        }
        // LIMITACIÓN CONOCIDA: la biblioteca estándar no expone el tamaño
        // asignado en disco en Windows (haría falta `GetCompressedFileSize` de
        // la API nativa). Para archivos normales el tamaño lógico coincide; se
        // desvía en los dispersos y comprimidos por NTFS, que son minoría.
        md.file_size()
    }
    #[cfg(not(any(unix, windows)))]
    md.len()
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
    /// Elementos que fallaron por otro motivo (disco lleno, error de E/S…).
    /// Tienen su propio contador para no disfrazarlos de «en uso».
    pub failed: usize,
}

impl Wipe {
    /// Suma otro resultado a este (para acumular varias rutas).
    pub fn add(&mut self, o: Wipe) {
        self.freed += o.freed;
        self.removed += o.removed;
        self.in_use += o.in_use;
        self.denied += o.denied;
        self.failed += o.failed;
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

    // Enlaces simbólicos y junctions: se borra el ENLACE, nunca se recorre su
    // destino (si no, un enlace a C:\ nos llevaría a barrer el disco entero).
    // OJO Windows: una junction es un directorio y `is_symlink()` también es
    // cierta para ella, pero hay que quitarla con `remove_dir`, no con
    // `remove_file`. Sin esto quedaban contadas como «en uso» para siempre.
    if md.file_type().is_symlink() {
        let r = if is_link_to_dir(&md) {
            std::fs::remove_dir(path)
        } else {
            std::fs::remove_file(path)
        };
        match r {
            Ok(()) => w.removed += 1,
            Err(e) => classify(&mut w, &e),
        }
        return w;
    }

    if !md.is_dir() {
        // Espacio REAL en disco, no el tamaño declarado. Un marcador de iCloud
        // dice pesar 2 GB y no ocupa nada: contarlo como liberado sería mentir.
        let size = size_on_disk(&md);
        match remove_file_forcing(path, &md) {
            Ok(()) => {
                w.freed += size;
                w.removed += 1;
            }
            Err(e) => classify(&mut w, &e),
        }
        return w;
    }

    // Directorio: primero el contenido, uno a uno.
    if let Ok(rd) = std::fs::read_dir(path) {
        for entry in rd.flatten() {
            w.add(wipe(&entry.path(), false));
        }
    }

    // Y ahora la propia carpeta, que solo desaparecerá si quedó vacía.
    if !keep_root {
        match std::fs::remove_dir(path) {
            Ok(()) => w.removed += 1,
            Err(e) if is_busy(&e) => w.in_use += 1,
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => w.denied += 1,
            // Cualquier otro error aquí suele ser «no estaba vacía», y lo que
            // hay dentro ya se ha contado. No se suma nada para no duplicar.
            Err(_) => {}
        }
    }
    w
}

/// Borra un archivo y, si falla por permisos, prueba a quitarle el atributo de
/// SOLO LECTURA y reintenta una vez.
///
/// En Windows, borrar un archivo marcado como solo lectura devuelve «acceso
/// denegado» aunque seas su dueño. Las cachés de npm y de Gradle escriben todo
/// su contenido así, con lo que la limpieza fallaba en masa y, peor aún, la app
/// culpaba a los permisos de administrador de algo que no los necesitaba.
/// Solo se hace en Windows a propósito: en Unix el permiso que manda para
/// borrar es el de la CARPETA, no el del archivo, así que tocar los bits del
/// archivo no ayudaría y sería un efecto secundario innecesario.
fn remove_file_forcing(path: &Path, _md: &std::fs::Metadata) -> std::io::Result<()> {
    let first = std::fs::remove_file(path);

    #[cfg(target_os = "windows")]
    if let Err(e) = &first {
        if e.kind() == std::io::ErrorKind::PermissionDenied && _md.permissions().readonly() {
            let mut perms = _md.permissions();
            #[allow(clippy::permissions_set_readonly_false)]
            perms.set_readonly(false);
            std::fs::set_permissions(path, perms)?;
            return std::fs::remove_file(path);
        }
    }

    first
}

/// ¿El enlace apunta a un directorio? (Hay que quitarlo con `remove_dir`.)
///
/// No sirve `md.is_dir()`: la librería estándar lo define como «es directorio Y
/// NO es enlace», así que para un enlace siempre da `false`. En Windows eso
/// significaba intentar `remove_file` sobre una junction —abundan dentro del
/// perfil de usuario— y fallar siempre con acceso denegado, contándolas como
/// «en uso» eternamente. Se mira el atributo real del sistema de archivos.
#[cfg(target_os = "windows")]
fn is_link_to_dir(md: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;
    md.file_attributes() & FILE_ATTRIBUTE_DIRECTORY != 0
}

/// En Unix un enlace simbólico se borra SIEMPRE con `remove_file`, apunte a lo
/// que apunte: se elimina el enlace, no su destino.
#[cfg(not(target_os = "windows"))]
fn is_link_to_dir(_md: &std::fs::Metadata) -> bool {
    false
}

/// Contabiliza un fallo de borrado en la categoría que le corresponde.
///
/// Lo que NO se sabe no se disfraza: antes, cualquier error que no fuera de
/// permisos se contaba como «en uso por otro programa». Un disco lleno, un
/// fallo de entrada/salida o un nombre inválido le salían al usuario como
/// «archivo abierto», que es una explicación falsa y le hacía buscar donde no
/// era. Ahora esos casos van a su propio contador.
fn classify(w: &mut Wipe, e: &std::io::Error) {
    if is_busy(e) {
        w.in_use += 1;
    } else if e.kind() == std::io::ErrorKind::PermissionDenied {
        w.denied += 1;
    } else {
        w.failed += 1;
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

/// Normaliza una ruta para poder compararla con seguridad.
///
/// Dos motivos, y ambos son agujeros reales en una app que borra archivos:
///
/// 1. **`..` atraviesa las guardas.** `Path::starts_with` es léxico: no resuelve
///    nada. `C:\Users\ana\..\..\Windows\System32` «empieza por» el home aunque
///    apunte fuera. Al borrar, el sistema SÍ lo resuelve. Hay que resolverlo
///    antes de decidir.
/// 2. **Windows no distingue mayúsculas.** `C:\users\ana` y `C:\Users\Ana` son
///    la misma carpeta, pero `starts_with` compara componente a componente byte
///    a byte. Sin normalizar, la protección de «Documents» no salta si llega
///    como «documents», y en sentido contrario se rechazan rutas legítimas.
///
/// Si la ruta no existe, `canonicalize` falla; entonces se limpia al menos de
/// forma léxica para que un `..` no se cuele.
fn norm(p: &Path) -> PathBuf {
    let resolved = std::fs::canonicalize(p).unwrap_or_else(|_| lexical_clean(p));
    #[cfg(target_os = "windows")]
    {
        // Dos ajustes imprescindibles en Windows:
        //
        // a) `canonicalize` devuelve rutas «verbatim» con el prefijo `\\?\`,
        //    mientras que el camino de respaldo (`lexical_clean`, para rutas
        //    que aún no existen) devuelve la forma normal. Comparar una con
        //    otra daría siempre falso y la app rechazaría rutas legítimas con
        //    un «Protegido» incomprensible. Se quita el prefijo para que ambas
        //    salidas tengan la misma forma.
        // b) El sistema no distingue mayúsculas: `C:\Users` y `c:\users` son la
        //    misma carpeta, así que se compara todo en minúsculas.
        let lower = resolved.to_string_lossy().to_lowercase();
        // Ojo al orden: la forma de red (`\\?\UNC\servidor\...`) empieza por el
        // prefijo corto, así que hay que probarla primero.
        let plain = if let Some(rest) = lower.strip_prefix(r"\\?\unc\") {
            format!(r"\\{rest}")
        } else if let Some(rest) = lower.strip_prefix(r"\\?\") {
            rest.to_string()
        } else {
            lower
        };
        PathBuf::from(plain)
    }
    #[cfg(not(target_os = "windows"))]
    resolved
}

/// Resuelve `.` y `..` sin tocar el disco (para rutas que aún no existen).
/// Un `..` que se pase de la raíz simplemente se descarta.
fn lexical_clean(p: &Path) -> PathBuf {
    use std::path::Component;
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// ¿`child` está dentro de `parent`? Comparación segura (ver `norm`).
/// Estar «dentro» excluye ser el propio `parent`.
pub fn is_inside(child: &Path, parent: &Path) -> bool {
    let (c, p) = (norm(child), norm(parent));
    c != p && c.starts_with(&p)
}

/// Guarda de seguridad común: solo se puede enviar a la Papelera algo DENTRO de
/// la carpeta de usuario, nunca el propio home ni sus carpetas críticas.
pub fn is_deletable(p: &Path) -> Result<(), String> {
    let home = home_dir();
    if home.as_os_str().is_empty() {
        return Err("No se encontró la carpeta de usuario".into());
    }
    let (np, nh) = (norm(p), norm(&home));
    if np == nh {
        return Err("Protegido: carpeta de inicio".into());
    }
    if !np.starts_with(&nh) {
        return Err("Protegido: solo dentro de tu carpeta de usuario".into());
    }
    // Carpetas críticas de primer nivel: Documentos, Escritorio, AppData…
    if let Ok(rel) = np.strip_prefix(&nh) {
        if rel.components().count() == 1 {
            if let Some(name) = np.file_name().and_then(|n| n.to_str()) {
                // `np` ya viene en minúsculas en Windows: comparamos igual.
                let hit = protected_top_level()
                    .iter()
                    .any(|s| s.eq_ignore_ascii_case(name));
                if hit {
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

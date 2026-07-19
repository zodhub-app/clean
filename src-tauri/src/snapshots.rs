// Fase 2 — Instantáneas APFS / Time Machine locales.
// macOS guarda "copias locales" de Time Machine dentro del disco. Se acumulan y
// ocupan espacio recuperable (parte de lo que Utilidad de Discos cuenta como
// usado). macOS NO expone el tamaño exacto por instantánea, así que aquí:
//   - Listamos cuántas hay y de qué fecha (para entender de dónde sale).
//   - Al liberar, medimos el espacio libre antes/después y reportamos lo real.
// Liberar usa `tmutil thinlocalsnapshots` con permiso de administrador.

//
// Fuera de macOS: el concepto no existe igual. En Windows el análogo son las
// Instantáneas de volumen (VSS), que requieren permisos de administrador para
// listarse y borrarse, y borrarlas elimina puntos de restauración del sistema
// (arriesgado). Por eso aquí NO se implementa a medias: se devuelve vacío y la
// interfaz oculta la sección en ese sistema. Queda como trabajo futuro.

use serde::Serialize;

#[derive(Serialize)]
pub struct Snapshot {
    name: String,
    date: String, // "YYYY-MM-DD-HHMMSS"
}

#[derive(Serialize)]
pub struct ThinResult {
    count_before: u32,
    count_after: u32,
}

/// Fuera de macOS no hay instantáneas locales equivalentes que podamos leer sin
/// privilegios: devolvemos vacío (la UI oculta la sección) en vez de fingir.
#[cfg(not(target_os = "macos"))]
fn parse_snapshots() -> Vec<Snapshot> {
    vec![]
}

#[cfg(target_os = "macos")]
fn parse_snapshots() -> Vec<Snapshot> {
    let text = crate::platform::cmd("tmutil")
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

/// Fuera de macOS no se ofrece: en Windows equivaldría a borrar puntos de
/// restauración del sistema (requiere admin y es arriesgado). Mejor decirlo.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn thin_snapshots() -> Result<ThinResult, String> {
    Err("Las instantáneas locales solo están disponibles en macOS".into())
}

/// Libera TODAS las instantáneas locales (thin agresivo, urgencia 4). Pide
/// contraseña de administrador. Reporta el espacio realmente recuperado.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn thin_snapshots() -> Result<ThinResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let count_before = parse_snapshots().len() as u32;

        let script = "do shell script \"/usr/bin/tmutil thinlocalsnapshots / 999999999999999 4\" with administrator privileges";
        let out = crate::platform::cmd("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }

        let count_after = parse_snapshots().len() as u32;

        // NO se informa de bytes liberados, a propósito.
        //
        // Antes se restaba el espacio libre del disco antes y después, con una
        // espera de 900 ms. Estaba mal por tres motivos a la vez: (1) ese delta
        // recoge lo que cualquier otro proceso libere u ocupe en esa ventana;
        // (2) APFS libera los bloques de una instantánea de forma ASÍNCRONA, de
        // modo que a los 900 ms lo normal es que aún no se note y se reportara
        // casi cero tras haber liberado decenas de gigas; (3) `saturating_sub`
        // devolvía 0 en silencio si el disco se había llenado mientras tanto.
        //
        // No hay forma fiable de atribuir bytes a esta operación, así que se
        // informa de lo único que sí se sabe con certeza: cuántas instantáneas
        // había y cuántas quedan. El espacio se ve en el panel de
        // Almacenamiento cuando el sistema termina de soltarlo.
        Ok(ThinResult {
            count_before,
            count_after,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

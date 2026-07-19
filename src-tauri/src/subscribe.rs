// Suscripción voluntaria a novedades.
//
// HONESTIDAD Y PRIVACIDAD — leer antes de tocar esto:
// Esto es lo ÚNICO que sale del equipo del usuario, y solo cuando pulsa el botón
// de forma explícita. La app no envía absolutamente nada más: ni telemetría, ni
// estadísticas, ni datos de los análisis. Si algún día eso cambiara, habría que
// cambiar también lo que la app promete en pantalla.

use serde::Serialize;

/// URL que recibe las altas.
///
/// DEBE ser un servicio de formularios con identificador público (Formspree,
/// Web3Forms…) o una función serverless propia. NUNCA una API que requiera una
/// clave secreta: el binario se distribuye y cualquiera podría extraerla.
///
/// Vacío = suscripción no configurada. La interfaz lo dice claramente en vez de
/// enseñar un formulario que no puede funcionar.
const ENDPOINT: &str = "";

#[derive(Serialize)]
struct Payload<'a> {
    name: &'a str,
    email: &'a str,
    /// De dónde viene el alta, para distinguirla de las de la web.
    source: &'a str,
    /// Versión de la app, útil para soporte.
    version: &'a str,
}

/// ¿Está configurada la suscripción? La interfaz lo consulta para no mostrar un
/// formulario que no llevaría a ninguna parte.
#[tauri::command]
pub fn subscribe_available() -> bool {
    !ENDPOINT.is_empty()
}

#[tauri::command]
pub async fn subscribe(name: String, email: String) -> Result<(), String> {
    if ENDPOINT.is_empty() {
        return Err("La suscripción todavía no está configurada".into());
    }

    let email = email.trim().to_string();
    let name = name.trim().to_string();

    // Validación mínima también en el backend: no nos fiamos solo del frontend.
    if email.len() < 5 || !email.contains('@') || !email.contains('.') {
        return Err("Introduce un correo electrónico válido".into());
    }

    let _body = Payload {
        name: &name,
        email: &email,
        source: "app",
        version: env!("CARGO_PKG_VERSION"),
    };

    // El envío está sin implementar A PROPÓSITO. Se hacía con `reqwest`, y esa
    // dependencia apagaba el TLS del actualizador (ver Cargo.toml). Como no hay
    // ENDPOINT configurado, esta rama es inalcanzable hoy: el guard de arriba
    // corta antes. Al configurar el endpoint hay que reimplementar el POST con
    // `tauri-plugin-http` y volver a probar la actualización automática.
    Err("La suscripción todavía no está configurada".into())
}

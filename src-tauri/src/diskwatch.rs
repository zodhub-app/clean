// Vigilante de disco lleno.
//
// Lo que faltaba: avisar ANTES de quedarte sin espacio, aunque no estés mirando
// la app. Un hilo en segundo plano comprueba el disco cada cierto tiempo y, al
// cruzar el umbral, lanza una NOTIFICACIÓN del sistema (se ve aunque la ventana
// esté oculta en la barra de menús).
//
// Reglas honestas:
//   - Usa la MISMA fuente de datos que el panel (`storage::disk_usage`, que a su
//     vez es lo que informa macOS). Nada de una cuenta paralela que pudiera
//     contradecir a la pantalla.
//   - Antifatiga: avisa UNA vez al entrar en zona de peligro y no repite mientras
//     sigas lleno. Se re-arma solo cuando el disco vuelve a bajar del umbral, así
//     que si te llenas otra vez, vuelve a avisar.
//   - Solo vigila mientras el proceso está vivo (incluye oculto en la barra). Si
//     cierras la app del todo, no hay vigilancia: eso exigiría un agente de
//     arranque del sistema y se aborda aparte.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// A partir de aquí conviene actuar (disco alto).
const HIGH_PCT: f64 = 90.0;
/// Por debajo de esto es crítico aunque el porcentaje no llegue (discos grandes).
const CRITICAL_FREE_BYTES: u64 = 15 * 1024 * 1024 * 1024; // 15 GB
/// Cambio de espacio libre que se considera "grande" y merece avisar/explicar.
/// Es el vaivén que confundía: la app limpia unos pocos GB pero el disco sube o
/// baja decenas por espacio del sistema que macOS acumula y suelta solo.
const BIG_SWING_BYTES: u64 = 20 * 1024 * 1024 * 1024; // 20 GB
/// Cada cuánto se comprueba.
const CHECK_EVERY: Duration = Duration::from_secs(30 * 60); // 30 min
/// Primera comprobación poco después de arrancar (sin agobiar en el arranque).
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(90);

/// ¿Ya avisamos y el disco sigue lleno? Evita repetir el aviso en cada ciclo.
static WARNED: AtomicBool = AtomicBool::new(false);
/// Último espacio libre visto (bytes). 0 = aún sin medir.
static LAST_FREE: AtomicU64 = AtomicU64::new(0);

/// Devuelve `Some(true)` si es crítico, `Some(false)` si es alto, `None` si va
/// holgado. Misma lógica de umbrales que el banner de la pantalla.
fn danger(total: u64, used: u64, free: u64) -> Option<bool> {
    if total == 0 {
        return None; // sin dato: no inventamos un aviso
    }
    let pct = used as f64 / total as f64 * 100.0;
    let critical = free < CRITICAL_FREE_BYTES;
    if critical || pct >= 92.0 {
        Some(true)
    } else if pct >= HIGH_PCT {
        Some(false)
    } else {
        None
    }
}

fn fmt_gb(bytes: u64) -> String {
    let gb = bytes as f64 / 1024_f64.powi(3);
    format!("{gb:.1} GB")
}

fn notify(app: &AppHandle, critical: bool, free: u64, total: u64) {
    let title = if critical {
        "ZodHub Pulse — tu disco está casi lleno"
    } else {
        "ZodHub Pulse — tu disco se está llenando"
    };
    let body = format!(
        "Quedan {} libres de {}. Abre ZodHub Pulse para liberar espacio.",
        fmt_gb(free),
        fmt_gb(total)
    );
    // Si el usuario no concedió permiso de notificaciones, esto falla en silencio
    // (no es un error que deba romper nada).
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Aviso cuando el disco SUELTA mucho espacio de golpe. Es justo lo que
/// confundía: la app limpió unos pocos GB pero el disco recuperó decenas. Aquí
/// se explica sin adornos: fue el sistema, no la limpieza.
fn notify_recovered(app: &AppHandle, gained: u64) {
    let body = format!(
        "Se han recuperado ~{} de espacio del sistema (basura que macOS acumula y suelta sola, no la limpieza de la app).",
        fmt_gb(gained)
    );
    let _ = app
        .notification()
        .builder()
        .title("ZodHub Pulse — espacio recuperado")
        .body(body)
        .show();
}

fn check_once(app: &AppHandle) {
    let (total, used, free) = crate::storage::disk_usage();

    // Muestreo fino: que el histórico capte el vaivén aunque no mires el panel.
    crate::storage::record_sample_watch(total, used, free);

    // Detecta una recuperación GRANDE de espacio respecto a la última medición y
    // la explica. Solo en el flanco (comparando con la lectura anterior), no en
    // cada ciclo. `swap` deja registrado el valor actual para la próxima vuelta.
    let last = LAST_FREE.swap(free, Ordering::SeqCst);
    if last != 0 && free > last && free - last >= BIG_SWING_BYTES {
        notify_recovered(app, free - last);
    }

    match danger(total, used, free) {
        Some(critical) => {
            // Solo notifica en el flanco de subida (al ENTRAR en peligro).
            if !WARNED.swap(true, Ordering::SeqCst) {
                notify(app, critical, free, total);
            }
        }
        None => {
            // Volvió a haber margen: re-armar para el próximo susto.
            WARNED.store(false, Ordering::SeqCst);
        }
    }
}

/// Arranca la vigilancia en un hilo propio. La comprobación es bloqueante
/// (lee discos con sysinfo), por eso va en su hilo y no en el bucle async.
pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK_DELAY);
        loop {
            check_once(&app);
            std::thread::sleep(CHECK_EVERY);
        }
    });
}

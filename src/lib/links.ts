import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";

/**
 * Abre un enlace en el navegador del sistema (no dentro de la app).
 *
 * Importante: las páginas externas se abren SIEMPRE fuera, en el navegador del
 * usuario. Así la app no incrusta contenido remoto ni carga nada de terceros,
 * que es lo coherente con ser local-first.
 */
export async function openUrl(url: string): Promise<void> {
  try {
    await tauriOpenUrl(url);
  } catch {
    // En el navegador (modo dev con vite) el plugin no existe: abrimos normal.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Configuración de red de la app.
 *
 * El backend de la plataforma ZodHub expone la superficie `/api/app/*` que la
 * app usa para la suscripción (novedades) y las donaciones. En dev apunta al
 * servidor Next local; en producción se fija con `VITE_API_BASE` (PENDIENTE de
 * confirmar el dominio HTTPS real).
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ||
  "http://localhost:3000";

/** Marcador "esta petición viene del cliente app" que el backend exige. No es secreto ni auth. */
export const APP_HEADERS: Record<string, string> = { "X-ZodHub-App": "1" };

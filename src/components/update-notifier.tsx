import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useLang } from "@/components/language-provider";

type T = ReturnType<typeof useLang>["t"];

/**
 * Aviso de actualización. Al arrancar (una sola vez) pregunta al backend si hay
 * versión nueva; si la hay, muestra un aviso con botón «Actualizar» que descarga,
 * verifica la firma, instala y reinicia con un solo clic.
 *
 * Honestidad: si no hay updater configurado (modo `dev`), no hay red, o no hay
 * versión nueva, no molesta con nada. Solo aparece cuando de verdad hay algo que
 * actualizar. Toda la lógica real (descarga/verificación/instalación) vive en el
 * plugin de Rust; aquí solo se dispara y se muestra el progreso.
 */
export function UpdateNotifier() {
  const { t } = useLang();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;

    (async () => {
      let update: Update | null = null;
      try {
        update = await check();
      } catch {
        return; // sin updater (dev), sin red o endpoint no disponible: silencio.
      }
      if (cancelled || !update) return; // check() devuelve null si no hay versión nueva
      promptInstall(update, t);
    })();

    return () => {
      cancelled = true;
    };
    // t se recrea al cambiar de idioma; el guard `ran` evita re-comprobar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Aviso persistente con la versión disminuida y el botón de actualizar. */
function promptInstall(update: Update, t: T) {
  toast(t("Actualización disponible: {v}", { v: update.version }), {
    description: update.body?.trim() || undefined,
    duration: Infinity,
    action: {
      label: t("Actualizar"),
      onClick: () => void install(update, t),
    },
  });
}

/** Descarga con progreso, instala y reinicia. */
async function install(update: Update, t: T) {
  const id = toast.loading(t("Descargando actualización…"));
  let total = 0;
  let received = 0;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          received += event.data.chunkLength;
          toast.loading(
            total
              ? t("Descargando… {p}%", {
                  p: Math.round((received / total) * 100),
                })
              : t("Descargando actualización…"),
            { id },
          );
          break;
        case "Finished":
          toast.loading(t("Instalando…"), { id });
          break;
      }
    });

    toast.success(t("Actualización lista. Reiniciando…"), { id });
    await relaunch();
  } catch (e) {
    toast.error(t("No se pudo actualizar"), { id, description: String(e) });
  }
}

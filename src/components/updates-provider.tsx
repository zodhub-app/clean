import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Estado global de actualizaciones. Comprueba si hay versión nueva al arrancar,
 * cada 6 h y a demanda. Centraliza la lógica para que la campana de la barra (y
 * cualquier otra vista) compartan el mismo estado.
 *
 * Honestidad: si no hay updater (modo `dev` o web), no hay red o el endpoint no
 * responde, el estado queda en «error» sin inventar que estás al día. Toda la
 * descarga/verificación/instalación real vive en el plugin de Rust.
 */

export type UpdateStatus =
  | "idle" // aún no se ha comprobado
  | "checking" // comprobando ahora
  | "uptodate" // sin versión nueva
  | "available" // hay actualización
  | "downloading" // descargando
  | "installing" // instalando (previo al reinicio)
  | "error"; // no se pudo comprobar/instalar

type UpdatesCtx = {
  status: UpdateStatus;
  update: Update | null;
  /** Versión nueva disponible (si la hay). */
  newVersion: string | null;
  /** Versión instalada actualmente. */
  currentVersion: string | null;
  /** Notas de la versión nueva. */
  notes: string | null;
  /** Progreso de descarga 0–100. */
  progress: number;
  lastChecked: Date | null;
  error: string | null;
  /** Número para el LED de la campana (0 o 1 por ahora). */
  count: number;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
};

const Context = createContext<UpdatesCtx | null>(null);

/** Cada cuánto se vuelve a comprobar mientras la app está abierta. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evita comprobaciones solapadas.
  const busy = useRef(false);

  const checkNow = useCallback(async () => {
    if (busy.current) return;
    // No interrumpir una descarga/instalación en curso.
    setStatus((s) =>
      s === "downloading" || s === "installing" ? s : "checking",
    );
    busy.current = true;
    try {
      const u = await check();
      if (u) {
        setUpdate(u);
        setStatus("available");
      } else {
        setUpdate(null);
        setStatus("uptodate");
      }
      setError(null);
    } catch (e) {
      // Sin updater (dev/web), sin red o endpoint caído: no fingimos «al día».
      setError(String(e));
      setStatus((s) =>
        s === "downloading" || s === "installing" ? s : "error",
      );
    } finally {
      setLastChecked(new Date());
      busy.current = false;
    }
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setStatus("downloading");
    setProgress(0);
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
            if (total) setProgress(Math.round((received / total) * 100));
            break;
          case "Finished":
            setStatus("installing");
            break;
        }
      });
      // Reinicia con la versión nueva ya instalada.
      await relaunch();
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [update]);

  // Versión instalada (mejor esfuerzo; en web/dev puede fallar).
  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion(null));
  }, []);

  // Comprobación inicial + periódica.
  useEffect(() => {
    void checkNow();
    const id = setInterval(() => void checkNow(), CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkNow]);

  const value: UpdatesCtx = {
    status,
    update,
    newVersion: update?.version ?? null,
    currentVersion,
    notes: update?.body?.trim() || null,
    progress,
    lastChecked,
    error,
    count: status === "available" ? 1 : 0,
    checkNow,
    install,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useUpdates(): UpdatesCtx {
  const ctx = useContext(Context);
  if (!ctx)
    throw new Error("useUpdates debe usarse dentro de <UpdatesProvider>");
  return ctx;
}

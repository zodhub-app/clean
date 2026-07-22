import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Caché de datos por pestaña.
 *
 * El problema: cada página monta/desmonta al navegar, así que vuelve a pedir sus
 * datos y enseña el spinner cada vez. Aquí guardamos el último resultado en una
 * caché de MÓDULO (vive mientras la app está abierta, sobrevive a cambiar de
 * pestaña). Al volver a una página, se muestran los datos al instante y solo se
 * recarga si el usuario pulsa «Actualizar» o si el auto-refresh (24 h) lo pide.
 *
 * Es en memoria (no en disco): al cerrar la app se vacía, a propósito — así los
 * tamaños/estados nunca se muestran «viejos de ayer» sin avisar.
 */

type Entry<T> = { data: T; at: number };
const store = new Map<string, Entry<unknown>>();

export function readCache<T>(key: string): Entry<T> | undefined {
  return store.get(key) as Entry<T> | undefined;
}
export function writeCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}
/** Invalida una clave (o toda la caché) — p. ej. tras una limpieza que cambia el estado. */
export function invalidateCache(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}

/** Intervalo del auto-refresh: 24 h. */
export const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000;
const AUTO_KEY = "macup.cacheAutoRefresh";

/** ¿Está activo el auto-refresh? (conmutando desde Ajustes). Por defecto sí. */
export function autoRefreshEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}
export function setAutoRefreshEnabled(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* almacenamiento no disponible: no pasa nada */
  }
}

export interface CachedResource<T> {
  /** Datos actuales (de caché o recién pedidos); `undefined` solo en la 1ª carga. */
  data: T | undefined;
  /** true SOLO cuando no hay nada que mostrar todavía (primera carga real). */
  loading: boolean;
  /** true durante una recarga teniendo ya datos visibles (no bloquea la vista). */
  refreshing: boolean;
  /** Marca de tiempo (ms) de la última carga con éxito, o null. */
  updatedAt: number | null;
  /** Fuerza una recarga (el botón «Actualizar»). */
  refresh: () => Promise<void>;
}

/**
 * Devuelve datos cacheados al instante y los recarga de forma inteligente.
 *
 * @param key      identificador único de la pestaña/recurso (p. ej. "storage:stats").
 * @param fetcher  función que trae los datos frescos.
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
): CachedResource<T> {
  const cached = readCache<T>(key);
  const [data, setData] = useState<T | undefined>(cached?.data);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.at ?? null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // El fetcher puede cambiar de identidad en cada render (closures); lo guardamos
  // en una ref para que el efecto y `refresh` usen siempre el último sin re-armar.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    // Con datos previos = recarga suave; sin ellos = primera carga.
    if (readCache<T>(key)) setRefreshing(true);
    else setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      writeCache(key, fresh);
      setData(fresh);
      setUpdatedAt(Date.now());
    } catch {
      // Se mantiene el último dato bueno (en dev web no hay backend). No se
      // rompe la vista por un fallo puntual de red/sistema.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key]);

  useEffect(() => {
    const c = readCache<T>(key);
    const auto = autoRefreshEnabled();

    if (!c) {
      // Sin caché: primera carga (igual que antes).
      void refresh();
    } else if (auto && Date.now() - c.at > AUTO_REFRESH_MS) {
      // Caché caducado: mostramos lo que hay y revalidamos en segundo plano.
      void refresh();
    } else {
      // Caché fresco: instantáneo, sin pedir nada.
      setData(c.data);
      setUpdatedAt(c.at);
      setLoading(false);
    }

    // Auto-refresh periódico mientras la página está montada (si está activo).
    if (auto) {
      const id = window.setInterval(() => void refresh(), AUTO_REFRESH_MS);
      return () => window.clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, refreshing, updatedAt, refresh };
}

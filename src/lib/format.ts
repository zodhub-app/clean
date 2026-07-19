/**
 * Formato de tamaños. LEE ESTO ANTES DE TOCAR NADA.
 *
 * Un byte es un byte, pero «GB» no significa lo mismo en cada sistema, y esta
 * app tiene que decir EXACTAMENTE lo mismo que el sistema del usuario:
 *
 *   - macOS (Finder, Utilidad de Discos, «Acerca de este Mac») y la mayoría de
 *     escritorios de Linux usan potencias de 1000: 1 GB = 1.000.000.000 B.
 *   - El Explorador de Windows usa potencias de 1024 y aun así escribe «GB».
 *
 * Antes se dividía SIEMPRE entre 1024 etiquetando «GB». Resultado: cada cifra
 * salía un 7,4 % por debajo de lo que enseña el Finder, y un disco de 1 TB
 * aparecía como «931,5 GB». Ni una sola cifra cuadraba con el sistema.
 */
type Base = 1000 | 1024;

/** Base en uso. Se fija al arrancar según el sistema; 1000 por defecto. */
let base: Base = 1000;

/**
 * Fija la convención del sistema. La llama `OsProvider` en cuanto Rust dice en
 * qué sistema estamos, antes de que se pinte ninguna cifra.
 */
export function setByteBase(os: string): void {
  base = os === "windows" ? 1024 : 1000;
}

/**
 * Bytes legibles, en la convención del sistema del usuario.
 *
 * Se usan las etiquetas de cada sistema (KB/MB/GB/TB) precisamente porque el
 * objetivo es que el número coincida con el que el usuario ve en su Finder o su
 * Explorador, no ser purista con el SI.
 */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(base)),
  );
  const value = bytes / Math.pow(base, i);
  return `${value.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  // Always include minutes so the value visibly ticks (no "frozen" look).
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

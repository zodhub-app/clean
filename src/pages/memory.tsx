import { useCallback, useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Cpu, Wind, Info, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import { getMemoryStats, purgeMemory, type MemoryStats } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/format";

type Point = { t: number; used: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Duración mínima visible del efecto de vaciado (ms). */
const MIN_FX = 4500;

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });

function levelMeta(score: number): { label: string; color: string } {
  if (score < 0.55) return { label: "Normal", color: "#10b981" };
  if (score < 0.78) return { label: "Media", color: "#f59e0b" };
  return { label: "Alta", color: "var(--destructive)" };
}

type Tag = "No liberable" | "En uso" | "Automática" | "Reclamable";

const TAG_STYLE: Record<Tag, string> = {
  "No liberable": "border-rose-500/30 bg-rose-500/10 text-rose-400",
  "En uso": "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Automática: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  Reclamable: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

function TagChip({ tag }: { tag: Tag }) {
  const { t } = useLang();
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight ${TAG_STYLE[tag]}`}
    >
      {t(tag)}
    </span>
  );
}

export function MemoryPage() {
  const { t } = useLang();
  const [mem, setMem] = useState<MemoryStats | null>(null);
  const [history, setHistory] = useState<Point[]>([]);
  const [purging, setPurging] = useState(false);
  const hist = useRef<Point[]>([]);

  const chartConfig = {
    used: { label: t("Memoria"), color: "var(--chart-2)" },
  } satisfies ChartConfig;

  const refresh = useCallback(async () => {
    try {
      const m = await getMemoryStats();
      setMem(m);
      const usedPct = m.total > 0 ? (m.used / m.total) * 100 : 0;
      hist.current = [...hist.current, { t: Date.now(), used: usedPct }].slice(-40);
      setHistory(hist.current);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const usedPct = mem && mem.total > 0 ? (mem.used / mem.total) * 100 : 0;

  // Presión aproximada: fracción NO recuperable. NO es la métrica exacta de
  // Apple y así se etiqueta en la interfaz.
  //
  // `cached` NO entra en la suma: son páginas respaldadas por archivo que ya
  // están contadas dentro de `inactive` (y de `active`). Sumarlas las contaba
  // dos veces, lo que hacía que `reclaimable` pudiera superar el total y el
  // resultado saliera NEGATIVO. Una aproximación que puede ser negativa no es
  // una aproximación, es un error.
  const reclaimable = mem ? mem.free + mem.inactive : 0;
  let score = mem && mem.total > 0 ? 1 - reclaimable / mem.total : 0;
  // Cinturón: por muy raro que venga el dato, la presión vive entre 0 y 1.
  score = Math.min(1, Math.max(0, score));
  if (mem && mem.swap_used > 0) score = Math.max(score, 0.6);
  const meta = levelMeta(score);

  async function handlePurge() {
    const before = mem?.used ?? 0;
    setPurging(true);
    const t0 = performance.now();
    try {
      await purgeMemory();
      const after = await getMemoryStats();
      // La purga es real; mantenemos la animación de vaciado un mínimo creíble.
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      setMem(after);
      const usedPct = after.total > 0 ? (after.used / after.total) * 100 : 0;
      hist.current = [...hist.current, { t: Date.now(), used: usedPct }].slice(-40);
      setHistory(hist.current);

      // NO se anuncia una cifra de memoria liberada.
      //
      // La diferencia entre el antes y el después NO se puede atribuir a la
      // purga: entre las dos lecturas hay decenas de procesos reservando y
      // soltando memoria por su cuenta. Si Safari suelta 500 MB en ese instante,
      // la app se apuntaba el mérito. Es el mismo error que ya se corrigió en
      // el espacio de disco, y aquí es aún menos defendible porque la memoria
      // cambia mil veces por segundo.
      //
      // Se dice lo que sí es cierto: la purga se ha ejecutado. El efecto se ve
      // en el propio panel, que se acaba de refrescar con datos reales.
      const delta = before - after.used;
      toast.success(t("Purga completada"), {
        description:
          delta > 0
            ? t(
                "La memoria en uso ha bajado {n2} entre las dos lecturas, aunque parte de ese cambio puede venir de otros programas.",
                { n2: formatBytes(delta) },
              )
            : t(
                "El sistema apenas tenía cachés que soltar en este momento; es lo habitual.",
              ),
      });
    } catch (err) {
      toast.error(t("No se pudo liberar la memoria"), {
        description: String(err),
      });
    } finally {
      setPurging(false);
    }
  }

  const breakdown = mem
    ? [
        {
          label: "Wired",
          value: mem.wired,
          color: "var(--chart-5)",
          tag: "No liberable" as Tag,
          desc: "Memoria del núcleo y los drivers. Reside siempre en RAM; no se puede paginar ni liberar.",
        },
        {
          label: "Activa",
          value: mem.active,
          color: "var(--chart-1)",
          tag: "En uso" as Tag,
          desc: "Memoria que las apps abiertas están usando ahora mismo. No se libera mientras siga en uso.",
        },
        {
          label: "Comprimida",
          value: mem.compressed,
          color: "var(--chart-4)",
          tag: "Automática" as Tag,
          desc: "Datos poco usados que macOS comprime dentro de la RAM para evitar ir al disco. Se gestiona solo.",
        },
        {
          label: "Inactiva",
          value: mem.inactive,
          color: "var(--chart-2)",
          tag: "Reclamable" as Tag,
          desc: "Datos recientes que ya no se usan pero siguen en RAM por si vuelven a hacer falta. macOS los reclama al instante si hay presión.",
        },
      ]
    : [];

  // «Caché de archivos» YA NO es una barra más. En `vm_stat`, las páginas
  // respaldadas por archivo están repartidas dentro de activa e inactiva: es un
  // corte transversal, no una categoría aparte. Pintarla como quinta barra
  // hacía que la suma pasara del 100 % de la RAM instalada. Se muestra abajo
  // como dato informativo, sin sumarse.
  const fileCache = mem?.cached ?? 0;

  // Barras proporcionales al TOTAL de RAM (porcentaje real ocupado), no al
  // máximo del grupo: así reflejan honestamente cuánta memoria ocupa cada parte.
  const totalMem = mem?.total ?? 0;

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-500" />
        <p>
          {t(
            "macOS gestiona la memoria automáticamente y muy bien. Liberar (purga) solo vacía cachés inactivas; rara vez hace falta y puede ralentizar brevemente las apps mientras recargan datos. Úsalo solo si notas el equipo atascado.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {/* Presión / uso en vivo */}
        <Card data-slot="card" className="relative gap-2 py-3">
          <CardHeader className="px-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Cpu className="size-3.5" />
                {t("Memoria en uso")}
              </span>
              <span
                className="flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: meta.color }}
                title={t(
                  "Aproximación: fracción de memoria no reclamable. No es la métrica exacta de presión de Apple.",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {t("Presión {label}", { label: t(meta.label) })}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums leading-none">
                {mem ? formatPercent(usedPct) : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {mem
                  ? t("{a} de {b}", {
                      a: formatBytes(mem.used),
                      b: formatBytes(mem.total),
                    })
                  : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-2">
            <ChartContainer config={chartConfig} className="chart-well h-[120px] w-full">
              <AreaChart
                data={history}
                margin={{ left: 4, right: 4, top: 6, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fill-mem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-used)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-used)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical
                  horizontal
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.28}
                />
                <XAxis dataKey="t" hide />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(_, p) =>
                        p?.[0] ? fmtClock(p[0].payload.t) : ""
                      }
                      formatter={(v) => `${Number(v).toFixed(1)}%`}
                    />
                  }
                />
                <Area
                  dataKey="used"
                  type="monotone"
                  stroke="var(--color-used)"
                  strokeWidth={2}
                  fill="url(#fill-mem)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                {mem && mem.swap_total > 0
                  ? t("Swap: {a} de {b}", {
                      a: formatBytes(mem.swap_used),
                      b: formatBytes(mem.swap_total),
                    })
                  : t("Swap: sin uso")}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={purging}
                onClick={handlePurge}
              >
                <Wind className="size-3.5" />
                {t("Liberar memoria inactiva")}
              </Button>
            </div>
          </CardContent>
          {purging && (
            <CleanOverlay
              label={t("Liberando memoria…")}
              sub={t("Vaciando cachés inactivas")}
              durationMs={MIN_FX}
            />
          )}
        </Card>

        {/* Desglose */}
        <Card data-slot="card" className="gap-2 py-3">
          <CardHeader className="px-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("Desglose")}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 px-4">
            {breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("Cargando…")}</p>
            ) : (
              breakdown.map((b) => {
                const pct = totalMem ? (b.value / totalMem) * 100 : 0;
                return (
                  <div key={b.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        {t(b.label)}
                      </span>
                      <span className="tabular-nums">
                        {formatBytes(b.value)}
                        <span className="ml-1 text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: b.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Dato transversal, NO una categoría más: estas páginas ya están
                contadas dentro de las barras de arriba. Se muestra aparte y sin
                barra justo para que no parezca sumable. */}
            {fileCache > 0 && (
              <p className="mt-1 border-t pt-2.5 text-[11px] leading-5 text-muted-foreground">
                {t(
                  "De lo anterior, {n} son caché de archivos: contenido leído del disco que el sistema conserva para acelerar próximos accesos y descarta sin coste si hace falta. No es memoria adicional, ya está incluida en las barras.",
                  { n: formatBytes(fileCache) },
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Esquema explicativo: qué es y qué representa cada dato. */}
      <Card data-slot="card" className="gap-2 py-3">
        <CardHeader className="px-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Info className="size-3.5" />
            {t("¿Qué significa cada dato?")}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {breakdown
              .filter((b) => b.label !== "Caché de archivos")
              .map((b) => (
              <div
                key={b.label}
                className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    {t(b.label)}
                  </span>
                  <TagChip tag={b.tag} />
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {t(b.desc)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Gauge className="size-3.5 text-sky-400" />
                {t("Cómo se mide")}
              </span>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(
                  "Datos reales de macOS vía vm_stat: páginas de cada tipo × el tamaño de página del Mac (16 KB en Apple Silicon).",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Wind className="size-3.5 text-emerald-400" />
                {t("Qué hace «Liberar»")}
              </span>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(
                  "Ejecuta purge (con permiso de admin): vacía la caché de archivos y las páginas reclamables. No toca lo que está en uso.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Info className="size-3.5 text-amber-400" />
                {t("Por qué rara vez ayuda")}
              </span>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(
                  "macOS ya libera memoria solo cuando hay presión, y vuelve a cachear enseguida. La memoria «Activa» nunca baja: está en uso.",
                )}
              </p>
            </div>
          </div>

          <p className="text-[10px] leading-snug text-muted-foreground/70">
            {t(
              "Nota: estas categorías provienen de vm_stat y no suman exactamente el total de RAM, porque algunas se solapan (p. ej. la caché de archivos puede contarse también como activa o inactiva).",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

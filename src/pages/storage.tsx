import { useMemo } from "react";
import { useCachedResource } from "@/hooks/use-cached-resource";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HardDrive, Camera, RefreshCw, Info, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/language-provider";
import { formatBytes, formatPercent } from "@/lib/format";
import {
  getStorageStats,
  getStorageHistory,
  getHomeBreakdown,
  type StorageStats,
  type StorageSample,
  type DiskItem,
} from "@/lib/api";

const AREA_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const fmtDay = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString([], { day: "2-digit", month: "short" });

export function StoragePage() {
  const { t } = useLang();
  // Caché de pestaña: al volver a Almacenamiento, las cifras y el desglose salen
  // al instante. El mapa de la carpeta (más lento) tiene su propia entrada, así
  // que se rellena aparte sin bloquear el resto.
  const {
    data: stats,
    loading,
    refresh: refreshStats,
  } = useCachedResource<StorageStats>("storage:stats", getStorageStats);
  const { data: history = [], refresh: refreshHistory } =
    useCachedResource<StorageSample[]>("storage:history", getStorageHistory);
  const {
    data: home = [],
    loading: homeLoading,
    refresh: refreshHome,
  } = useCachedResource<DiskItem[]>("storage:home", getHomeBreakdown);

  function refresh() {
    void refreshStats();
    void refreshHistory();
    void refreshHome();
  }

  const usedPct = stats && stats.total > 0 ? (stats.used / stats.total) * 100 : 0;
  // Umbrales de aviso de disco lleno. "crítico" = casi sin margen (riesgo de
  // que el sistema no arranque bien o apps fallen); "alto" = conviene actuar.
  const diskLevel: "ok" | "high" | "critical" = !stats
    ? "ok"
    : usedPct >= 92 || stats.free < 15 * 1024 ** 3
      ? "critical"
      : usedPct >= 85
        ? "high"
        : "ok";

  const areas = useMemo(
    () =>
      (stats?.areas ?? [])
        .filter((a) => a.exists && a.size > 0)
        .sort((a, b) => b.size - a.size),
    [stats],
  );
  const volumes = useMemo(
    () => (stats?.volumes ?? []).slice().sort((a, b) => b.consumed - a.consumed),
    [stats],
  );

  // Vaivén reciente del disco. Responde al lío de "limpié 3,7 GB pero se
  // liberaron 150": macOS acumula espacio recuperable (cachés, instantáneas,
  // temporales del sistema) y lo suelta solo, así que el "usado" sube y baja sin
  // que borres nada. Si en los últimos días hubo un salto grande, se explica.
  const recentSwing = useMemo(() => {
    const now = Date.now() / 1000;
    const recent = history.filter((s) => now - s.t < 7 * 24 * 3600);
    if (recent.length < 2) return 0;
    let min = Infinity;
    let max = -Infinity;
    for (const s of recent) {
      if (s.used < min) min = s.used;
      if (s.used > max) max = s.used;
    }
    return max - min;
  }, [history]);
  const SWING_THRESHOLD = 20 * 1024 ** 3; // 20 GB

  // Desglose REAL que SÍ suma el disco usado. En vez de una lista de basura que
  // no cuadra con nada, se muestra dónde está de verdad el espacio:
  //   - tus carpetas de usuario (Proyectos, Recursos, Library, Movies…), medidas
  //     de verdad en disco (home_breakdown, como `du -sh ~/*`);
  //   - Aplicaciones (/Applications, fuera de tu carpeta);
  //   - "Sistema y otros" = usado − todo lo anterior (nunca negativo): lo que
  //     vive fuera de tu carpeta (sistema, otras cuentas, cachés del sistema…).
  // Así las barras suman el total y respondes de un vistazo "¿dónde está mi
  // espacio?" con datos reales, no con estimaciones.
  const breakdown = useMemo(() => {
    const used = stats?.used ?? 0;
    if (used <= 0) return [] as { key: string; label: string; size: number; color: string }[];
    const items = home.map((h, i) => ({
      key: `home:${h.name}`,
      label: h.name, // nombre real de carpeta: NO se traduce
      size: h.size,
      color: AREA_COLORS[i % AREA_COLORS.length],
    }));
    const apps = areas.find((a) => a.key === "applications");
    if (apps && apps.size > 0) {
      items.push({
        key: "applications",
        label: t("Aplicaciones"),
        size: apps.size,
        color: "var(--chart-4)",
      });
    }
    const sum = items.reduce((s, b) => s + b.size, 0);
    const rest = Math.max(0, used - sum);
    if (rest > 0) {
      items.push({
        key: "rest",
        label: t("Sistema y otros (fuera de tu carpeta)"),
        size: rest,
        color: "var(--muted-foreground)",
      });
    }
    return items.filter((b) => b.size > 0).sort((a, b) => b.size - a.size);
  }, [stats, areas, home, t]);

  const chartConfig = {
    used: { label: t("Usado"), color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* Aviso de disco lleno — lo que faltaba: avisar ANTES de quedarte sin espacio */}
      {diskLevel !== "ok" && stats && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
            diskLevel === "critical"
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              diskLevel === "critical" ? "text-red-400" : "text-amber-400",
            )}
          />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {diskLevel === "critical"
                ? t("Tu disco está casi lleno.")
                : t("Tu disco se está llenando.")}
            </span>
            <span className="opacity-90">
              {t(
                "Quedan {c} libres de {b} ({p} usado). Libera basura en «Liberar espacio» y revisa apps y archivos grandes en el Explorador.",
                {
                  c: formatBytes(stats.free),
                  b: formatBytes(stats.total),
                  p: formatPercent(usedPct),
                },
              )}
            </span>
          </div>
        </div>
      )}

      {/* Uso global del disco */}
      <Card data-slot="card" className="gap-2 py-3">
        <CardHeader className="px-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <HardDrive className="size-3.5" />
              {t("Almacenamiento")}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={refresh}
              disabled={loading || homeLoading}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              {t("Analizar")}
            </Button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums leading-none">
              {stats ? formatPercent(usedPct) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats
                ? t("{a} usados de {b} · {c} libres", {
                    a: formatBytes(stats.used),
                    b: formatBytes(stats.total),
                    c: formatBytes(stats.free),
                  })
                : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          {stats && stats.snapshots > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Camera className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              {t(
                "{n} instantáneas locales de Time Machine. Cuentan como «usado» pero son recuperables: al liberarlas (pestaña Instantáneas), macOS suelta el espacio poco a poco, así que verás el «usado» bajar solo durante un rato.",
                { n: stats.snapshots },
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Explica el vaivén: por qué el disco sube/baja solo (basura del sistema) */}
      {recentSwing >= SWING_THRESHOLD && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-500" />
          <p>
            {t(
              "En los últimos días tu disco ha variado ~{s} solo. Es «basura del sistema»: macOS acumula espacio recuperable (cachés, instantáneas y archivos temporales) y lo suelta él mismo, así que el «usado» sube y baja aunque no borres nada. Por eso puede que la app limpie unos pocos GB y, aparte, el disco recupere muchos más: eso último lo hace el sistema, no la limpieza.",
              { s: formatBytes(recentSwing) },
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {/* Volúmenes APFS */}
        <Card data-slot="card" className="gap-2 py-3">
          <CardHeader className="px-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("Volúmenes APFS")}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 px-4">
            {loading && !stats ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))
            ) : volumes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("Sin datos")}</p>
            ) : (
              volumes.map((v) => {
                const pct = stats && stats.total > 0 ? (v.consumed / stats.total) * 100 : 0;
                return (
                  <div key={v.name + v.role} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground">
                        {v.name}
                        {v.role ? ` · ${v.role}` : ""}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatBytes(v.consumed)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-chart-2 transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: "var(--chart-2)",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* En qué se usa tu disco — suma el total usado */}
        <Card data-slot="card" className="gap-2 py-3">
          <CardHeader className="px-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("En qué se usa tu disco")}
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                {t(
                  "Tus carpetas reales, Aplicaciones y el sistema. Suma el total usado; para bajar más al detalle, usa el Explorador.",
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 px-4">
            {(loading && !stats) || (homeLoading && home.length === 0) ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))
            ) : breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("Nada destacable por aquí.")}
              </p>
            ) : (
              breakdown.map((b) => {
                const used = stats?.used ?? 0;
                const pct = used > 0 ? (b.size / used) * 100 : 0;
                return (
                  <div key={b.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        {b.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatBytes(b.size)}
                        <span className="ml-1 opacity-60">
                          {used > 0 ? `· ${formatPercent(pct)}` : ""}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: b.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de crecimiento */}
      {history.length >= 2 && (
        <Card data-slot="card" className="gap-2 py-3">
          <CardHeader className="px-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("Evolución del espacio usado")}
            </span>
          </CardHeader>
          <CardContent className="px-2">
            <ChartContainer config={chartConfig} className="chart-well h-[140px] w-full">
              <AreaChart
                data={history}
                margin={{ left: 4, right: 4, top: 6, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fill-storage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-used)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-used)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.28}
                />
                <XAxis dataKey="t" hide />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(_, p) => (p?.[0] ? fmtDay(p[0].payload.t) : "")}
                      formatter={(v) => formatBytes(Number(v))}
                    />
                  }
                />
                <Area
                  dataKey="used"
                  type="monotone"
                  stroke="var(--color-used)"
                  strokeWidth={2}
                  fill="url(#fill-storage)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-snug text-muted-foreground/80">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t(
          "Solo lectura: aquí nada se borra. El «usado» lo da macOS e incluye espacio purgable (instantáneas y cachés que el sistema gestiona y suelta solo), por eso puede subir o bajar sin que hagas nada. Ojo: «Liberar espacio» solo elimina basura regenerable —lo que ahí ponga es lo que de verdad se limpia—; las bajadas grandes del disco son macOS soltando ese espacio purgable, no la limpieza. El histórico se va formando cada vez que abres esta pestaña.",
        )}
      </p>
    </div>
  );
}

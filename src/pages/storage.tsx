import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HardDrive, Camera, RefreshCw, Info } from "lucide-react";
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
  type StorageStats,
  type StorageSample,
} from "@/lib/api";

/** Etiqueta legible por clave de área (se traduce con t()). */
const AREA_LABEL: Record<string, string> = {
  caches: "Cachés de usuario",
  xcode: "Xcode DerivedData",
  docker: "Docker",
  huggingface: "Modelos HuggingFace",
  ollama: "Modelos Ollama",
  downloads: "Descargas",
  trash: "Papelera",
  applications: "Aplicaciones",
};

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
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [history, setHistory] = useState<StorageSample[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([getStorageStats(), getStorageHistory()]);
      setStats(s);
      setHistory(h);
    } catch {
      /* en dev web no hay backend */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usedPct = stats && stats.total > 0 ? (stats.used / stats.total) * 100 : 0;

  const areas = useMemo(
    () =>
      (stats?.areas ?? [])
        .filter((a) => a.exists && a.size > 0)
        .sort((a, b) => b.size - a.size),
    [stats],
  );
  const areaMax = Math.max(1, ...areas.map((a) => a.size));

  const volumes = useMemo(
    () => (stats?.volumes ?? []).slice().sort((a, b) => b.consumed - a.consumed),
    [stats],
  );

  const chartConfig = {
    used: { label: t("Usado"), color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div className="flex w-full flex-col gap-2.5">
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
              onClick={load}
              disabled={loading}
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
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Camera className="size-3.5 text-amber-500" />
              {t("{n} instantáneas APFS locales (ocupan espacio recuperable).", {
                n: stats.snapshots,
              })}
            </p>
          )}
        </CardContent>
      </Card>

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

        {/* Áreas que más ocupan */}
        <Card data-slot="card" className="gap-2 py-3">
          <CardHeader className="px-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("Qué ocupa más")}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 px-4">
            {loading && !stats ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))
            ) : areas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("Nada destacable por aquí.")}
              </p>
            ) : (
              areas.map((a, i) => (
                <div key={a.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
                      />
                      {t(AREA_LABEL[a.key] ?? a.key)}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatBytes(a.size)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(a.size / areaMax) * 100}%`,
                        backgroundColor: AREA_COLORS[i % AREA_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))
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
          "Solo lectura: aquí nada se borra. Los tamaños son reales (medidos en disco) y las áreas pueden solaparse, así que no suman el total. El histórico se va formando cada vez que abres esta pestaña.",
        )}
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Cpu, HardDrive, MemoryStick, Thermometer } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { SecurityGlobe } from "@/components/security-globe";
import { NetworkMonitor } from "@/components/network-monitor";
import { HeroBanner } from "@/components/hero-banner";
import { CleanupHero } from "@/components/cleanup-hero";
import { useLang } from "@/components/language-provider";
import { useSystemStats } from "@/hooks/use-system-stats";
import { useNetworkStats } from "@/hooks/use-network-stats";
import type { StatsPoint } from "@/hooks/use-system-stats";
import { getSensors } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/format";

function tempStatus(t: number): { label: string; color: string } {
  if (t <= 65) return { label: "Temperatura estable", color: "#10b981" };
  if (t <= 80) return { label: "Temperatura alta", color: "#f59e0b" };
  if (t <= 90) return { label: "Temperatura muy alta", color: "#f97316" };
  return { label: "Temperatura crítica", color: "var(--destructive)" };
}

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], {
    minute: "2-digit",
    second: "2-digit",
  });

/** True una vez el hilo principal está libre: difiere el montaje de lo pesado
 *  (globo WebGL + gráficos) para que la app sea interactiva al instante. */
function useReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

export function DashboardPage() {
  const { current, history, error } = useSystemStats();
  const net = useNetworkStats();
  const ready = useReady();
  const { t } = useLang();

  // Debug temporal: vuelca los sensores de temperatura a la consola para
  // identificar el de la CPU en este Mac.
  useEffect(() => {
    getSensors()
      .then((s) => console.log("[ZodHub Clean] Sensores de temperatura:", s))
      .catch(() => {});
  }, []);

  const ramPct =
    current && current.mem_total > 0
      ? (current.mem_used / current.mem_total) * 100
      : 0;
  const diskPct =
    current && current.disk_total > 0
      ? (current.disk_used / current.disk_total) * 100
      : 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 overflow-hidden p-2.5">
      <div className="shrink-0">
        <HeroBanner />
      </div>

      <div className="shrink-0">
        <CleanupHero />
      </div>

      {error && (
        <p className="shrink-0 text-xs text-muted-foreground">
          {t("No se pudieron leer las métricas del sistema.")}
        </p>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Metric
          icon={<Cpu className="size-3.5" />}
          label="CPU"
          value={current ? formatPercent(current.cpu_usage) : "—"}
          hint={t("uso global")}
          pct={current ? current.cpu_usage : 0}
          color="var(--chart-1)"
        />
        <Metric
          icon={<MemoryStick className="size-3.5" />}
          label={t("Memoria")}
          value={current ? formatPercent(ramPct) : "—"}
          hint={
            current
              ? t("{a} de {b}", {
                  a: formatBytes(current.mem_used),
                  b: formatBytes(current.mem_total),
                })
              : "—"
          }
          pct={ramPct}
          color="var(--chart-2)"
        />
        <Metric
          icon={<HardDrive className="size-3.5" />}
          label={t("Disco")}
          value={current ? formatPercent(diskPct) : "—"}
          hint={
            current
              ? t("{a} de {b}", {
                  a: formatBytes(current.disk_used),
                  b: formatBytes(current.disk_total),
                })
              : "—"
          }
          pct={diskPct}
          color="var(--chart-3)"
        />
        <Metric
          icon={<Thermometer className="size-3.5" />}
          label={t("Temperatura")}
          value={
            current && current.temp != null
              ? `${Math.round(current.temp)}°C`
              : "—"
          }
          hint={
            current && current.temp != null
              ? t(tempStatus(current.temp).label)
              : t("sin sensores en este equipo")
          }
          pct={current && current.temp != null ? current.temp : undefined}
          color={
            current && current.temp != null
              ? tempStatus(current.temp).color
              : undefined
          }
        />
      </div>

      {ready ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row">
            {/* Izquierda: gráficos apilados; se reparten el alto disponible. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <Trend
                title="CPU"
                dataKey="cpu"
                color="var(--chart-1)"
                data={history}
                current={current ? formatPercent(current.cpu_usage, 1) : "—"}
              />
              <Trend
                title={t("Memoria")}
                dataKey="ram"
                color="var(--chart-2)"
                data={history}
                current={current ? formatPercent(ramPct, 1) : "—"}
              />
            </div>

            {/* Derecha: globo de amenazas de seguridad. */}
            <SecurityGlobe net={net} className="min-h-0 flex-1" />
          </div>

          {/* Abajo: red en formato Monitor de Actividad. */}
          <NetworkMonitor net={net} className="shrink-0" />
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row">
            <div className="min-h-0 flex-1 animate-pulse rounded-lg border bg-card/40" />
            <div className="min-h-0 flex-1 animate-pulse rounded-lg border bg-card/40" />
          </div>
          <div className="h-28 shrink-0 animate-pulse rounded-lg border bg-card/40" />
        </>
      )}
    </div>
  );
}

function Trend({
  title,
  dataKey,
  color,
  data,
  current,
}: {
  title: string;
  dataKey: "cpu" | "ram";
  color: string;
  data: StatsPoint[];
  current: string;
}) {
  // Auto-scale Y to the recent min/max so small real fluctuations read as waves.
  const domain = useMemo<[number, number]>(() => {
    const vals = data.map((d) => d[dataKey]).filter((v) => Number.isFinite(v));
    if (!vals.length) return [0, 1];
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = Math.max((max - min) * 0.3, 0.4);
    return [Math.max(0, min - pad), max + pad];
  }, [data, dataKey]);

  const config = {
    [dataKey]: { label: title, color },
  } satisfies ChartConfig;
  const gid = `fill-${dataKey}`;

  return (
    <Card data-slot="card" className="flex min-h-0 flex-1 flex-col gap-1 py-3">
      <CardHeader className="shrink-0 px-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color }}>
            {current}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-2">
        <ChartContainer
          config={config}
          className="chart-well min-h-0 w-full flex-1"
        >
          <AreaChart data={data} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.4} />
                <stop offset="100%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical
              horizontal
              stroke="var(--muted-foreground)"
              strokeOpacity={0.28}
            />
            <XAxis dataKey="ts" hide />
            <YAxis hide domain={domain} />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, p) =>
                    p?.[0] ? fmtClock(p[0].payload.ts) : ""
                  }
                  formatter={(v) => `${Number(v).toFixed(1)}%`}
                />
              }
            />
            <Area
              dataKey={dataKey}
              type="monotone"
              fill={`url(#${gid})`}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  pct,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  pct?: number;
  color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div data-slot="card" className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums leading-none">
        {value}
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all")}
            style={{
              width: `${clamped}%`,
              backgroundColor: color ?? "var(--primary)",
            }}
          />
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

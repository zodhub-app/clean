import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Network } from "lucide-react";
import type { NetworkLive } from "@/hooks/use-network-stats";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/language-provider";

const RX = "var(--chart-2)"; // recibido
const TX = "var(--destructive)"; // enviado

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded px-2 py-1">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span
        className="shrink-0 text-[11px] font-medium tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

export function NetworkMonitor({
  net,
  className,
}: {
  net: NetworkLive;
  className?: string;
}) {
  const { t, lang } = useLang();
  const num = (n: number) =>
    Math.round(n).toLocaleString(lang === "es" ? "es-ES" : "en-US");
  const data = net.history.map((h) => ({ t: h.t, rx: h.rxR, tx: -h.txR }));
  const peak = Math.max(
    1,
    ...net.history.map((h) => Math.max(h.rxR, h.txR)),
  );

  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Network className="size-3.5" />
        {t("Red")}
      </div>

      <div className="grid flex-1 grid-cols-1 items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_1.3fr_1fr]">
        {/* Izquierda: paquetes */}
        <div className="data-rows flex flex-col">
          <Stat label={t("Paquetes recibidos")} value={num(net.pktRxTotal)} />
          <Stat label={t("Paquetes enviados")} value={num(net.pktTxTotal)} />
          <Stat label={t("Recibidos/s")} value={num(net.pktRxRate)} color={RX} />
          <Stat label={t("Enviados/s")} value={num(net.pktTxRate)} color={TX} />
        </div>

        {/* Centro: gráfico de paquetes (recibido arriba, enviado abajo) */}
        <div className="flex flex-col">
          <span className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Paquetes")}
          </span>
          <div className="chart-well h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
              >
                <defs>
                  <linearGradient id="netrx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RX} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={RX} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="nettx" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={TX} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={TX} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.28}
                />
                <XAxis dataKey="t" hide />
                <YAxis hide domain={[-peak * 1.1, peak * 1.1]} />
                <Area
                  dataKey="rx"
                  type="monotone"
                  stroke={RX}
                  strokeWidth={1.5}
                  fill="url(#netrx)"
                  baseValue={0}
                  isAnimationActive={false}
                  dot={false}
                />
                <Area
                  dataKey="tx"
                  type="monotone"
                  stroke={TX}
                  strokeWidth={1.5}
                  fill="url(#nettx)"
                  baseValue={0}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Derecha: datos (bytes) */}
        <div className="data-rows flex flex-col">
          <Stat label={t("Datos recibidos")} value={formatBytes(net.rxTotal)} />
          <Stat label={t("Datos enviados")} value={formatBytes(net.txTotal)} />
          <Stat
            label={t("Recibidos/s")}
            value={`${formatBytes(net.rxRate)}/s`}
            color={RX}
          />
          <Stat
            label={t("Enviados/s")}
            value={`${formatBytes(net.txRate)}/s`}
            color={TX}
          />
        </div>
      </div>
    </div>
  );
}

export default NetworkMonitor;

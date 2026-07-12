import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTopProcesses, type ProcInfo, type TopProcesses } from "@/lib/api";
import { formatBytes } from "@/lib/format";

function useTopProcesses(intervalMs = 2500) {
  const [data, setData] = useState<TopProcesses | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await getTopProcesses();
        if (alive) setData(d);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return data;
}

function Row({
  p,
  pct,
  value,
  color,
}: {
  p: ProcInfo;
  pct: number;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
      <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

export function ProcessesPanel({ className }: { className?: string }) {
  const data = useTopProcesses();
  const maxMem = Math.max(1, ...(data?.by_mem.map((p) => p.mem) ?? [1]));

  return (
    <div
      data-slot="card"
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card ${className ?? ""}`}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Activity className="size-3.5" />
          Monitor de actividad
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {data ? `${data.total} procesos` : "…"}
        </span>
      </div>

      <Tabs defaultValue="cpu" className="mt-2 min-h-0 flex-1 gap-2">
        <TabsList className="mx-4 h-7">
          <TabsTrigger value="cpu" className="text-xs">
            Por CPU
          </TabsTrigger>
          <TabsTrigger value="mem" className="text-xs">
            Por memoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cpu" className="min-h-0 overflow-auto pb-2">
          {data?.by_cpu.map((p) => (
            <Row
              key={p.pid}
              p={p}
              pct={p.cpu}
              value={`${p.cpu.toFixed(1)}%`}
              color="var(--chart-1)"
            />
          ))}
        </TabsContent>

        <TabsContent value="mem" className="min-h-0 overflow-auto pb-2">
          {data?.by_mem.map((p) => (
            <Row
              key={p.pid}
              p={p}
              pct={(p.mem / maxMem) * 100}
              value={formatBytes(p.mem)}
              color="var(--chart-2)"
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProcessesPanel;

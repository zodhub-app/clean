import { useEffect, useRef, useState } from "react";
import { getSystemStats, type SystemStats } from "@/lib/api";

export type StatsPoint = {
  ts: number; // epoch ms
  cpu: number; // %
  ram: number; // %
};

export type UseSystemStats = {
  current: SystemStats | null;
  history: StatsPoint[];
  error: string | null;
};

const MAX_POINTS = 60;

export function useSystemStats(intervalMs = 1000): UseSystemStats {
  const [current, setCurrent] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<StatsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const s = await getSystemStats();
        if (!alive) return;
        setCurrent(s);
        setError(null);
        const ramPct = s.mem_total > 0 ? (s.mem_used / s.mem_total) * 100 : 0;
        // Keep one decimal: real activity micro-fluctuates, and the charts
        // auto-scale, so this is what makes the lines wave instead of flatline.
        const point: StatsPoint = {
          ts: Date.now(),
          cpu: Math.round(s.cpu_usage * 10) / 10,
          ram: Math.round(ramPct * 10) / 10,
        };
        setHistory((h) => [...h, point].slice(-MAX_POINTS));
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      }
    }

    tick();
    timer.current = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { current, history, error };
}

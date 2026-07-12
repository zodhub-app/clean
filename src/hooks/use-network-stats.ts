import { useEffect, useRef, useState } from "react";
import { getNetworkStats } from "@/lib/api";

export type ThreatLevel = "tranquila" | "normal" | "elevada" | "agresiva";

export type NetPoint = { t: number; rxR: number; txR: number };

export type NetworkLive = {
  // Per-second rates
  rxRate: number; // bytes/s
  txRate: number; // bytes/s
  pktRxRate: number; // packets/s
  pktTxRate: number; // packets/s
  // Cumulative totals
  rxTotal: number; // bytes
  txTotal: number;
  pktRxTotal: number; // packets
  pktTxTotal: number;
  // Sockets
  established: number;
  listening: number;
  // Derived intensity
  score: number;
  level: ThreatLevel;
  ready: boolean;
  // Rolling history of packet rates for the live graph
  history: NetPoint[];
};

const EMPTY: NetworkLive = {
  rxRate: 0,
  txRate: 0,
  pktRxRate: 0,
  pktTxRate: 0,
  rxTotal: 0,
  txTotal: 0,
  pktRxTotal: 0,
  pktTxTotal: 0,
  established: 0,
  listening: 0,
  score: 0,
  level: "tranquila",
  ready: false,
  history: [],
};

const MAX_POINTS = 40;

function levelFromScore(score: number): ThreatLevel {
  if (score < 0.15) return "tranquila";
  if (score < 0.4) return "normal";
  if (score < 0.72) return "elevada";
  return "agresiva";
}

/**
 * Real network telemetry from the Mac: cumulative bytes/packets diffed into
 * per-second rates, plus an honest activity/exposure score. Poll ONCE and share
 * the result with every consumer (globe + monitor).
 */
export function useNetworkStats(intervalMs = 2000): NetworkLive {
  const [live, setLive] = useState<NetworkLive>(EMPTY);
  const prev = useRef<{
    rx: number;
    tx: number;
    prx: number;
    ptx: number;
    ts: number;
  } | null>(null);
  const hist = useRef<NetPoint[]>([]);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const s = await getNetworkStats();
        if (!alive) return;
        const now = performance.now();
        const p = prev.current;
        prev.current = {
          rx: s.rx_total,
          tx: s.tx_total,
          prx: s.pkt_rx_total,
          ptx: s.pkt_tx_total,
          ts: now,
        };
        if (!p) return; // need two samples for a rate

        const dt = Math.max(0.001, (now - p.ts) / 1000);
        const rxRate = Math.max(0, (s.rx_total - p.rx) / dt);
        const txRate = Math.max(0, (s.tx_total - p.tx) / dt);
        const pktRxRate = Math.max(0, (s.pkt_rx_total - p.prx) / dt);
        const pktTxRate = Math.max(0, (s.pkt_tx_total - p.ptx) / dt);

        hist.current = [
          ...hist.current,
          { t: Date.now(), rxR: pktRxRate, txR: pktTxRate },
        ].slice(-MAX_POINTS);

        const rate = rxRate + txRate;
        const rateScore = Math.min(1, rate / (5 * 1024 * 1024));
        const connScore = Math.min(1, s.established / 200);
        const score = Math.max(rateScore, connScore * 0.85);

        setLive({
          rxRate,
          txRate,
          pktRxRate,
          pktTxRate,
          rxTotal: s.rx_total,
          txTotal: s.tx_total,
          pktRxTotal: s.pkt_rx_total,
          pktTxTotal: s.pkt_tx_total,
          established: s.established,
          listening: s.listening,
          score,
          level: levelFromScore(score),
          ready: true,
          history: hist.current,
        });
      } catch {
        /* ignore single failures */
      }
    }

    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return live;
}

// SecurityGlobe — radar de red sobre el <Globe> genérico.
//
// Honestidad ante todo: ZodHub Clean no es un cortafuegos ni un IDS. Este panel NO
// inventa un feed de ataques reales. Lo que muestra es:
//   1. Una REPRESENTACIÓN del ruido constante de escaneos/ataques automáticos
//      que recibe cualquier equipo conectado a internet (fenómeno real).
//   2. Una INTENSIDAD calculada con telemetría REAL de tu Mac (tráfico de red,
//      conexiones activas y puertos a la escucha). Es decir, el nivel refleja la
//      actividad/exposición real de tu red, no un dato fabricado.

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Shield, X } from "lucide-react";
import {
  Globe,
  type GlobeArc,
  type GlobeMarker,
  type GlobeProps,
} from "@/components/Globe";
import { useTheme } from "@/components/theme-provider";
import { useLang } from "@/components/language-provider";
import type { NetworkLive, ThreatLevel } from "@/hooks/use-network-stats";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ThreatPoint {
  location: [number, number];
  label?: string;
  sublabel?: string;
}

/** Nodo defendido (Madrid por defecto). */
const DEFAULT_HOME: [number, number] = [40.4168, -3.7038];

/** Pool de orígenes posibles (ciudades reales). El radar elige un subconjunto
 *  aleatorio que va rotando — no son ataques detectados, es una representación. */
const CITY_POOL: { loc: [number, number]; name: string }[] = [
  { loc: [55.75, 37.62], name: "Moscú" },
  { loc: [39.9, 116.4], name: "Pekín" },
  { loc: [40.71, -74.0], name: "Nueva York" },
  { loc: [39.03, 125.75], name: "Pyongyang" },
  { loc: [35.69, 51.39], name: "Teherán" },
  { loc: [1.35, 103.82], name: "Singapur" },
  { loc: [50.45, 30.52], name: "Kiev" },
  { loc: [-23.55, -46.63], name: "São Paulo" },
  { loc: [6.52, 3.37], name: "Lagos" },
  { loc: [19.43, -99.13], name: "Ciudad de México" },
  { loc: [28.61, 77.21], name: "Nueva Delhi" },
  { loc: [-33.87, 151.21], name: "Sídney" },
  { loc: [37.57, 126.98], name: "Seúl" },
  { loc: [52.52, 13.4], name: "Berlín" },
  { loc: [51.51, -0.13], name: "Londres" },
  { loc: [35.68, 139.69], name: "Tokio" },
  { loc: [41.01, 28.98], name: "Estambul" },
  { loc: [30.04, 31.24], name: "El Cairo" },
  { loc: [13.76, 100.5], name: "Bangkok" },
  { loc: [-6.21, 106.85], name: "Yakarta" },
  { loc: [22.32, 114.17], name: "Hong Kong" },
  { loc: [52.37, 4.9], name: "Ámsterdam" },
  { loc: [44.43, 26.1], name: "Bucarest" },
  { loc: [24.86, 67.0], name: "Karachi" },
  { loc: [-26.2, 28.05], name: "Johannesburgo" },
  { loc: [43.65, -79.38], name: "Toronto" },
  { loc: [34.05, -118.24], name: "Los Ángeles" },
  { loc: [4.71, -74.07], name: "Bogotá" },
];

const ATTACK_TYPES = [
  "DDoS",
  "Malware",
  "Phishing",
  "Botnet",
  "Ransomware",
  "Escaneo",
  "Fuerza bruta",
  "Exploit",
  "Troyano",
  "Spam",
];

const LEVEL_META: Record<ThreatLevel, { label: string; color: string }> = {
  tranquila: { label: "Tranquila", color: "#10b981" },
  normal: { label: "Normal", color: "var(--primary)" },
  elevada: { label: "Elevada", color: "#f59e0b" },
  agresiva: { label: "Agresiva", color: "var(--destructive)" },
};

/** Cuántos orígenes se muestran según la intensidad. */
const SHOWN: Record<ThreatLevel, number> = {
  tranquila: 4,
  normal: 7,
  elevada: 11,
  agresiva: 16,
};

const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Genera un subconjunto aleatorio: las 3 primeras con etiqueta de ataque. */
function genThreats(count: number): ThreatPoint[] {
  const shuffled = [...CITY_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((c, i) => ({
    location: c.loc,
    ...(i < 3 ? { label: rnd(ATTACK_TYPES), sublabel: c.name } : {}),
  }));
}

interface ThemeColors {
  threat: string;
  home: string;
  land: string;
}

function readThemeColors(): ThemeColors {
  const fallback: ThemeColors = {
    threat: "var(--destructive)",
    home: "var(--primary)",
    land: "var(--muted-foreground)",
  };
  if (typeof document === "undefined") return fallback;
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
  return {
    threat: get("--destructive", fallback.threat),
    home: get("--primary", fallback.home),
    land: get("--muted-foreground", fallback.land),
  };
}

export function SecurityGlobe({
  net,
  className,
}: {
  net: NetworkLive;
  className?: string;
}) {
  const { resolvedMode, theme, skin } = useTheme();
  const { t: tr } = useLang();
  const isDark = resolvedMode === "dark";
  const meta = LEVEL_META[net.level];

  const [colors, setColors] = useState<ThemeColors>(readThemeColors);
  useEffect(() => {
    const id = requestAnimationFrame(() => setColors(readThemeColors()));
    return () => cancelAnimationFrame(id);
  }, [theme, skin, resolvedMode]);

  const [expanded, setExpanded] = useState(false);

  // Zoom del globo con la rueda del ratón (suave). Por defecto ampliado para
  // que ocupe todo el espacio mostrando la parte de arriba (donde están los
  // arcos), en vez de la Tierra entera y pequeña.
  const [zoom, setZoom] = useState(1.1);
  const onWheel = (e: WheelEvent) => {
    setZoom((z) => Math.min(2.2, Math.max(1, z - e.deltaY * 0.0012)));
  };

  // Conjunto de amenazas rotatorio: cambia las ciudades/ataques cada ~14s para
  // que el radar se vea vivo (representación, no detección real).
  const count = SHOWN[net.level];
  const [threats, setThreats] = useState<ThreatPoint[]>(() => genThreats(count));
  useEffect(() => {
    setThreats(genThreats(count));
    const id = window.setInterval(() => setThreats(genThreats(count)), 18000);
    return () => window.clearInterval(id);
  }, [count]);

  const shown = threats;

  const markers: GlobeMarker[] = [
    {
      location: DEFAULT_HOME,
      size: 0.09,
      color: colors.home,
      label: tr("Tu Mac"),
      sublabel: tr("Este equipo"),
    },
    ...shown.map((t) => ({
      location: t.location,
      size: 0.05,
      color: colors.threat,
      label: t.label ? tr(t.label) : t.label,
      sublabel: t.sublabel ? tr(t.sublabel) : t.sublabel,
    })),
  ];

  const arcs: GlobeArc[] = shown.map((t) => ({
    from: t.location,
    to: DEFAULT_HOME,
    color: colors.threat,
  }));

  // Cuando la intensidad sube, la atmósfera se tiñe del color del nivel.
  const glow =
    net.level === "agresiva" || net.level === "elevada"
      ? colors.threat
      : colors.home;

  const globeProps: Omit<GlobeProps, "size" | "align"> = {
    baseColor: colors.land,
    markerColor: colors.threat,
    arcColor: colors.threat,
    glowColor: glow,
    dark: isDark ? 1 : 0.4,
    diffuse: 1.2,
    mapBrightness: isDark ? 6 : 9,
    mapBaseBrightness: isDark ? 0.08 : 0,
    mapSamples: 9000, // ligero: init de cobe y GPU más suaves
    markers,
    arcs,
    arcHeight: 0.4,
    arcWidth: 0.7,
    rotationSpeed: 0.003,
    theta: 0.35,
  };

  return (
    <>
      <div
        data-slot="card"
        className={cn(
          "relative flex h-full min-h-75 flex-col overflow-hidden rounded-lg border bg-card",
          className,
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <span
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            title={tr(
              "Representación del ruido constante de escaneos de internet. La intensidad usa la actividad real de tu red.",
            )}
          >
            <Shield className="size-3.5" />
            {tr("Radar de red")}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: meta.color }}
              />
              <span
                className="relative inline-flex size-2 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
            </span>
            {tr("En vivo")}
          </span>
        </div>

        <div className="chart-well grid-bg relative m-2 flex min-h-0 flex-1">
          {!expanded && (
            <MeasuredGlobe globeProps={globeProps} zoom={zoom} onWheel={onWheel} />
          )}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground backdrop-blur transition-colors hover:bg-white/15 hover:text-foreground"
            title={tr("Ampliar")}
            aria-label={tr("Ampliar globo")}
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>

        {/* Pie: intensidad (color del nivel) + telemetría real de red. */}
        <div className="border-t px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: meta.color }}
              >
                {tr(meta.label)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {tr("intensidad")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span title={tr("Descarga")}>↓ {formatBytes(net.rxRate)}/s</span>
              <span title={tr("Subida")}>↑ {formatBytes(net.txRate)}/s</span>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="tabular-nums">
              {tr("{n} conexiones · {m} puertos a la escucha", {
                n: net.established,
                m: net.listening,
              })}
            </span>
            <span>{tr("actividad real de tu red")}</span>
          </div>
        </div>
      </div>

      {/* Pantalla completa dentro de la app (portal a body para cubrir todo). */}
      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Shield className="size-3.5" />
              {tr("Radar de red")}
              <span className="font-semibold" style={{ color: meta.color }}>
                · {tr(meta.label)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
            >
              <X className="size-3.5" />
              {tr("Cerrar")}
            </button>
          </div>
          <MeasuredGlobe
            globeProps={globeProps}
            zoom={zoom}
            onWheel={onWheel}
            className="flex-1"
          />
        </div>,
          document.body,
        )}
    </>
  );
}

/** Mide su contenedor y pinta el globo en un cuadrado exacto (no ovalado). */
function MeasuredGlobe({
  globeProps,
  zoom,
  onWheel,
  className,
}: {
  globeProps: Omit<GlobeProps, "size" | "align">;
  zoom: number;
  onWheel?: (e: WheelEvent) => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Lado BASE = la dimensión MAYOR del cuadro. Así el lienzo (cuadrado) llena el
  // cuadro y lo excede en el eje corto → el cuadro recorta limpio (globo libre,
  // sin ver el borde cuadrado del lienzo). El zoom lo agranda aún más.
  const [base, setBase] = useState(0);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const cs = getComputedStyle(box);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = box.clientWidth - padX;
      const h = box.clientHeight - padY;
      const b = Math.floor(Math.max(w, h));
      if (b > 0) setBase(b);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    measure();
    return () => ro.disconnect();
  }, []);

  const side = Math.round(base * zoom);

  return (
    <div
      ref={boxRef}
      onWheel={onWheel}
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2",
        className,
      )}
    >
      {side > 0 && (
        <Globe
          size={side}
          align="center"
          {...globeProps}
          offset={[0, side * 0.1]}
        />
      )}
    </div>
  );
}

export default SecurityGlobe;

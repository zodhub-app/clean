import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Partículas: posiciones/tiempos deterministas (sin saltos entre renders). */
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.34,
  dur: 1.9 + ((i * 13) % 5) * 0.4,
  size: 5 + ((i * 7) % 4) * 2,
}));

/** Overlay reutilizable de "vaciado/liberación de espacio": partículas que se
 *  drenan hacia abajo + barra de progreso. Para limpiezas y purgas. */
export function CleanOverlay({
  label,
  sub,
  durationMs = 4500,
  className,
}: {
  label: string;
  sub?: string;
  /** Duración objetivo de la barra; se sincroniza con el mínimo visual. */
  durationMs?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[inherit] bg-background/65 backdrop-blur-[3px]",
        className,
      )}
    >
      <div className="clean-particles" aria-hidden>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>
      <div className="relative flex flex-col items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-full border bg-card/85 px-3.5 py-1.5 text-xs font-medium shadow-md">
          <Sparkles className="size-3.5 animate-pulse text-primary" />
          {label}
        </div>
        <div className="clean-bar">
          <span style={{ animationDuration: `${durationMs}ms` }} />
        </div>
        {sub && (
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default CleanOverlay;

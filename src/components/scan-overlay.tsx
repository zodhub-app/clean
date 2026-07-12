import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Overlay reutilizable de "proceso en marcha": rejilla + haz que barre + línea
 *  de escaneo + etiqueta. Para escaneos/limpiezas y operaciones similares. */
export function ScanOverlay({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[inherit] bg-background/55 backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="scan-grid" />
      <div className="scan-beam" />
      <div className="scan-line" />
      <div className="relative flex items-center gap-2 rounded-full border bg-card/85 px-3.5 py-1.5 text-xs font-medium shadow-md">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        {label}
      </div>
    </div>
  );
}

export default ScanOverlay;

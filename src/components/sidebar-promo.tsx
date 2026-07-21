import { Megaphone, ArrowRight } from "lucide-react";
import { useLang } from "@/components/language-provider";

/**
 * Espacio privilegiado del sidebar con aspecto de HENDIDURA (hundido, con
 * profundidad) para banners/novedades controlados por nosotros.
 *
 * DEMO: contenido de ejemplo. En el futuro vendrá de un servidor propio
 * (p. ej. GET /banner?lang=es&country=ES) y se refrescará en tiempo real, con
 * variantes por idioma y país. Se oculta cuando el sidebar está colapsado.
 */
export function SidebarPromo() {
  const { t } = useLang();
  return (
    <div className="mt-auto px-2 pb-1 group-data-[collapsible=icon]:hidden">
      {/*
        Marco hundido: sombras interiores = profundidad hacia dentro.
        La hendidura se calibra por tema. En oscuro puede ser negra y marcada;
        en claro, ese mismo negro se ve como una MANCHA gris sucia sobre el
        fondo, así que se usa un velo mucho más tenue y una sombra suave.
      */}
      <div className="relative aspect-square w-full rounded-lg border border-black/[0.06] bg-black/[0.03] p-2 shadow-[inset_0_1px_4px_rgba(15,23,42,0.06)] dark:border-black/40 dark:bg-black/25 dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.05)]">
        {/* Banner (aquí irá la imagen/contenido remoto). */}
        <div className="flex h-full flex-col overflow-hidden rounded-md bg-gradient-to-br from-primary/15 via-primary/[0.06] to-transparent p-2.5 dark:from-primary/25 dark:via-primary/10">
          <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
            <Megaphone className="size-3" />
            {t("Novedades")}
          </div>

          <div className="mt-1.5 flex flex-1 flex-col justify-center gap-1">
            <span className="text-[13px] font-semibold leading-tight">
              {t("Bienvenido a ZodHub Pulse")}
            </span>
            <span className="text-[10px] leading-snug text-muted-foreground">
              {t(
                "Este espacio mostrará novedades y avisos nuestros, en tu idioma.",
              )}
            </span>
          </div>

          <button
            type="button"
            className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-primary/20 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/30"
          >
            {t("Saber más")}
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SidebarPromo;

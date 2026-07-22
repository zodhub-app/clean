import { useLang } from "@/components/language-provider";

/** Lema de bienvenida de Inicio. La información "Sobre ZodHub Pulse" que
 *  antes vivía aquí en un modal (botón "i") ahora es la tarjeta fija junto
 *  al hilo de Novedades, en Tu espacio (ver `AboutCard` en account.tsx). */
export function HeroBanner() {
  const { t } = useLang();
  return (
    <div className="min-w-0">
      <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
        {t("Tu equipo, ")}
        <span className="text-primary">
          {t("sencillamente limpio y seguro")}
        </span>
        .
      </h2>
      <p className="truncate text-xs text-muted-foreground">
        {t(
          "Mantenimiento claro y en local — tus datos nunca salen de tu equipo.",
        )}
      </p>
    </div>
  );
}

export default HeroBanner;

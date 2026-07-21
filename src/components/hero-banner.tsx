import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Info,
  Lock,
  Sparkles,
  Gauge,
  HeartHandshake,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/language-provider";

/** Lema + acceso a la ventana "Sobre ZodHub Pulse". */
export function HeroBanner() {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-full bg-white/[0.05] hover:bg-white/10"
          title={t("Sobre ZodHub Pulse")}
          aria-label={t("Sobre ZodHub Pulse")}
          onClick={() => setOpen(true)}
        >
          <Info />
        </Button>
      </div>
      {open &&
        createPortal(<AboutModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        data-slot="card"
        className="relative max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
          aria-label={t("Cerrar")}
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="logo-badge flex size-10 items-center justify-center rounded-xl text-white">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h3 className="gradient-text text-lg font-semibold leading-tight">
              ZodHub Pulse
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("Tu equipo, sencillamente limpio y seguro.")}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "ZodHub Pulse es una utilidad de mantenimiento para Mac directa y sin humo: limpia cachés, libera espacio, ordena los .DS_Store y automatiza el mantenimiento. Lo esencial, bien hecho.",
          )}
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <Feature
            icon={<Sparkles className="size-4" />}
            title={t("Sencillo de verdad")}
          >
            {t(
              "Solo las operaciones que tu Mac necesita para ir fino. Sin menús interminables ni funciones de relleno.",
            )}
          </Feature>
          <Feature
            icon={<Lock className="size-4" />}
            title={t("Privado y en local")}
          >
            {t(
              "Todo se ejecuta en tu equipo. Tus archivos y métricas nunca se suben a la nube. Cero telemetría por defecto.",
            )}
          </Feature>
          <Feature icon={<Gauge className="size-4" />} title={t("Transparente")}>
            {t(
              "Te enseña qué va a hacer y con qué datos antes de tocar nada. Sin cajas negras: lo que ves es lo que pasa.",
            )}
          </Feature>
          <Feature
            icon={<HeartHandshake className="size-4" />}
            title={t("¿Por qué ZodHub Pulse?")}
          >
            {t(
              "Ligera, clara y respetuosa con tus datos, frente a los limpiadores pesados llenos de avisos y suscripciones. Hace lo justo, y lo hace bien.",
            )}
          </Feature>
        </div>

        <p className="mt-5 border-t pt-3 text-[11px] text-muted-foreground">
          {t(
            "Nota honesta: ZodHub Pulse no es un antivirus ni un cortafuegos. El radar de red representa el ruido constante de escaneos de internet que recibe cualquier equipo conectado; su intensidad, en vivo, refleja la actividad real de tu red para mantenerte al tanto de lo que pasa de puertas afuera. · Versión 0.1.0",
          )}
        </p>
      </div>
    </div>
  );
}

export default HeroBanner;

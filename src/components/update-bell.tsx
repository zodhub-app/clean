import {
  Bell,
  Check,
  Download,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/components/language-provider";
import { useUpdates } from "@/components/updates-provider";

/**
 * Campana de notificaciones de la barra. Muestra un LED rojo con el número de
 * actualizaciones disponibles (0 o 1 hoy). Al pulsar, abre un panel con el
 * estado: actualización disponible (con botón Actualizar y progreso), «estás al
 * día», comprobando, o error. El panel se renderiza en un portal de Radix, así
 * que no queda atrapado bajo el desenfoque de Hera.
 */
export function UpdateBell() {
  const { t, lang } = useLang();
  const u = useUpdates();
  const showLed = u.count > 0;

  const checkedLabel = u.lastChecked
    ? u.lastChecked.toLocaleTimeString(lang === "es" ? "es-ES" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative rounded-full bg-white/[0.05] hover:bg-white/10"
          aria-label={t("Notificaciones")}
          title={t("Notificaciones")}
        >
          <Bell />
          {showLed && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow ring-2 ring-background"
              aria-hidden
            >
              {u.count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("Notificaciones")}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 rounded-full hover:bg-white/10"
            aria-label={t("Buscar actualizaciones")}
            title={t("Buscar actualizaciones")}
            disabled={u.status === "checking"}
            onClick={() => void u.checkNow()}
          >
            <RefreshCw
              className={u.status === "checking" ? "animate-spin" : ""}
            />
          </Button>
        </div>

        <div className="p-3">{renderBody()}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function renderBody() {
    // Actualización disponible / descargando / instalando.
    if (
      u.status === "available" ||
      u.status === "downloading" ||
      u.status === "installing"
    ) {
      const downloading = u.status === "downloading";
      const installing = u.status === "installing";
      return (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Download className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t("Actualización disponible")}
              </p>
              <p className="text-xs text-muted-foreground">
                {u.currentVersion ? `${u.currentVersion} → ` : ""}
                {u.newVersion}
              </p>
            </div>
          </div>

          {u.notes && !downloading && !installing && (
            <p className="max-h-24 overflow-auto whitespace-pre-line rounded-md bg-black/10 p-2 text-xs text-muted-foreground">
              {u.notes}
            </p>
          )}

          {downloading && (
            <div className="space-y-1">
              <Progress value={u.progress} />
              <p className="text-right text-xs text-muted-foreground">
                {t("Descargando… {p}%", { p: u.progress })}
              </p>
            </div>
          )}

          {installing ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("Instalando…")}
            </p>
          ) : (
            <Button
              className="w-full"
              size="sm"
              disabled={downloading}
              onClick={() => void u.install()}
            >
              {downloading ? t("Descargando…") : t("Actualizar ahora")}
            </Button>
          )}
        </div>
      );
    }

    // Comprobando (incluye el estado inicial, antes del primer resultado).
    if (u.status === "checking" || u.status === "idle") {
      return (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("Comprobando actualizaciones…")}
        </p>
      );
    }

    // No se pudo comprobar.
    if (u.status === "error") {
      return (
        <div className="space-y-2.5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4 text-amber-500" />
            {t("No se pudo comprobar")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => void u.checkNow()}
          >
            {t("Reintentar")}
          </Button>
        </div>
      );
    }

    // Al día (o inicial).
    return (
      <div className="space-y-1.5 py-1 text-center">
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check className="size-5" />
        </span>
        <p className="text-sm font-medium">{t("Estás al día")}</p>
        <p className="text-xs text-muted-foreground">
          {u.currentVersion ? t("Versión {v}", { v: u.currentVersion }) : ""}
          {checkedLabel ? ` · ${t("comprobado {t}", { t: checkedLabel })}` : ""}
        </p>
      </div>
    );
  }
}

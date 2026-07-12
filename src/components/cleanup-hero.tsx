import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import { formatBytes } from "@/lib/format";
import {
  listDevJunk,
  cleanAllJunk,
  listSchedules,
  setSchedule,
} from "@/lib/api";

/** Tarjeta principal de Inicio: la limpieza de un botón (manual o automática).
 *  Es la operación más importante, por eso vive en la portada. */
export function CleanupHero() {
  const { t } = useLang();
  const [reclaimable, setReclaimable] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function scan() {
    try {
      const items = await listDevJunk();
      // Solo lo que "Liberar espacio ahora" limpia: ficheros + Papelera.
      setReclaimable(
        items
          .filter((x) => x.kind === "file" || x.kind === "trash")
          .reduce((a, x) => a + x.size, 0),
      );
    } catch {
      setReclaimable(0);
    }
  }

  useEffect(() => {
    scan();
    listSchedules()
      .then((list) =>
        setAuto(
          list.some((s) => s.task === "cleanup" && s.cadence !== "manual"),
        ),
      )
      .catch(() => {});
  }, []);

  async function toggleAuto(v: boolean) {
    setAuto(v);
    try {
      await setSchedule("cleanup", v ? "weekly" : "manual");
      toast.success(
        v
          ? t("Limpieza automática activada (semanal)")
          : t("Limpieza automática desactivada"),
      );
    } catch {
      setAuto(!v);
    }
  }

  async function doClean() {
    setConfirm(false);
    setCleaning(true);
    try {
      const r = await cleanAllJunk();
      toast.success(t("Liberados {n}", { n: formatBytes(r.freed) }));
      await scan();
    } catch (e) {
      toast.error(t("Error al limpiar"), { description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Card data-slot="card" className="relative gap-2 overflow-hidden py-3">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="logo-badge flex size-7 items-center justify-center rounded-md text-white">
              <Sparkles className="size-4" />
            </span>
            {t("Liberar espacio")}
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            {t("Automático (semanal)")}
            <Switch checked={auto} onCheckedChange={toggleAuto} />
          </label>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 px-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {reclaimable == null
              ? "—"
              : t("~{s}", { s: formatBytes(reclaimable) })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("Basura regenerable lista para eliminar (estimado).")}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="h-9 shrink-0 px-4 text-xs"
          disabled={cleaning}
          onClick={() => setConfirm(true)}
        >
          <Trash2 className="size-4" />
          {t("Limpiar todo mi equipo")}
        </Button>
      </CardContent>

      {cleaning && (
        <CleanOverlay label={t("Liberando espacio…")} durationMs={2500} />
      )}

      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirm(false)}
          >
            <Card
              className="w-full max-w-md gap-3 py-4"
              onClick={(ev) => ev.stopPropagation()}
            >
              <CardHeader className="px-4">
                <div className="text-sm font-semibold">
                  {t("¿Liberar espacio ahora?")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Se eliminará permanentemente la basura regenerable (cachés, logs, Xcode, modelos de IA…) y se vaciará la Papelera para recuperar espacio al instante. Docker se limpia en su pestaña.",
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setConfirm(false)}
                >
                  {t("Cancelar")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={doClean}
                >
                  <Trash2 className="size-3.5" />
                  {t("Limpiar todo mi equipo")}
                </Button>
              </CardContent>
            </Card>
          </div>,
          document.body,
        )}
    </Card>
  );
}

export default CleanupHero;

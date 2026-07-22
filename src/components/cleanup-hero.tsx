import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Trash2, ShieldCheck } from "lucide-react";
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
  cleanSystemAdmin,
  listSchedules,
  setSchedule,
  type DevItem,
} from "@/lib/api";
import { reportClean } from "@/lib/clean-report";
import { DEV_LABEL } from "@/pages/dev";

/** Tarjeta principal de Inicio: la limpieza de un botón (manual o automática).
 *  Es la operación más importante, por eso vive en la portada. */
export function CleanupHero() {
  const { t } = useLang();
  const [items, setItems] = useState<DevItem[] | null>(null);
  const [auto, setAuto] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [adminConfirm, setAdminConfirm] = useState(false);

  // Solo lo que "Limpiar todo mi equipo" borra de verdad: ficheros + Papelera
  // (Docker y copias de iOS tienen su propio sitio). El estimado es la SUMA de
  // estas partidas, y el desglose se muestra debajo para que el número no salga
  // "de la nada": ves de qué se compone y cuadra con lo que se elimina.
  const cleanable = (items ?? [])
    .filter((x) => x.kind === "file" || x.kind === "trash")
    .sort((a, b) => b.size - a.size);
  const reclaimable = items == null ? null : cleanable.reduce((a, x) => a + x.size, 0);

  async function scan() {
    try {
      setItems(await listDevJunk());
    } catch {
      setItems([]);
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
      reportClean(r, t);
      await scan();
    } catch (e) {
      toast.error(t("Error al limpiar"), { description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  // Limpieza con contraseña: borra las cachés y logs del sistema (de root) que
  // la limpieza normal no puede tocar. macOS pide la contraseña una vez.
  async function doAdminClean() {
    setAdminConfirm(false);
    setCleaning(true);
    try {
      const r = await cleanSystemAdmin();
      if (r.freed > 0) {
        toast.success(t("Liberados {s} del sistema", { s: formatBytes(r.freed) }));
      } else {
        toast.success(t("Nada que liberar del sistema ahora mismo."));
      }
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
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex items-center justify-between gap-3">
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
        </div>

        {/* Desglose: de qué se compone el total (cuadra con lo que se borra). */}
        {reclaimable != null && reclaimable > 0 && cleanable.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            {cleanable.map((it) => (
              <span key={it.key} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/60" />
                {t(DEV_LABEL[it.key] ?? it.key)}
                <span className="tabular-nums opacity-70">
                  {formatBytes(it.size)}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Honestidad: no inflamos el total con espacio que la app no borra. */}
        <p className="text-[11px] text-muted-foreground/70">
          {t(
            "Solo cuenta lo que se elimina de verdad. Para recuperar más, mira Aplicaciones, Duplicados y el mapa de tu disco en Almacenamiento.",
          )}
        </p>

        {/* Limpieza de lo que es del sistema (root): requiere contraseña. */}
        <button
          type="button"
          disabled={cleaning}
          onClick={() => setAdminConfirm(true)}
          className="flex w-fit items-center gap-1.5 text-[11px] font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <ShieldCheck className="size-3.5" />
          {t("Limpiar también lo del sistema (con contraseña)")}
        </button>
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

      {adminConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setAdminConfirm(false)}
          >
            <Card
              className="w-full max-w-md gap-3 py-4"
              onClick={(ev) => ev.stopPropagation()}
            >
              <CardHeader className="px-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" />
                  {t("¿Limpiar la basura del sistema?")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "macOS te pedirá tu contraseña. Se vaciará el contenido de las cachés y logs del sistema (de root) que la limpieza normal no puede tocar; son regenerables y no se toca ningún dato tuyo. Se te dirá cuánto espacio real se ha liberado.",
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setAdminConfirm(false)}
                >
                  {t("Cancelar")}
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={doAdminClean}
                >
                  <ShieldCheck className="size-3.5" />
                  {t("Continuar")}
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

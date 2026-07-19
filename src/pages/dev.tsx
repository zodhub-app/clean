import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Trash2, Container } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { ScanOverlay } from "@/components/scan-overlay";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import {
  listDevJunk,
  cleanDev,
  cleanAllJunk,
  type DevItem,
  type DevCleanResult,
} from "@/lib/api";

/**
 * Traduce el resultado de una limpieza en el aviso que ve el usuario.
 *
 * Tres desenlaces, y es importante no confundirlos:
 *   1. `errors`         → algo que se pidió NO se pudo hacer. Aviso naranja.
 *   2. Elementos en uso → la limpieza fue bien, pero había archivos abiertos
 *                         que se dejaron intactos. Es lo NORMAL en carpetas
 *                         temporales: se cuenta como éxito, con una coletilla.
 *   3. Ninguno          → éxito a secas.
 *
 * Antes cualquier incidencia salía como «No se pudo limpiar del todo», lo que
 * hacía parecer un fallo lo que era comportamiento esperado del sistema.
 */
type Translate = (es: string, vars?: Record<string, string | number>) => string;

function reportClean(r: DevCleanResult, t: Translate) {
  const freed = t("Liberados {n}", { n: formatBytes(r.freed) });

  if (r.errors.length) {
    toast.warning(t("No se pudo limpiar del todo"), {
      description: r.freed > 0 ? `${freed} · ${r.errors[0]}` : r.errors[0],
    });
    return;
  }

  const skipped: string[] = [];
  if (r.skipped_in_use > 0) {
    skipped.push(
      t("{n} en uso por otros programas, intactos", { n: r.skipped_in_use }),
    );
  }
  if (r.skipped_denied > 0) {
    skipped.push(
      t("{n} necesitan permisos de administrador", { n: r.skipped_denied }),
    );
  }

  toast.success(freed, skipped.length ? { description: skipped.join(" · ") } : undefined);
}

const DEV_LABEL: Record<string, string> = {
  "user-caches": "Cachés del sistema y apps",
  "browser-caches": "Cachés de navegadores",
  "ios-backups": "Copias de seguridad de iOS",
  logs: "Registros (logs)",
  trash: "Papelera",
  "xcode-derived": "Xcode DerivedData",
  "xcode-archives": "Xcode Archives",
  "xcode-devicesupport": "Soporte de dispositivos iOS",
  coresimulator: "Cachés del Simulador",
  npm: "Caché de npm",
  pnpm: "Almacén de pnpm",
  yarn: "Caché de Yarn",
  pip: "Caché de pip",
  brew: "Caché de Homebrew",
  huggingface: "Modelos HuggingFace",
  ollama: "Modelos Ollama",
  lmstudio: "Modelos LM Studio",
  docker: "Docker · imágenes y caché de build",
};

export function DevPage() {
  const { t } = useLang();
  const [items, setItems] = useState<DevItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirm, setConfirm] = useState<DevItem | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listDevJunk());
    } catch {
      /* dev web */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doClean() {
    if (!confirm) return;
    const item = confirm;
    setConfirm(null);
    setCleaning(true);
    try {
      const r = await cleanDev(item.key);
      reportClean(r, t);
      await refresh();
    } catch (e) {
      toast.error(t("Error al limpiar"), { description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  async function doCleanAll() {
    setConfirmAll(false);
    setCleaning(true);
    try {
      const r = await cleanAllJunk();
      reportClean(r, t);
      await refresh();
    } catch (e) {
      toast.error(t("Error al limpiar"), { description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  const total = (items ?? []).reduce((a, x) => a + x.size, 0);
  // Todo lo "de un botón" = ficheros + Papelera. Docker y las copias de iOS van
  // aparte (Docker por sus volúmenes; las copias porque son valiosas).
  const safeTotal = (items ?? [])
    .filter((x) => x.kind === "file" || x.kind === "trash")
    .reduce((a, x) => a + x.size, 0);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {items
            ? t("Recuperable: {s}", { s: formatBytes(total) })
            : t("Analizando…")}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={refresh}
            disabled={loading || cleaning}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            {t("Analizar")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            disabled={cleaning || safeTotal === 0}
            onClick={() => setConfirmAll(true)}
          >
            <Trash2 className="size-3.5" />
            {t("Limpiar todo")}
          </Button>
        </div>
      </div>

      <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading && !items ? (
            <div className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : items && items.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              {t("Nada que limpiar por aquí. ¡Todo despejado!")}
            </p>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="flex flex-col">
                {(items ?? []).map((it) => (
                  <li
                    key={it.key}
                    className="flex items-center gap-2.5 border-b px-4 py-2 last:border-0"
                  >
                    {it.kind === "docker" ? (
                      <Container className="size-4 shrink-0 text-sky-400" />
                    ) : (
                      <span className="size-2 shrink-0 rounded-full bg-primary/70" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {t(DEV_LABEL[it.key] ?? it.key)}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatBytes(it.size)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => setConfirm(it)}
                    >
                      <Trash2 className="size-3.5" />
                      {t("Limpiar")}
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>

        {loading && !items && <ScanOverlay label={t("Analizando…")} />}
        {cleaning && <CleanOverlay label={t("Liberando espacio…")} durationMs={2500} />}
      </Card>

      {confirm &&
        createPortal(
          <DevConfirm
            item={confirm}
            onCancel={() => setConfirm(null)}
            onConfirm={doClean}
          />,
          document.body,
        )}

      {confirmAll &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmAll(false)}
          >
            <Card
              className="w-full max-w-md gap-3 py-4"
              onClick={(ev) => ev.stopPropagation()}
            >
              <CardHeader className="px-4">
                <div className="text-sm font-semibold">
                  {t("¿Limpiar todo ({s})?", { s: formatBytes(safeTotal) })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Se eliminará permanentemente toda la basura de ficheros (cachés, logs, Xcode, modelos…) y se vaciará la Papelera para liberar espacio al instante. Es regenerable. Docker NO se toca aquí (usa su botón).",
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setConfirmAll(false)}
                >
                  {t("Cancelar")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={doCleanAll}
                >
                  <Trash2 className="size-3.5" />
                  {t("Limpiar todo")}
                </Button>
              </CardContent>
            </Card>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DevConfirm({
  item,
  onCancel,
  onConfirm,
}: {
  item: DevItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLang();
  const isDocker = item.kind === "docker";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <Card
        className="w-full max-w-md gap-3 py-4"
        onClick={(ev) => ev.stopPropagation()}
      >
        <CardHeader className="px-4">
          <div className="text-sm font-semibold">
            {t("¿Limpiar «{label}»?", {
              label: t(DEV_LABEL[item.key] ?? item.key),
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {isDocker
              ? t(
                  "Ejecutará «docker system prune -af»: borra imágenes, contenedores parados y caché de build. NO toca los volúmenes, así que tus datos (p. ej. SurrealDB) están a salvo. Esto es permanente.",
                )
              : item.kind === "trash"
                ? t("Se vaciará la Papelera ({size}) de forma permanente.", {
                    size: formatBytes(item.size),
                  })
                : item.kind === "backup"
                  ? t(
                      "⚠️ Son tus copias de seguridad de iPhone/iPad ({size}). Se moverán a la Papelera (recuperables). Bórralas solo si no las necesitas.",
                      { size: formatBytes(item.size) },
                    )
                  : t(
                      "Se eliminará permanentemente ({size}) para liberar espacio ya. Es basura regenerable: se recrea cuando haga falta.",
                      { size: formatBytes(item.size) },
                    )}
          </p>
        </CardHeader>
        <CardContent className="flex justify-end gap-2 px-4">
          <Button variant="outline" size="sm" className="text-xs" onClick={onCancel}>
            {t("Cancelar")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="text-xs"
            onClick={onConfirm}
          >
            {t("Limpiar")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

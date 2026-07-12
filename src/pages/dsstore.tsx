import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  Eraser,
  FileArchive,
  FolderOpen,
  Files,
  UploadCloud,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { ScanOverlay } from "@/components/scan-overlay";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import {
  cleanZip,
  getNetworkStoresDisabled,
  setNetworkStoresDisabled,
  sweepDsStore,
} from "@/lib/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Duración mínima visible de los efectos (ms). */
const MIN_FX = 4500;

function baseName(p: string) {
  return p.split("/").filter(Boolean).pop() ?? "archivo";
}
function parentDir(p: string) {
  const i = p.lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "";
}

export function DSStorePage() {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Procesando…");
  const [busyKind, setBusyKind] = useState<"scan" | "clean">("scan");
  const [dragging, setDragging] = useState(false);
  const [netDisabled, setNetDisabled] = useState(false);

  const compress = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    const first = paths[0];
    const defaultName =
      (paths.length === 1 ? baseName(first).replace(/\.[^.]+$/, "") : "ZodHub Clean") +
      ".zip";
    const parent = parentDir(first);
    const dest = await save({
      defaultPath: parent ? `${parent}/${defaultName}` : defaultName,
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (!dest) return;
    setBusyLabel("Comprimiendo…");
    setBusyKind("scan");
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await cleanZip(paths, dest);
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      toast.success(t("Comprimido limpio · {n} archivos", { n: r.entries }), {
        description: r.skipped
          ? t("{size} · {n} elementos basura omitidos", {
              size: formatBytes(r.size),
              n: r.skipped,
            })
          : formatBytes(r.size),
      });
    } catch (e) {
      toast.error(t("Error al comprimir"), { description: String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  // Arrastrar y soltar carpetas/archivos para comprimir.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "enter" || p.type === "over") setDragging(true);
        else if (p.type === "leave") setDragging(false);
        else if (p.type === "drop") {
          setDragging(false);
          void compress(p.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, [compress]);

  useEffect(() => {
    getNetworkStoresDisabled().then(setNetDisabled).catch(() => {});
  }, []);

  async function pickFolderCompress() {
    const sel = await open({ directory: true, multiple: false });
    if (typeof sel === "string") void compress([sel]);
  }
  async function pickFilesCompress() {
    const sel = await open({ multiple: true });
    if (Array.isArray(sel) && sel.length) void compress(sel);
  }

  async function sweep() {
    const sel = await open({ directory: true, multiple: true });
    const roots = Array.isArray(sel) ? sel : sel ? [sel] : [];
    if (!roots.length) return;
    setBusyLabel("Liberando espacio…");
    setBusyKind("clean");
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await sweepDsStore(roots);
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      toast.success(
        t("{n} archivos .DS_Store eliminados", { n: r.removed }),
        {
          description: r.removed
            ? t("Liberados {n3}", { n3: formatBytes(r.freed) })
            : t("Ya estaba limpio"),
        },
      );
      if (r.errors.length)
        toast.warning(t("{n} no se pudieron borrar", { n: r.errors.length }));
    } catch (e) {
      toast.error(t("Error en el barrido"), { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleNet(v: boolean) {
    try {
      await setNetworkStoresDisabled(v);
      setNetDisabled(v);
      toast.success(
        v
          ? t("No se crearán .DS_Store en unidades de red")
          : t("Comportamiento por defecto restaurado"),
      );
    } catch (e) {
      toast.error(t("No se pudo cambiar el ajuste"), {
        description: String(e),
      });
    }
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      {/* Comprimir limpio */}
      <Card data-slot="card" className="flex min-h-0 flex-1 flex-col gap-2 py-3">
        <CardHeader className="shrink-0 px-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileArchive className="size-3.5" />
            {t("Comprimir limpio")}
          </span>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <button
            type="button"
            onClick={pickFolderCompress}
            disabled={busy}
            className={cn(
              "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/10"
                : "border-input hover:bg-accent",
            )}
          >
            <UploadCloud
              className={cn(
                "size-10 transition-colors",
                dragging ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className="text-base font-medium">
              {t("Arrastra una carpeta o archivos aquí")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(
                "o haz clic para elegir una carpeta · zip sin .DS_Store, __MACOSX ni resource forks",
              )}
            </span>
          </button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={pickFolderCompress}
              disabled={busy}
            >
              <FolderOpen className="size-3.5" />
              {t("Elegir carpeta")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={pickFilesCompress}
              disabled={busy}
            >
              <Files className="size-3.5" />
              {t("Elegir archivos")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t(
              "Próximamente: «Comprimir con ZodHub Clean» en el clic derecho de Finder (al empaquetar la app).",
            )}
          </p>
        </CardContent>
      </Card>

      {/* Barrido de .DS_Store */}
      <Card data-slot="card" className="shrink-0 gap-2 py-3">
        <CardHeader className="px-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Eraser className="size-3.5" />
            {t("Barrido de .DS_Store")}
          </span>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 px-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "Elimina los archivos .DS_Store existentes en las carpetas que elijas (Finder los regenera al abrirlas).",
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={sweep}
            disabled={busy}
          >
            <FolderOpen className="size-3.5" />
            {t("Elegir carpetas…")}
          </Button>
        </CardContent>
      </Card>

      {/* Ajuste de unidades de red */}
      <Card data-slot="card" className="shrink-0 gap-2 py-3">
        <CardHeader className="px-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wifi className="size-3.5" />
            {t("Unidades de red")}
          </span>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 px-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "No crear .DS_Store en unidades de red (ajuste oficial de macOS). Aplica al volver a montar la unidad.",
            )}
          </p>
          <Switch checked={netDisabled} onCheckedChange={toggleNet} />
        </CardContent>
      </Card>

      {busy &&
        (busyKind === "clean" ? (
          <CleanOverlay
            label={t(busyLabel)}
            sub={t("Barriendo .DS_Store")}
            durationMs={MIN_FX}
          />
        ) : (
          <ScanOverlay label={t(busyLabel)} />
        ))}
    </div>
  );
}

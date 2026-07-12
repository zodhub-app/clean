import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowUp,
  FileIcon,
  Folder,
  FolderOpen,
  Home,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { ScanOverlay } from "@/components/scan-overlay";
import { useLang } from "@/components/language-provider";
import {
  scanDir,
  revealInFinder,
  moveToTrash,
  type ScanResult,
  type ScanEntry,
} from "@/lib/api";

export function ExplorerPage() {
  const { t } = useLang();
  const [res, setRes] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ScanEntry | null>(null);

  async function scan(path: string) {
    setLoading(true);
    try {
      setRes(await scanDir(path));
    } catch (e) {
      toast.error(t("No se pudo analizar la carpeta"), {
        description: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan(""); // "" → carpeta de inicio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickFolder() {
    const sel = await open({ directory: true, multiple: false });
    if (typeof sel === "string") scan(sel);
  }

  async function doTrash(entry: ScanEntry) {
    setConfirm(null);
    try {
      const r = await moveToTrash([entry.path]);
      if (r.moved > 0) {
        toast.success(
          t("Movido a la Papelera · liberado {n}", { n: formatBytes(r.freed) }),
        );
      }
      if (r.errors.length) {
        toast.warning(t("No se pudo mover"), { description: r.errors[0] });
      }
      if (res) scan(res.path);
    } catch (e) {
      toast.error(t("No se pudo mover"), { description: String(e) });
    }
  }

  const maxSize = res?.entries[0]?.size ?? 1;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      {/* Barra de navegación */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => scan("")}
          disabled={loading}
        >
          <Home className="size-3.5" />
          {t("Inicio")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => res?.parent && scan(res.parent)}
          disabled={loading || !res?.parent}
        >
          <ArrowUp className="size-3.5" />
          {t("Subir")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={pickFolder}
          disabled={loading}
        >
          <FolderOpen className="size-3.5" />
          {t("Elegir carpeta")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => res && scan(res.path)}
          disabled={loading || !res}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {t("Analizar")}
        </Button>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {res?.path}
        </span>
      </div>

      <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {res
              ? t("Total: {s}", { s: formatBytes(res.total) })
              : t("Analizando…")}
          </span>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {res && res.entries.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              {t("Carpeta vacía o sin acceso.")}
            </p>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="flex flex-col">
                {(res?.entries ?? []).map((e) => (
                  <li
                    key={e.path}
                    className="group flex items-center gap-2.5 border-b px-4 py-1.5 last:border-0 hover:bg-accent/40"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => e.is_dir && scan(e.path)}
                      disabled={!e.is_dir}
                    >
                      {e.is_dir ? (
                        <Folder className="size-4 shrink-0 text-primary" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{e.name}</span>
                        <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary/70"
                            style={{ width: `${(e.size / maxSize) * 100}%` }}
                          />
                        </span>
                      </span>
                    </button>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatBytes(e.size)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title={t("Abrir en Finder")}
                        aria-label={t("Abrir en Finder")}
                        onClick={() => revealInFinder(e.path).catch(() => {})}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <FolderOpen className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title={t("Mover a la Papelera")}
                        aria-label={t("Mover a la Papelera")}
                        onClick={() => setConfirm(e)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>

        {loading && <ScanOverlay label={t("Analizando…")} />}
      </Card>

      {confirm &&
        createPortal(
          <TrashConfirm
            entry={confirm}
            onCancel={() => setConfirm(null)}
            onConfirm={() => doTrash(confirm)}
          />,
          document.body,
        )}
    </div>
  );
}

function TrashConfirm({
  entry,
  onCancel,
  onConfirm,
}: {
  entry: ScanEntry;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <Card
        className="w-full max-w-sm gap-3 py-4"
        onClick={(ev) => ev.stopPropagation()}
      >
        <CardHeader className="px-4">
          <div className="text-sm font-semibold">{t("¿Mover a la Papelera?")}</div>
          <p className="text-xs text-muted-foreground">
            {t(
              "«{name}» ({size}) se moverá a la Papelera. Podrás recuperarlo desde ahí.",
              { name: entry.name, size: formatBytes(entry.size) },
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
            <Trash2 className="size-3.5" />
            {t("Mover a la Papelera")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

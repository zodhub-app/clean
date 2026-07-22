import { useState } from "react";
import { useCachedResource } from "@/hooks/use-cached-resource";
import { createPortal } from "react-dom";
import { AppWindow, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
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
  listApps,
  appLeftovers,
  uninstallApp,
  type AppInfo,
  type LeftoverResult,
} from "@/lib/api";

export function AppsPage() {
  const { t } = useLang();
  // Caché de pestaña: al volver a Aplicaciones, la lista aparece al instante.
  const {
    data: apps,
    loading,
    refresh: refreshApps,
  } = useCachedResource<AppInfo[]>("apps", listApps);
  const [uninstalling, setUninstalling] = useState(false);
  const [leftovers, setLeftovers] = useState<Record<string, LeftoverResult>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{
    app: AppInfo;
    lo: LeftoverResult;
  } | null>(null);

  // Al recargar la lista se limpian los «restos» calculados y lo desplegado.
  async function refresh() {
    await refreshApps();
    setLeftovers({});
    setExpanded(new Set());
  }

  async function loadLeftovers(app: AppInfo): Promise<LeftoverResult> {
    if (leftovers[app.path]) return leftovers[app.path];
    const lo = await appLeftovers(app.bundle_id, app.name);
    setLeftovers((m) => ({ ...m, [app.path]: lo }));
    return lo;
  }

  async function toggle(app: AppInfo) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(app.path)) next.delete(app.path);
      else next.add(app.path);
      return next;
    });
    if (!leftovers[app.path]) await loadLeftovers(app).catch(() => {});
  }

  async function askUninstall(app: AppInfo) {
    const lo = await loadLeftovers(app).catch(() => ({ total: 0, items: [] }));
    setConfirm({ app, lo });
  }

  async function doUninstall() {
    if (!confirm) return;
    const { app, lo } = confirm;
    setConfirm(null);
    setUninstalling(true);
    try {
      const r = await uninstallApp(
        app.path,
        lo.items.map((i) => i.path),
        // En Windows `bundle_id` transporta el desinstalador oficial del
        // registro; en macOS se ignora.
        app.bundle_id,
      );
      if (r.moved > 0) {
        toast.success(
          t("Desinstalada. {n} movidos a la Papelera; el espacio se libera al vaciarla.", {
            n: formatBytes(r.moved_bytes),
          }),
        );
      }
      if (r.errors.length) {
        toast.warning(t("No se pudo desinstalar"), { description: r.errors[0] });
      }
      await refresh();
    } catch (e) {
      toast.error(t("No se pudo desinstalar"), { description: String(e) });
    } finally {
      setUninstalling(false);
    }
  }

  const total = (apps ?? []).reduce((a, x) => a + x.size, 0);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {apps
            ? t("{n} aplicaciones · {s}", { n: apps.length, s: formatBytes(total) })
            : t("Analizando aplicaciones…")}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {t("Analizar")}
        </Button>
      </div>

      <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading && !apps ? (
            <div className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="flex flex-col">
                {(apps ?? []).map((app) => {
                  const lo = leftovers[app.path];
                  const isOpen = expanded.has(app.path);
                  return (
                    <li key={app.path} className="border-b last:border-0">
                      <div className="flex items-center gap-2.5 px-4 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggle(app)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <ChevronRight
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-90",
                            )}
                          />
                          <AppWindow className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {app.name}
                          </span>
                          {lo && lo.total > 0 && (
                            <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] text-amber-400">
                              +{formatBytes(lo.total)}
                            </span>
                          )}
                        </button>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatBytes(app.size)}
                        </span>
                        <button
                          type="button"
                          title={t("Desinstalar")}
                          aria-label={t("Desinstalar")}
                          onClick={() => askUninstall(app)}
                          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="flex flex-col gap-1 px-4 pb-2 pl-11">
                          {!lo ? (
                            <Skeleton className="h-4 w-40" />
                          ) : lo.items.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              {t("Sin restos detectados")}
                            </span>
                          ) : (
                            lo.items.map((it) => (
                              <div
                                key={it.path}
                                className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                              >
                                <span className="truncate">{it.path}</span>
                                <span className="shrink-0 tabular-nums">
                                  {formatBytes(it.size)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>

        {loading && !apps && <ScanOverlay label={t("Analizando aplicaciones…")} />}
        {uninstalling && (
          <CleanOverlay label={t("Desinstalando…")} durationMs={2500} />
        )}
      </Card>

      {confirm &&
        createPortal(
          <UninstallConfirm
            app={confirm.app}
            lo={confirm.lo}
            onCancel={() => setConfirm(null)}
            onConfirm={doUninstall}
          />,
          document.body,
        )}
    </div>
  );
}

function UninstallConfirm({
  app,
  lo,
  onCancel,
  onConfirm,
}: {
  app: AppInfo;
  lo: LeftoverResult;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLang();
  const total = app.size + lo.total;
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
          <div className="text-sm font-semibold">
            {t("¿Desinstalar {name}?", { name: app.name })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "Se moverán a la Papelera la app ({app}) y sus restos ({rest}) — en total {total}. Podrás recuperarlo desde la Papelera.",
              {
                app: formatBytes(app.size),
                rest: formatBytes(lo.total),
                total: formatBytes(total),
              },
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
            {t("Desinstalar")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

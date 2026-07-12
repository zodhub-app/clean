import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
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
import { cleanCaches, scanCaches, type CacheEntry } from "@/lib/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Duración mínima visible de los efectos (ms). La operación real es honesta;
 *  si tarda más, el overlay se mantiene hasta que termina. */
const MIN_FX = 4500;

/** Lightweight checkbox indicator (no extra dependencies). */
function CheckBox({ checked }: { checked: boolean | "indeterminate" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input",
      )}
    >
      {checked === "indeterminate" ? (
        <Minus className="size-2.5" />
      ) : checked ? (
        <Check className="size-2.5" />
      ) : null}
    </span>
  );
}

export function CachePage() {
  const { t } = useLang();
  const [entries, setEntries] = useState<CacheEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Refresco silencioso de la lista (sin overlay ni espera mínima).
  async function loadCaches() {
    const found = await scanCaches();
    setEntries(found);
    setSelected(new Set(found.map((e) => e.id)));
  }

  async function scan() {
    setScanning(true);
    const t0 = performance.now();
    try {
      await loadCaches();
    } catch (err) {
      toast.error(t("No se pudo escanear la caché"), {
        description: String(err),
      });
      setEntries([]);
    } finally {
      // El escaneo es real; mantenemos la animación un mínimo creíble.
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      setScanning(false);
    }
  }

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSize = useMemo(
    () => (entries ?? []).reduce((acc, e) => acc + e.size, 0),
    [entries],
  );
  const selectedSize = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => selected.has(e.id))
        .reduce((acc, e) => acc + e.size, 0),
    [entries, selected],
  );

  const allSelected =
    !!entries && entries.length > 0 && selected.size === entries.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!entries) return;
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  async function handleClean() {
    if (!entries) return;
    const paths = entries.filter((e) => selected.has(e.id)).map((e) => e.path);
    setConfirmOpen(false);
    setCleaning(true);
    const t0 = performance.now();
    try {
      const r = await cleanCaches(paths);
      // El borrado es real; la animación de vaciado dura un mínimo creíble y, si
      // la operación tarda más, el overlay se mantiene hasta que termina.
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      toast.success(t("Liberados {n}", { n: formatBytes(r.freed) }), {
        description: t("{n} elementos eliminados", { n: r.removed }),
      });
      if (r.errors.length) {
        toast.warning(
          t("{n} no se pudieron borrar", { n: r.errors.length }),
          { description: r.errors.slice(0, 3).join("\n") },
        );
      }
      // Refrescamos en silencio (el efecto de vaciado ya se mostró ≥4,5s).
      await loadCaches().catch(() => {});
    } catch (err) {
      toast.error(t("Error al limpiar"), { description: String(err) });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={scan}
          disabled={scanning}
        >
          <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
          {t("Escanear")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          disabled={cleaning || selected.size === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-3.5" />
          {t("Limpiar ({n})", { n: selected.size })}
        </Button>
      </div>

      <div
        data-slot="card"
        className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
      >
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("Seleccionado")}
          </div>
          <div className="text-2xl font-semibold tabular-nums leading-tight">
            {scanning && !entries ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              formatBytes(selectedSize)
            )}
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {entries
            ? t("{a} de {b} elementos", {
                a: selected.size,
                b: entries.length,
              })
            : t("escaneando…")}
          <div className="tabular-nums">
            {t("{n} en total", { n: formatBytes(totalSize) })}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <p>
          {t(
            "Borrado permanente. Cierra las apps importantes antes; tras limpiar, su primer arranque puede ir algo más lento mientras regeneran la caché.",
          )}
        </p>
      </div>

      <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 border-b px-4 py-2.5">
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-medium"
            onClick={toggleAll}
          >
            <CheckBox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
            />
            {t("Seleccionar todo")}
          </button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {scanning && !entries ? (
            <div className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="data-rows flex flex-col">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 border-b px-4 py-1.5 text-left transition-colors last:border-0"
                      onClick={() => toggle(e.id)}
                    >
                      <CheckBox checked={selected.has(e.id)} />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {e.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatBytes(e.size)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="p-4 text-xs text-muted-foreground">
              {t("No se encontraron cachés que limpiar. ¡Todo despejado!")}
            </p>
          )}
        </CardContent>

        {scanning && <ScanOverlay label={t("Escaneando caché…")} />}
        {cleaning && (
          <CleanOverlay
            label={t("Liberando espacio…")}
            sub={t("Vaciando {n}", { n: formatBytes(selectedSize) })}
            durationMs={MIN_FX}
          />
        )}
      </Card>

      {confirmOpen &&
        createPortal(
          <ConfirmDialog
            count={selected.size}
            size={formatBytes(selectedSize)}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleClean}
          />,
          document.body,
        )}
    </div>
  );
}

function ConfirmDialog({
  count,
  size,
  onCancel,
  onConfirm,
}: {
  count: number;
  size: string;
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
          <div className="text-sm font-semibold">
            {t("¿Borrar las cachés elegidas?")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "Se eliminarán {count} elementos ({size}) de forma permanente. Las apps volverán a crear sus cachés cuando las uses.",
              { count, size },
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
            {t("Borrar")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

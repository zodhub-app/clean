import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Info, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import { listSnapshots, thinSnapshots, type Snapshot } from "@/lib/api";

function fmtSnap(d: string) {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return d;
  const [, Y, Mo, D, h, mi] = m;
  return new Date(
    Number(Y),
    Number(Mo) - 1,
    Number(D),
    Number(h),
    Number(mi),
  ).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SnapshotsPage() {
  const { t } = useLang();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinning, setThinning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setSnaps(await listSnapshots());
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

  async function doThin() {
    setConfirmOpen(false);
    setThinning(true);
    try {
      const r = await thinSnapshots();
      // Se informa del número de instantáneas, que es exacto, y NO de bytes:
      // el sistema los libera de forma asíncrona y cualquier cifra que diéramos
      // aquí sería inventada (ver el comentario en snapshots.rs).
      const gone = Math.max(0, r.count_before - r.count_after);
      toast.success(t("{n} instantáneas eliminadas", { n: gone }), {
        description: t(
          "El sistema libera el espacio poco a poco; lo verás reflejado en Almacenamiento.",
        ),
      });
      await refresh();
    } catch (e) {
      toast.error(t("No se pudieron liberar"), { description: String(e) });
    } finally {
      setThinning(false);
    }
  }

  const count = snaps?.length ?? 0;

  return (
    <div className="relative flex w-full flex-col gap-2.5">
      {/* Explicación: de dónde sale el volumen */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-500" />
        <p>
          {t(
            "macOS guarda «copias locales» de Time Machine dentro de tu propio disco (aunque no tengas disco externo). Se acumulan solas y ocupan espacio que Utilidad de Discos cuenta como usado — suele ser el motivo de que el disco «se llene sin motivo». Son recuperables: al liberarlas, macOS recupera ese espacio. Tus copias en disco externo, si las tienes, no se tocan.",
          )}
        </p>
      </div>

      <Card data-slot="card" className="gap-2 py-3">
        <CardHeader className="px-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Camera className="size-3.5" />
              {snaps
                ? t("{n} instantáneas locales", { n: count })
                : t("Analizando…")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={refresh}
                disabled={loading || thinning}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                {t("Analizar")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                disabled={thinning || count === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-3.5" />
                {t("Liberar todas")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-4">
          {loading && !snaps ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))
          ) : count === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("No hay instantáneas locales ahora mismo.")}
            </p>
          ) : (
            (snaps ?? []).map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-2 border-b py-1.5 text-xs last:border-0"
              >
                <Camera className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="tabular-nums">{fmtSnap(s.date)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground/80">
        {t(
          "Nota: macOS no expone el tamaño exacto de cada instantánea; al liberarlas verás cuánto espacio se recupera. Se pedirá tu contraseña de administrador.",
        )}
      </p>

      {thinning &&
        createPortal(
          <div className="fixed inset-0 z-40">
            <CleanOverlay
              label={t("Liberando instantáneas…")}
              durationMs={3000}
            />
          </div>,
          document.body,
        )}

      {confirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmOpen(false)}
          >
            <Card
              className="w-full max-w-sm gap-3 py-4"
              onClick={(ev) => ev.stopPropagation()}
            >
              <CardHeader className="px-4">
                <div className="text-sm font-semibold">
                  {t("¿Liberar todas las instantáneas?")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "macOS pedirá tu contraseña de administrador y eliminará las copias locales de Time Machine para recuperar espacio. Tus copias en disco externo (si las tienes) no se tocan.",
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex justify-end gap-2 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setConfirmOpen(false)}
                >
                  {t("Cancelar")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={doThin}
                >
                  <Trash2 className="size-3.5" />
                  {t("Liberar todas")}
                </Button>
              </CardContent>
            </Card>
          </div>,
          document.body,
        )}
    </div>
  );
}

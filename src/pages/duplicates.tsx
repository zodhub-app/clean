import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Home, FolderOpen, RefreshCw, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { ScanOverlay } from "@/components/scan-overlay";
import { useLang } from "@/components/language-provider";
import {
  findDuplicates,
  moveToTrash,
  type DupGroup,
} from "@/lib/api";

function baseName(p: string) {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export function DuplicatesPage() {
  const { t } = useLang();
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [root, setRoot] = useState("");

  async function scan(path: string) {
    setLoading(true);
    setRoot(path);
    try {
      const g = await findDuplicates(path);
      setGroups(g);
      // Por defecto: marcar para borrar todas menos la primera de cada grupo.
      const sel = new Set<string>();
      for (const grp of g) grp.files.slice(1).forEach((f) => sel.add(f));
      setSelected(sel);
    } catch (e) {
      toast.error(t("No se pudieron buscar duplicados"), {
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

  // path → array de ficheros de su grupo (para conservar al menos una copia).
  const groupOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of groups ?? []) for (const f of g.files) m.set(f, g.files);
    return m;
  }, [groups]);

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      // Evitar seleccionar TODAS las copias de un grupo.
      const g = groupOf.get(path) ?? [path];
      const unselected = g.filter((f) => !next.has(f));
      if (unselected.length <= 1) {
        toast.warning(t("Debes conservar al menos una copia de cada grupo."));
        return prev;
      }
      next.add(path);
      return next;
    });
  }

  const totalWasted = useMemo(
    () => (groups ?? []).reduce((a, g) => a + g.wasted, 0),
    [groups],
  );
  const selectedSize = useMemo(() => {
    let s = 0;
    for (const g of groups ?? [])
      for (const f of g.files) if (selected.has(f)) s += g.size;
    return s;
  }, [groups, selected]);

  async function deleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const r = await moveToTrash(Array.from(selected));
      if (r.moved > 0)
        toast.success(t("Movidos {n} a la Papelera", { n: r.moved }));
      if (r.errors.length)
        toast.warning(t("{n} no se pudieron mover", { n: r.errors.length }));
      await scan(root);
    } catch (e) {
      toast.error(t("No se pudo mover"), { description: String(e) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => scan("")}
          disabled={loading || deleting}
        >
          <Home className="size-3.5" />
          {t("Inicio")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={pickFolder}
          disabled={loading || deleting}
        >
          <FolderOpen className="size-3.5" />
          {t("Elegir carpeta")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => scan(root)}
          disabled={loading || deleting}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {t("Analizar")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="ml-auto h-7 text-xs"
          disabled={deleting || selected.size === 0}
          onClick={deleteSelected}
        >
          <Trash2 className="size-3.5" />
          {t("Mover a la Papelera ({n})", { n: selected.size })}
        </Button>
      </div>

      <Card className="relative flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {groups
              ? t("{n} grupos · sobran {s} · marcados {m}", {
                  n: groups.length,
                  s: formatBytes(totalWasted),
                  m: formatBytes(selectedSize),
                })
              : t("Buscando duplicados…")}
          </span>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {groups && groups.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              {t("Sin duplicados en esta carpeta.")}
            </p>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col">
                {(groups ?? []).map((g, gi) => (
                  <div key={gi} className="border-b last:border-0">
                    <div className="bg-muted/40 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
                      {t("{n} copias · {s} c/u · sobran {w}", {
                        n: g.count,
                        s: formatBytes(g.size),
                        w: formatBytes(g.wasted),
                      })}
                    </div>
                    {g.files.map((f) => {
                      const checked = selected.has(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggle(f)}
                          className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left hover:bg-accent/40"
                        >
                          <span
                            className={cn(
                              "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                              checked
                                ? "border-destructive bg-destructive text-white"
                                : "border-input",
                            )}
                          >
                            {checked && <Check className="size-2.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs">
                              {baseName(f)}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {f}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>

        {(loading || deleting) && (
          <ScanOverlay
            label={deleting ? t("Moviendo…") : t("Buscando duplicados…")}
          />
        )}
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground/80">
        {t(
          "Se comparan por contenido exacto (SHA-256). Lo marcado se mueve a la Papelera (recuperable); siempre se conserva al menos una copia de cada grupo.",
        )}
      </p>
    </div>
  );
}

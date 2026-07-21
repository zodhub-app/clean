import { useEffect, useState } from "react";
import {
  CalendarClock,
  Eraser,
  FileArchive,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CleanOverlay } from "@/components/clean-overlay";
import { useLang } from "@/components/language-provider";
import {
  listSchedules,
  runTaskNow,
  setSchedule,
  type Cadence,
} from "@/lib/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Duración mínima visible del efecto de vaciado (ms). */
const MIN_FX = 4500;

const RUN_LABEL: Record<string, string> = {
  cleanup: "Liberando espacio…",
  trash: "Vaciando la papelera…",
  cache: "Liberando espacio…",
  dsstore: "Barriendo .DS_Store…",
};
const RUN_SUB: Record<string, string> = {
  cleanup: "Cachés, logs, Xcode y Papelera",
  trash: "Eliminando definitivamente",
  cache: "Vaciando cachés de usuario",
  dsstore: "Recorriendo tu carpeta de inicio",
};
const DONE_LABEL: Record<string, string> = {
  cleanup: "Espacio liberado",
  trash: "Papelera vaciada",
  cache: "Cachés limpiadas",
  dsstore: ".DS_Store eliminados",
};

const TASKS = [
  {
    id: "cleanup",
    name: "Liberar espacio",
    desc: "Limpia cachés, logs, Xcode y vacía la Papelera (no toca modelos de IA ni Docker).",
    icon: Sparkles,
  },
  {
    id: "dsstore",
    name: "Barrido de .DS_Store",
    desc: "Borra los .DS_Store de tu carpeta de inicio.",
    icon: FileArchive,
  },
  {
    id: "cache",
    name: "Limpiar cachés",
    desc: "Vacía las cachés de usuario (las apps las regeneran).",
    icon: Eraser,
  },
  {
    id: "trash",
    name: "Vaciar la papelera",
    desc: "Elimina definitivamente lo que haya en la papelera.",
    icon: Trash2,
  },
] as const;

const CADENCES: { v: Cadence; label: string }[] = [
  { v: "manual", label: "Manual" },
  { v: "daily", label: "Diaria" },
  { v: "weekly", label: "Semanal" },
  { v: "monthly", label: "Mensual" },
];

export function SchedulerPage() {
  const { t: tr } = useLang();
  const [sched, setSched] = useState<Record<string, Cadence>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listSchedules()
      .then((list) => {
        const m: Record<string, Cadence> = {};
        for (const s of list) m[s.task] = s.cadence;
        setSched(m);
      })
      .catch(() => {});
  }, []);

  async function changeCadence(task: string, cadence: Cadence) {
    const prev = sched[task] ?? "manual";
    setSched((s) => ({ ...s, [task]: cadence }));
    try {
      await setSchedule(task, cadence);
      toast.success(
        cadence === "manual"
          ? tr("Programación desactivada")
          : tr("Programada: {cadence}", {
              cadence: tr(
                CADENCES.find((c) => c.v === cadence)?.label ?? "",
              ).toLowerCase(),
            }),
      );
    } catch (e) {
      setSched((s) => ({ ...s, [task]: prev })); // revertir
      toast.error(tr("No se pudo programar"), { description: String(e) });
    }
  }

  async function runNow(task: string) {
    setBusy(task);
    const t0 = performance.now();
    try {
      await runTaskNow(task);
      // La operación es real; mantenemos el efecto de vaciado un mínimo creíble
      // y, si tarda más (p. ej. papelera grande), el overlay se mantiene.
      const dt = performance.now() - t0;
      if (dt < MIN_FX) await sleep(MIN_FX - dt);
      toast.success(tr(DONE_LABEL[task] ?? "Tarea ejecutada"));
    } catch (e) {
      toast.error(tr("Error al ejecutar"), { description: String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
        <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-sky-500" />
        <p>
          {tr(
            "Las tareas programadas se ejecutan solas a las 03:00 con launchd, aunque ZodHub Pulse esté cerrada. La purga de memoria no se programa porque requiere permiso de administrador.",
          )}
        </p>
      </div>

      {TASKS.map((t) => {
        const cadence = sched[t.id] ?? "manual";
        return (
          <Card
            key={t.id}
            data-slot="card"
            className="relative gap-2 py-3"
          >
            <CardHeader className="px-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <t.icon className="size-4 text-muted-foreground" />
                  {tr(t.name)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={busy === t.id}
                  onClick={() => runNow(t.id)}
                >
                  <Play className="size-3.5" />
                  {tr("Ejecutar ahora")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
              <p className="text-xs text-muted-foreground">{tr(t.desc)}</p>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={cadence}
                onValueChange={(v) => v && changeCadence(t.id, v as Cadence)}
              >
                {CADENCES.map((c) => (
                  <ToggleGroupItem key={c.v} value={c.v} className="px-3 text-xs">
                    {tr(c.label)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardContent>
            {busy === t.id && (
              <CleanOverlay
                label={tr(RUN_LABEL[t.id] ?? "Procesando…")}
                sub={RUN_SUB[t.id] ? tr(RUN_SUB[t.id]) : undefined}
                durationMs={MIN_FX}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

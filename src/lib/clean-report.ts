import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import type { DevCleanResult } from "@/lib/api";

export type Translate = (
  es: string,
  vars?: Record<string, string | number>,
) => string;

/**
 * Traduce el resultado de una limpieza en el aviso que ve el usuario.
 *
 * Está compartido entre el botón grande del Inicio y la página «Liberar
 * espacio» para que los dos digan exactamente lo mismo: si cada uno redactara
 * su propio mensaje, acabarían contando cosas distintas del mismo hecho.
 *
 * Tres desenlaces, y es importante no confundirlos:
 *   1. `errors`         → algo que se pidió NO se pudo hacer. Aviso naranja.
 *   2. Elementos en uso → la limpieza fue bien, pero había archivos abiertos
 *                         que se dejaron intactos. Es lo NORMAL en carpetas
 *                         temporales: se cuenta como éxito, con una coletilla.
 *                         Además explica por qué lo liberado puede ser menor
 *                         que lo estimado antes de empezar.
 *   3. Ninguno          → éxito a secas.
 *
 * La cifra de `freed` son bytes REALMENTE eliminados, contados uno a uno (y en
 * la Papelera, medidos justo antes de vaciarla). No es la diferencia de espacio
 * libre del disco: esa incluye lo que el sistema suelta por su cuenta y haría
 * que la app se apuntara méritos ajenos.
 */
export function reportClean(r: DevCleanResult, t: Translate) {
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

  toast.success(
    freed,
    skipped.length ? { description: skipped.join(" · ") } : undefined,
  );
}

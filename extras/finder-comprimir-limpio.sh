#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# "Comprimir con ZodHub Pulse" — cuerpo de la Acción Rápida (Quick Action) de Finder.
#
# Comprime cada elemento seleccionado en un .zip LIMPIO, sin .DS_Store,
# sin __MACOSX y sin resource forks (igual que el "Comprimir limpio" de ZodHub Pulse).
#
# Cómo instalarlo como opción del clic derecho (1 minuto, una sola vez):
#   1. Abre la app  Automator  →  Archivo  →  Nuevo  →  "Acción rápida".
#   2. Arriba: "El flujo de trabajo recibe"  →  "archivos o carpetas"  en  "Finder".
#   3. En el buscador de acciones (izquierda) arrastra  "Ejecutar script de Shell"
#      al área de la derecha.
#   4. En esa acción:  Shell = /bin/bash   y   "Pasar entrada" = "como argumentos".
#      Borra lo que haya y pega TODO el contenido de este archivo (de aquí abajo).
#   5. Guarda con  ⌘S  y ponle el nombre:  Comprimir con ZodHub Pulse
#
# A partir de ahí: clic derecho sobre carpetas/archivos en Finder →
#   "Acciones rápidas" → "Comprimir con ZodHub Pulse".
# (En Ajustes del sistema → Extensiones → Finder puedes ordenarla/activarla.)
# ─────────────────────────────────────────────────────────────────────────────

for src in "$@"; do
  [ -e "$src" ] || continue
  dir=$(dirname "$src")
  name=$(basename "$src")

  # Destino con nombre único: "Carpeta.zip", "Carpeta (2).zip", …
  out="$dir/$name.zip"
  i=2
  while [ -e "$out" ]; do
    out="$dir/$name ($i).zip"
    i=$((i + 1))
  done

  # -r recursivo · -X sin atributos extra (sin resource forks) ·
  # -x excluye .DS_Store en cualquier nivel. zip no crea __MACOSX.
  (
    cd "$dir" || exit 0
    zip -r -X "$out" "$name" -x "*.DS_Store" >/dev/null 2>&1
  )
done

exit 0

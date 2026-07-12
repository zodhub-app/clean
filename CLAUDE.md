# Instrucciones del proyecto MacUp

MacUp es una utilidad de mantenimiento para Mac: sencilla, transparente y
local-first. Hace lo esencial (limpiar cachés, liberar espacio, ordenar
`.DS_Store`, automatizar tareas) sin la monstruosidad ni el humo de los
limpiadores comerciales. Lema: «Tu Mac, sencillamente seguro».

## Regla de oro: la lógica real va en Rust (INNEGOCIABLE)

Toda operación **real** se implementa en **Rust** (`src-tauri/src/*.rs`) y se
expone al frontend como un comando Tauri (`#[tauri::command]` + `invoke`). Esto
incluye, sin excepción:

- Sistema de archivos: enumerar, calcular tamaños, leer, **borrar**, mover,
  comprimir (zip), barridos recursivos.
- Red / "escaneo de internet": throughput, paquetes, sockets (`netstat`),
  conexiones, puertos a la escucha.
- Telemetría del sistema: CPU, memoria, `vm_stat`, procesos (`sysinfo`).
- Integración con macOS: `launchctl`/LaunchAgents, `defaults`, `osascript`,
  `purge`, `vm_stat`, etc.

El **frontend (React/TS) NO hace trabajo pesado**: solo UI, estado, formateo y
aritmética trivial (p. ej. convertir totales acumulados en tasas para un
gráfico). Nada de recorrer el disco, escanear red ni borrar archivos en JS.
Motivo: rendimiento, seguridad de tipos y que el hilo de UI nunca se bloquee.

Si una función nueva necesita tocar disco, red o el sistema → **primero el
comando Rust**, luego la UI que lo llama. Para tareas potencialmente largas,
considerar trabajo en hilos/`async` en Rust para no bloquear.

## Principios innegociables

1. **Honestidad**: nada de promesas absolutas ("100% seguro", "antivirus"). Las
   etiquetas reflejan lo que la app hace de verdad. El radar de red es una
   representación; su intensidad usa datos reales. Aproximaciones (p. ej.
   "presión de memoria") se marcan como tales.
2. **Local-first / privacidad**: todo se ejecuta en el equipo del usuario. Cero
   telemetría. Los datos nunca salen del Mac.
3. **Borrado responsable**: el borrado es permanente y se confirma; se valida
   que las rutas estén dentro de los ámbitos permitidos; nunca se siguen
   symlinks al calcular tamaños; nunca se tocan rutas del sistema/SIP.
4. **Admin solo cuando hace falta**: elevar con `osascript ... with
   administrator privileges` únicamente para rutas/acciones privilegiadas
   (p. ej. `purge`, `/Library/Caches`). Lo demás, en espacio de usuario.

## Stack y convenciones

- Tauri 2 + React 19 + Vite + TypeScript estricto + Tailwind v4 + shadcn/ui.
- Temas de color: 15 presets de tweakcn generados por `scripts/build-themes.mjs`
  (`npm run themes`). NO editar `src/themes.css` ni `src/lib/themes.ts` a mano.
- Fuentes de los temas: woff2 LOCALES (local-first, nunca a Google en runtime)
  descargadas por `scripts/build-fonts.mjs` (`npm run fonts`) → `public/fonts/` +
  `src/fonts.css`. NO editar `src/fonts.css` a mano.
- Estilo propio "Hera" (skin de cristal) autocontenido en
  `src/styles/skin-hera.css` (ver `HERA.md`). Skins/materiales se aplican con
  atributos en `<html>` desde `ThemeProvider`.
- Diseño: minimalista, denso, sin espacio desperdiciado. Cabecera fija; títulos
  solo en el navbar; tarjetas a todo el ancho con ~10–20px de margen.
- Modales: usar `createPortal` a `body` (para no quedar atrapados bajo el
  `backdrop-filter` de Hera).

## Restricción de build

El entorno del asistente tiene el registro npm bloqueado y no puede compilar; una
app Tauri de macOS se compila en el Mac del usuario. El asistente escribe el
código correcto; el usuario ejecuta `npm install` / `npm run tauri dev`. Tras
añadir dependencias nuevas (JS o crates), avisar de que hay que reinstalar.

## Estado

v1 completo: Resumen (telemetría en vivo + radar de red + monitor estilo Monitor
de Actividad), Caché, Memoria, .DS_Store y Tareas (launchd). Pendiente: servicio
de Finder «Comprimir con MacUp» (requiere empaquetar el `.app` con NSServices).

<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="ZodHub CleanPC" />

# ZodHub CleanPC

**Tu Mac, sencillamente limpio y seguro.**

Utilidad de mantenimiento y limpieza para macOS: directa, transparente y 100 % local.
Hace lo esencial —limpiar cachés, liberar espacio, ordenar `.DS_Store`, automatizar el
mantenimiento— sin la monstruosidad ni el humo de los limpiadores comerciales.

[![Descargar para Mac](https://img.shields.io/badge/⬇%20Descargar%20para%20Mac-Intel%20%2B%20Apple%20Silicon-0A84FF?style=for-the-badge)](https://github.com/zodhub-app/clean/releases/latest)

![macOS](https://img.shields.io/badge/macOS-11%2B-black?logo=apple)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)
![local-first](https://img.shields.io/badge/local--first-privado-2ea44f)
[![Última versión](https://img.shields.io/github/v/release/zodhub-app/clean?label=versión)](https://github.com/zodhub-app/clean/releases/latest)

</div>

---

<div align="center">
  <img src="docs/screenshot-resumen.png" alt="ZodHub CleanPC — pantalla de Resumen" width="860" />
  <br><em>Resumen: telemetría en vivo, radar de red y monitor de procesos.</em>
</div>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshot-memoria.png" alt="Memoria" /><br><sub><b>Memoria</b> — presión de RAM y desglose explicado.</sub></td>
    <td width="50%"><img src="docs/screenshot-tareas.png" alt="Tareas" /><br><sub><b>Tareas</b> — mantenimiento programado con launchd.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshot-ajustes.png" alt="Ajustes" /><br><sub><b>Ajustes</b> — temas, apariencia y escala de la interfaz.</sub></td>
    <td width="50%"><img src="docs/screenshot-ds-store.png" alt=".DS_Store" /><br><sub><b>.DS_Store</b> — comprime en zip limpio y barre los .DS_Store.</sub></td>
  </tr>
</table>

<div align="center"><sub>Y además: Almacenamiento, Explorador de archivos grandes, Instantáneas APFS, Cachés de desarrollo, Desinstalador y Duplicados.</sub></div>

---

## Descargar

Ve a **[la última versión](https://github.com/zodhub-app/clean/releases/latest)** y descarga
`ZodHub.Clean_x.y.z_universal.dmg`. Un único archivo que funciona tanto en **Mac Intel** como
en **Apple Silicon** (M1/M2/M3/M4).

1. Abre el `.dmg` y arrastra la app a **Aplicaciones**.
2. La primera vez, **clic derecho sobre la app › Abrir** (todavía no está firmada con Apple,
   así que macOS pide esta confirmación una sola vez).
3. A partir de ahí, la app **te avisa sola** cuando hay una versión nueva y se actualiza con un clic.

## Qué hace

- **Resumen** — telemetría en vivo (CPU, memoria, disco, temperatura), radar de red y un
  monitor de procesos estilo Monitor de Actividad.
- **Almacenamiento** — desglose del disco por categorías, con histórico de crecimiento.
- **Explorador** — encuentra los archivos y carpetas más grandes; ábrelos en Finder.
- **Instantáneas APFS** — lista y adelgaza las instantáneas locales que ocupan disco.
- **Cachés** — escaneo y limpieza de `~/Library/Caches`, con tamaños reales.
- **Memoria** — presión de RAM y purga opcional (con etiqueta honesta: macOS gestiona bien la memoria).
- **Cachés de desarrollo** — Docker, `node_modules`, Xcode, npm/yarn/pnpm/pip/brew, modelos de IA…
- **Desinstalador** — quita apps y sus restos.
- **Duplicados** — buscador por hash de contenido (SHA-256).
- **.DS_Store** — comprime en zip limpio y barre los `.DS_Store`.
- **Tareas** — mantenimiento programado (diario/semanal/mensual) con `launchd`.

## Principios

- **Honestidad.** Nada de promesas absolutas ni «antivirus». Si un dato no existe (p. ej. un
  sensor de temperatura), se muestra `—`, nunca un valor inventado.
- **Privado y local.** Todo se ejecuta en tu Mac. Cero telemetría; tus datos nunca salen del equipo.
- **Borrado responsable.** El borrado se previsualiza y se confirma; nunca se tocan rutas del sistema.

## Actualizaciones automáticas

ZodHub CleanPC lleva un actualizador integrado (Tauri): al arrancar comprueba si hay una versión
nueva y, si la hay, la descarga, **verifica su firma** e instala con un clic. Nada de reinstalar a mano.

## Para desarrolladores

Requisitos: Node 20+, Rust (rustup) y las Command Line Tools de Xcode.

```bash
npm run bootstrap      # npm install + componentes de shadcn
npm run tauri dev      # arrancar en desarrollo
```

Toda la lógica real (disco, red, sistema) vive en **Rust** (`src-tauri/src/*.rs`) como comandos
Tauri; el frontend (React 19 + Tailwind v4 + shadcn/ui) solo hace interfaz. Para publicar una
versión nueva, sube el número en `tauri.conf.json`, `Cargo.toml` y `package.json`, y empuja un
tag `vX.Y.Z`: el CI compila el `.dmg` universal, lo firma y crea la release.

## Stack

Tauri 2 · React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · Rust (sysinfo, walkdir, zip)

<div align="center"><sub>Hecho con cuidado por <a href="https://github.com/zodhub-app">ZodHub</a> · Tu Mac, sencillamente seguro.</sub></div>

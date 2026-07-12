# MacUp

Una app de mantenimiento del Mac, sencilla y honesta. Tauri 2 + React 19 +
Tailwind v4 + shadcn/ui.

## Puesta en marcha (en tu Mac)

Requisitos: Node 20+, Rust (rustup) y Xcode Command Line Tools.

```bash
# 1) Instala dependencias y añade los componentes de shadcn que usa la app
npm run bootstrap

# 2) Arranca en modo desarrollo
npm run tauri dev
```

`npm run bootstrap` hace `npm install` y luego `npx shadcn@latest add ...` con
los componentes necesarios (sidebar, card, chart, etc.).

## Estado actual (v0.1.0 — incremento 1)

- Esqueleto de la app con navegación lateral.
- **Resumen**: métricas en vivo (CPU, RAM, disco, uptime) y gráfico de área de
  shadcn alimentado por `sysinfo` desde Rust.
- **Ajustes**: selector de tema de color (tweakcn) y modo claro/oscuro/sistema.
- Caché, Memoria, .DS_Store y Tareas: pantallas de próximamente; se construyen
  una a una en los siguientes incrementos.

## Temas

El sistema de temas usa variables CSS. Para añadir un tema desde
[tweakcn](https://tweakcn.com/editor/theme), pega su export en
`src/themes.css` y regístralo en `src/lib/themes.ts` (ver cabecera de
`themes.css`).

## Arquitectura de la limpieza (próximos incrementos)

- **Caché**: escaneo de `~/Library/Caches` con tamaños y selección; borrado
  permanente; admin solo para rutas privilegiadas.
- **Memoria**: gráfico de presión + purga opcional (`purge`) con etiqueta
  honesta (macOS gestiona bien la RAM).
- **.DS_Store**: comprimir limpio (sin `.DS_Store`/`__MACOSX`/resource forks),
  barrido de `.DS_Store`, atajo de Finder «Comprimir con MacUp» (Servicio
  macOS), y ajuste de unidades de red/USB.
- **Tareas**: `launchd` LaunchAgents por tarea (diaria/semanal/mensual/manual).

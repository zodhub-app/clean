# Hera — nuestro design system portable

Hera no es un theme (paleta de color) ni una app: es un **skin/estilo
autocontenido** que se superpone a cualquier proyecto **shadcn/ui + Tailwind
v4**. Da: sidebar y contenido flotantes sobre un canvas con aurora animada,
cristal mate con grano, navegación en píldora con hover deslizante, tarjetas
de cristal que se elevan, botones con degradado y brillo. Consume los tokens
de color del tema activo, así que combina con cualquier paleta.

Todo vive en **un solo archivo**: `src/styles/skin-hera.css`.

## Llevarlo a otro proyecto (3 pasos)

1. Copia `src/styles/skin-hera.css` a tu proyecto.
2. Impórtalo en tu CSS, **después** de tus tokens de shadcn:
   ```css
   @import "./styles/skin-hera.css";
   ```
3. Activa el estilo poniendo el atributo en `<html>`:
   ```js
   document.documentElement.setAttribute("data-skin", "hera");
   ```
   Y quítalo (`removeAttribute("data-skin")`) para volver al estilo plano.

Listo. Con eso se aplica con su configuración por defecto, sin tocar nada más.

## Requisitos (los cumple cualquier shadcn estándar)

- Tokens de color de shadcn: `--card`, `--primary`, `--sidebar`, `--chart-1..5`,
  `--foreground`, `--background`, etc.
- Componentes shadcn con sus `data-slot` (`card`, `button`, `sidebar-inner`,
  `sidebar-inset`, `badge`, `input`…) y `data-variant` en `Button`.
- El header/topbar de tu app con `data-slot="topbar"` (para el frosted de la
  barra superior). Si no lo pones, el resto de Hera funciona igual.

## Ajuste fino (opcional)

Dos variables CSS, con valores por defecto ya buenos:

- `--macup-blur` (px) — desenfoque del cristal (por defecto 16px).
- `--macup-noise` (0–1) — opacidad del grano del cristal mate (por defecto 0.1).

Si no las defines, Hera usa los valores por defecto. En ZodHub CleanPC se controlan con
sliders desde Ajustes.

## Estilo por defecto recomendado (el "look" de ZodHub CleanPC)

Configuración por defecto validada (ThemeProvider + tauri.conf.json):

- **Tema de color:** `elegant-luxury` (tweakcn).
- **Material de tarjetas:** `matte` (cristal mate con grano).
- **Desenfoque:** `--macup-blur: 25px`.
- **Grano:** `--macup-noise: 0.25` (25%).
- **Sombra:** nivel `3` (Fuerte) → `--macup-shadow`.
- **Ventana (Tauri):** `1100 × 700`, `minWidth 880`, `minHeight 600`,
  `titleBarStyle: "Overlay"`, `hiddenTitle: true`,
  `trafficLightPosition: { x: 26, y: 27 }`.

En ZodHub CleanPC esto se fija en `src/components/theme-provider.tsx` (constantes
`DEFAULT_*`) con una migración de una sola vez (`macup.defaultsV`).

## Convertirlo en "skill"

Una skill instalable (para que Claude aplique Hera a cualquier proyecto a
golpe de comando) se instala desde **Ajustes > Capacidades** o con el
`skill-creator`. El contenido de la skill sería, básicamente, este archivo +
`skin-hera.css`. Pídemelo y te preparo el bundle listo para instalar.

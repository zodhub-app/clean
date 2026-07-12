---
name: cobe-globe
description: Add, configure, theme, or debug an interactive WebGL globe (the cobe library, v2.x) in any React 18+ project with Tailwind v4 — Next.js, Vite, or Tauri. Use when building a globe with markers, connection arcs, floating marker labels/badges, drag-to-spin, auto-rotation, design-token theming, or a hero background; or when a cobe globe renders as a static black blob / doesn't rotate (the classic v2 `onRender` mistake). Ships a drop-in generic `Globe.tsx` plus the exhaustive cobe option reference.
---

# cobe globe — interactive WebGL globe for React

[cobe](https://github.com/shuding/cobe) is a ~5KB WebGL globe (the dotted, rotating
globe from the Stripe/Vercel/Magic UI demos). This skill makes it trivial to drop a
**fully-configurable** globe into any React + Tailwind v4 app and exposes **every**
cobe option, plus features cobe doesn't give you out of the box: drag-to-spin,
responsive resize, and floating HTML **label badges** anchored to markers.

It is framework-agnostic: no router, no design system, no build assumptions. Only
deps are `react` and `cobe`.

## When to use this skill

- Adding a globe (hero, contact/network section, "global presence" block).
- Plotting **markers** (glowing dots) and/or **arcs** (curved connections between two points).
- Putting **labels/badges** on markers (like the cobe interactive demo).
- Theming the globe with your palette (hex, `rgb()`, or CSS custom properties / shadcn tokens).
- Debugging: the globe is a **static black blob**, **doesn't rotate**, **doesn't drag**,
  or **renders at 0×0 / invisible**. → See [Gotchas](#gotchas). 99% of these are the
  v2 `onRender` mistake or the 0×0 init.

## Requirements & install

- React **18+**, Tailwind CSS **v4** (for the utility classes used by the badge).
- `shadcn/ui` is **optional** — only the label badge uses `bg-primary` /
  `text-primary-foreground`. Override with `labelClassName` if you don't use shadcn.

```bash
npm i cobe          # pins ^2.x — DO NOT use 0.6.x (different API, no arcs)
```

Then copy `Globe.tsx` from this skill into your project (e.g. `src/components/Globe.tsx`).
It has zero project-specific imports.

> **Next.js App Router:** keep the `"use client"` line at the top.
> **Vite / Tauri / CRA:** you may delete that line (it's a harmless no-op there).

## Quick start

```tsx
import { Globe } from "@/components/Globe";

export function Hero() {
	return (
		<Globe
			size={500}
			markers={[
				{ location: [40.71, -74.0], size: 0.1, label: "New York", sublabel: "HQ" },
				{ location: [51.5, -0.12], size: 0.08, label: "London" },
				{ location: [35.68, 139.69], size: 0.1, label: "Tokyo" },
			]}
			arcs={[
				{ from: [40.71, -74.0], to: [51.5, -0.12] },
				{ from: [51.5, -0.12], to: [35.68, 139.69] },
			]}
			baseColor="var(--muted-foreground)"
			markerColor="var(--primary)"
			glowColor="var(--primary)"
			arcColor="var(--primary)"
		/>
	);
}
```

Markers with a `label` get a floating badge that fades as it rotates behind the globe.
Markers without one are plain dots.

## 🛑 The #1 cobe v2 pitfall (read this)

cobe **v2 removed the `onRender` callback** that every old tutorial/Stripe-era snippet
uses. In v0.6.x you passed `onRender(state)` and mutated `state.phi` each frame. In v2:

```ts
const globe = createGlobe(canvas, opts); // returns { update, destroy }  — NO onRender
// You drive every frame yourself:
function frame() {
	phi += 0.005;
	globe.update({ phi });            // partial update; re-renders one frame
	requestAnimationFrame(frame);
}
frame();
```

If you paste a v0.6.x snippet against v2 you get a **static black blob that never rotates**
(the `onRender` is silently ignored, and the canvas is created once at 0×0). `Globe.tsx`
already does the rAF loop + resize correctly — this note is for when you're working
without it or debugging someone else's code.

## Component props (Globe.tsx)

Grouped; all optional. For the underlying cobe meaning, ranges, and defaults of every
knob, see **[reference.md](./reference.md)**.

| Group | Props |
|---|---|
| **Data** | `markers: GlobeMarker[]`, `arcs: GlobeArc[]` |
| **Colours** (CSS string / `var(--token)`) | `baseColor`, `markerColor`, `glowColor`, `arcColor` |
| **Appearance** | `dark`, `diffuse`, `mapBrightness`, `mapBaseBrightness`, `mapSamples`, `markerElevation`, `opacity` |
| **Camera / motion** | `phi`, `theta`, `scale`, `offset`, `autoRotate`, `rotationSpeed`, `enableDrag` |
| **Arc shape** | `arcWidth`, `arcHeight` |
| **Layout** | `size`, `devicePixelRatio`, `align`, `className`, `labelClassName` |

```ts
interface GlobeMarker {
	location: [number, number]; // [lat, lng] degrees
	size?: number;              // 0.01–0.5, default 0.05
	color?: string;             // per-marker dot colour (falls back to markerColor)
	label?: string;             // floating badge text (omit → plain dot)
	sublabel?: string;          // badge second line
}
interface GlobeArc {
	from: [number, number];     // [lat, lng]
	to: [number, number];
	color?: string;             // per-arc colour (falls back to arcColor)
}
```

## Recipes

**Theme with design tokens.** Any prop colour accepts a CSS custom property; it's
resolved against the live document, so dark/light themes work automatically:
```tsx
<Globe baseColor="var(--muted-foreground)" markerColor="var(--primary)" glowColor="var(--primary)" />
```

**Connection arcs.** Arcs are independent of markers — give explicit `from`/`to`
coordinates. `arcHeight` controls the curve apex (0 = hug surface, ~0.5 = tall arc):
```tsx
<Globe arcs={[{ from: [37.77, -122.41], to: [48.85, 2.35], color: "var(--chart-2)" }]} arcHeight={0.4} />
```

**Static (no spin, no drag) — e.g. a fixed logo globe:**
```tsx
<Globe autoRotate={false} enableDrag={false} phi={2.4} theta={0.25} />
```

**Hero background.** Wrap in a positioned container and let it bleed; `pointer-events`
on the canvas stay active for drag, so put it behind content with `-z-10` if you want
the content clickable:
```tsx
<div className="relative">
	<div className="-z-10 absolute inset-0 opacity-40">
		<Globe size="100%" enableDrag={false} />
	</div>
	<YourHeroCopy />
</div>
```

**Responsive size.** `size` is a *max*; the globe is always a square that shrinks to fit
its parent. Use a number (px) or any CSS length (`"100%"`, `"40rem"`, `"min(80vw,600px)"`).

**Performance.** Lower `mapSamples` (e.g. 8000) on low-end devices / many globes. The
component caps `devicePixelRatio` at 2 by default — pass `devicePixelRatio={1}` to halve
the fill cost.

## Gotchas

- **Static black blob / no rotation** → the v2 `onRender` mistake. Use the rAF + `update()`
  loop (see above). `Globe.tsx` handles it.
- **0×0 / invisible on mount** → cobe must be created *after* the canvas has a real width,
  or it inits at 0×0 and never recovers. `Globe.tsx` gates creation behind a `ResizeObserver`.
  If you roll your own, never call `createGlobe` synchronously before layout.
- **Colours look wrong** → cobe wants `[r,g,b]` in **0–1**, not 0–255 and not CSS strings.
  `Globe.tsx`'s `cssToRgb` converts hex / `rgb()` / named / `var(--token)`. If you pass raw
  arrays to cobe directly, divide by 255.
- **`"use client"`** → required in Next.js App Router (it touches `window`/WebGL); a no-op
  elsewhere.
- **StrictMode double-mount (dev)** → the effect cleans up (`destroy()` + `cancelAnimationFrame`)
  so the dev double-invoke is safe.
- **Label drift** → marker labels are HTML overlays projected with cobe's own math, assuming a
  **square** canvas (which `Globe.tsx` enforces). Don't force a non-square aspect on the canvas.
- **Native cobe labels** → cobe v2 *can* anchor labels itself via CSS Anchor Positioning
  (give a marker an `id`), but that's **Chromium-only** today. This skill projects labels in
  JS instead for cross-browser support. See reference.md if you specifically target Chromium.

## Browser support

WebGL is required (every modern browser + WebView2/WKWebView used by Tauri). Software
renderers (headless CI) often won't draw cobe's point sprites — don't rely on headless
screenshots to verify the visual; check a real browser/WebView.

## Files in this skill

- **`Globe.tsx`** — the drop-in component. Copy into your project. Deps: `react` + `cobe`.
- **`reference.md`** — every `COBEOptions` field (type, default, range, effect), the
  `Marker`/`Arc` shapes, the `createGlobe`/`update`/`destroy` API, the lat/lng→screen
  projection math (for custom overlays), and the v2-vs-v0.6 differences.

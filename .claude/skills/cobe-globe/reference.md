# cobe — complete option reference (v2.x)

Every option the `cobe` library exposes, its type, default, useful range, and effect.
Verified against `cobe@2.0.1` (`dist/index.d.ts` + the WebGL source). This is the raw
library API; `Globe.tsx` wraps it with friendlier defaults and CSS-colour strings.

## API surface

```ts
import createGlobe, { type COBEOptions, type Marker, type Arc, type Globe } from "cobe";

const globe: Globe = createGlobe(canvas, options); // canvas: HTMLCanvasElement

globe.update(partial: Partial<COBEOptions>); // apply changes + render ONE frame
globe.destroy();                             // free WebGL resources + remove internals
```

- **No `onRender`.** (It existed in v0.6.x and is gone.) You animate by calling
  `globe.update({ phi })` from your own `requestAnimationFrame` loop.
- `update()` is a **partial merge** — only the fields you pass change; everything else
  keeps its last value. Passing `{ width, height }` resizes; `{ markers }` / `{ arcs }`
  rebuild those buffers; `{ phi }` / `{ theta }` rotate.
- `createGlobe` must run **after** the canvas has a non-zero size (else 0×0 dead globe).

## `COBEOptions`

`[r, g, b]` colour channels are **0–1** (not 0–255). Angles are **radians**.

| Option | Type | Default | Range / notes | Effect |
|---|---|---|---|---|
| `width` | `number` *(required)* | — | logical px | Canvas width; backing store = `width * devicePixelRatio`. Typically pass the CSS px width. |
| `height` | `number` *(required)* | — | logical px | Canvas height. Keep it equal to `width` (cobe assumes a square). |
| `devicePixelRatio` | `number` | `1` | 1–2(–3) | Multiplies width/height for the backing store (retina sharpness). Cap at 2 for perf. |
| `phi` | `number` | `0` | radians (wraps 0–2π) | Rotation around the vertical axis (the spin). Increment each frame to auto-rotate. |
| `theta` | `number` | `0` | ~`-0.7`–`0.7` | Axial tilt. `0` centres the equator; positive tilts the north pole toward the viewer (~`0.3` is the common "nice" value). |
| `scale` | `number` | `1` | `0.5`–`3` | Zoom. `>1` enlarges the globe within the canvas, `<1` shrinks it. |
| `offset` | `[number, number]` | `[0, 0]` | device px `[x, y]` | Translates the globe within the canvas (off-centre compositions, partial/peeking globe). |
| `dark` | `number` | `0` | `0`–`1` | Night-side darkness. `0` = evenly lit; `1` = strong dark hemisphere (day/night terminator). |
| `diffuse` | `number` | `1` | `0`–`2` | Diffuse light spread / softness of the lit hemisphere. Higher = flatter, more evenly lit. |
| `mapSamples` | `number` | `10000` | `1000`–`30000` | Number of land dots. Higher = denser/cleaner continents, more GPU. |
| `mapBrightness` | `number` | `1` | `0`–`10` | Brightness of the land dots. `~1` subtle, `~6` punchy (the Magic UI look). |
| `mapBaseBrightness` | `number?` | `0` | `0`–`1` | Minimum dot brightness on the **dark** side (so continents stay faintly visible at night). |
| `baseColor` | `[r,g,b]` | `[1,1,1]` | 0–1 each | Colour of the land dots. |
| `markerColor` | `[r,g,b]` | `[1,0.5,0]` | 0–1 each | Default colour of marker dots (overridable per-marker). |
| `glowColor` | `[r,g,b]` | `[1,1,1]` | 0–1 each | Atmosphere/edge glow colour. |
| `opacity` | `number?` | `1` | `0`–`1` | Overall globe opacity (useful for faded backgrounds). |
| `markers` | `Marker[]?` | `[]` | — | Glowing dots at lat/lng. See `Marker` below. |
| `markerElevation` | `number?` | `0.05` | `0`–`0.5` | How far markers (and arc endpoints) float above the surface. |
| `arcs` | `Arc[]?` | `[]` | — | Curved connections between two lat/lng points. **New in v2.** See `Arc` below. |
| `arcColor` | `[r,g,b]?` | `[0.3,0.6,1]` | 0–1 each | Default arc colour (overridable per-arc). **New in v2.** |
| `arcWidth` | `number?` | `1` | `0.1`–`5` | Arc line thickness (internally scaled ×0.005). **New in v2.** |
| `arcHeight` | `number?` | `0.2` | `0`–`1+` | Arc apex height above the surface. `0` hugs the globe; `~0.5` is a tall hop. **New in v2.** |
| `context` | `WebGLContextAttributes?` | — | — | Passed to `getContext("webgl2"\|"webgl")` (e.g. `{ alpha: true, antialias: true }`). Rarely needed. |

### `Marker`

```ts
interface Marker {
	location: [number, number]; // [latitude, longitude] in DEGREES (lat −90..90, lng −180..180)
	size: number;               // dot radius, ~0.01–0.5 (0.05 typical)
	color?: [number, number, number]; // per-marker dot colour (0–1). New in v2. Falls back to markerColor.
	id?: string;                // New in v2. Enables cobe's native CSS-anchor label (Chromium-only — see below).
}
```

### `Arc`

```ts
interface Arc {
	from: [number, number];     // [latitude, longitude] start
	to: [number, number];       // [latitude, longitude] end
	color?: [number, number, number]; // per-arc colour (0–1). Falls back to arcColor.
	id?: string;                // native CSS-anchor for the arc midpoint (--cobe-arc-<id>).
}
```

## Coordinate system

- **`location` / `from` / `to`** are `[latitude, longitude]` in **degrees**.
  (Lat +90 = north pole, −90 = south; lng 0 = prime meridian, + = east.)
- **`phi`** spins the globe; **`theta`** tilts it. Both in radians.
- Markers/arcs sit at radius `0.8 + markerElevation` (the globe disk itself is radius `0.8`
  in normalized device space, i.e. it fills ~80% of the square canvas).

## Animation loop (the canonical v2 pattern)

```ts
let phi = 0;
let width = 0;
const onResize = () => { width = canvas.offsetWidth; };
const ro = new ResizeObserver(onResize); ro.observe(canvas); onResize();

const globe = createGlobe(canvas, {
	devicePixelRatio: 2,
	width: width * 2, height: width * 2, // or width*dpr; keep square
	phi: 0, theta: 0.3,
	dark: 0, diffuse: 1.2, mapSamples: 16000, mapBrightness: 6,
	baseColor: [1, 1, 1], markerColor: [0.9, 0.1, 0.2], glowColor: [1, 1, 1],
	markers: [{ location: [40.71, -74.0], size: 0.1 }],
});

let raf = 0;
const frame = () => { phi += 0.005; globe.update({ phi }); raf = requestAnimationFrame(frame); };
frame();

// cleanup: cancelAnimationFrame(raf); ro.disconnect(); globe.destroy();
```

## lat/lng → screen projection (for custom HTML overlays)

If you want to anchor your own HTML (labels, tooltips, pins) to markers, replicate cobe's
projection. This is exactly what `Globe.tsx` does for label badges. Assumes a square canvas.

```ts
const DEG = Math.PI / 180;

// lat/lng (deg) → unit sphere vector. Scale by (0.8 + markerElevation) for a marker.
function latLngToVec3(lat: number, lng: number): [number, number, number] {
	const a = lat * DEG, b = lng * DEG - Math.PI, cosLat = Math.cos(a);
	return [-cosLat * Math.cos(b), Math.sin(a), cosLat * Math.sin(b)];
}

// Returns x,y in 0..1 across the canvas, plus whether the point faces the viewer.
// phi/theta/scale/offset must match the globe's current values; cssSize = canvas CSS px.
function project(v: number[], phi: number, theta: number, scale: number, offset: [number, number], cssSize: number) {
	const cT = Math.cos(theta), sT = Math.sin(theta), cP = Math.cos(phi), sP = Math.sin(phi);
	const c = cP * v[0] + sP * v[2];
	const s = sP * sT * v[0] + cT * v[1] - cP * sT * v[2];
	const z = -sP * cT * v[0] + sT * v[1] + cP * cT * v[2];
	return {
		x: (c * scale + (offset[0] * scale) / cssSize + 1) / 2,
		y: (-s * scale + (offset[1] * scale) / cssSize + 1) / 2,
		visible: z >= 0 || c * c + s * s >= 0.64, // front hemisphere (fade out when false)
	};
}
```

Position an absolutely-placed element at `left: x*100%`, `top: y*100%` inside the square
globe container, and toggle opacity on `visible`. Run it inside the same rAF loop with the
current `phi`.

## cobe's native labels (CSS Anchor Positioning — Chromium-only)

As an alternative to JS projection, cobe v2 can anchor labels itself: give a marker/arc an
`id`. cobe then creates an invisible element with `anchor-name: --cobe-<id>` (arcs:
`--cobe-arc-<id>`) at the projected position, and writes `:root { --cobe-visible-<id>: N }`
while the point faces the viewer. Position your label with `position-anchor: --cobe-<id>`.
This needs **CSS Anchor Positioning** (Chrome/Edge 125+, not yet Firefox/Safari), so for
cross-browser apps prefer the JS projection above (what `Globe.tsx` uses).

## v2 vs v0.6.x — what changed

| | v0.6.x | v2.x |
|---|---|---|
| Animation | `onRender(state)` callback; mutate `state.phi/width/height` per frame | **No `onRender`.** `createGlobe` returns `{ update, destroy }`; call `update({ phi })` from your own rAF |
| Return value | a `Phenomenon` instance | `{ update, destroy }` |
| Arcs | ✗ | ✅ `arcs`, `arcColor`, `arcWidth`, `arcHeight` |
| Per-marker colour / id | ✗ | ✅ `Marker.color`, `Marker.id` |
| `markerElevation`, `mapBaseBrightness` | ✗ | ✅ |
| `markers` | required | optional |
| Dependencies | depends on `phenomenon` | self-contained |
| Native labels | ✗ | ✅ via CSS Anchor Positioning (Chromium-only) |

> Pinning matters: `npm i cobe` installs **v2.x**. If you see `onRender` in a tutorial it's
> v0.6.x — don't downgrade just to follow it; use the v2 `update()` loop instead. Downgrading
> to 0.6.x also loses arcs entirely.

## Links

- Repo: https://github.com/shuding/cobe
- Interactive demo + option playground: https://cobe.vercel.app

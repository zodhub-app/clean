"use client";
// ^ Required ONLY for Next.js App Router. Safe to delete in Vite / Tauri / CRA
//   (there it is just an ignored directive prologue).
//
// Globe — a fully-configurable WebGL globe built on `cobe` (v2.x).
// Generic, framework-agnostic React component. Dependencies: `react` + `cobe`.
// Works in any React 18+ project (Next.js, Vite, Tauri, …) with Tailwind v4.
// The label badges use shadcn design tokens (`bg-primary`, `text-primary-foreground`)
// but you can override them with `labelClassName`.
//
// ─── Why this component exists ────────────────────────────────────────────────
// cobe v2 has NO `onRender` callback (that was v0.6.x). `createGlobe` returns
// `{ update, destroy }`; rotation/drag must be driven from your OWN
// requestAnimationFrame loop via `globe.update({ phi })`. Getting that wrong is the
// #1 reason a cobe globe "doesn't move / is a black blob". This component does it
// right, and adds: drag-to-spin, responsive resize, per-marker/per-arc colours,
// and floating HTML label badges anchored to markers (portable — cobe's built-in
// label anchors require CSS Anchor Positioning, which is Chromium-only).

import createGlobe, { type COBEOptions, type Globe as CobeGlobe } from "cobe";
import { useEffect, useRef } from "react";

/* ────────────────────────────────────────────────────────────────────────── */
/* Public types                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface GlobeMarker {
	/** `[latitude, longitude]` in degrees. */
	location: [number, number];
	/** Dot size, roughly 0.01–0.5. Default 0.05. */
	size?: number;
	/** Per-marker dot colour (any CSS colour). Falls back to `markerColor`. */
	color?: string;
	/** Optional floating HTML badge anchored to the marker. */
	label?: string;
	/** Optional second badge line (e.g. "2,103 users"). */
	sublabel?: string;
}

export interface GlobeArc {
	/** `[latitude, longitude]` start, in degrees. */
	from: [number, number];
	/** `[latitude, longitude]` end, in degrees. */
	to: [number, number];
	/** Per-arc colour (any CSS colour). Falls back to `arcColor`. */
	color?: string;
}

export interface GlobeProps {
	// ── Data ──────────────────────────────────────────────────────────────
	markers?: GlobeMarker[];
	arcs?: GlobeArc[];

	// ── Colours (hex, rgb(), named, or var(--token)) ──────────────────────
	/** Land dots. Default `#ffffff`. */
	baseColor?: string;
	/** Marker dots. Default `#e11d2f`. */
	markerColor?: string;
	/** Atmosphere glow. Default `#ffffff`. */
	glowColor?: string;
	/** Arcs. Default `#3b82f6`. */
	arcColor?: string;

	// ── Appearance ────────────────────────────────────────────────────────
	/** Night-side darkness, 0–1. Default 0. */
	dark?: number;
	/** Light spread, ~0–2. Default 1.2. */
	diffuse?: number;
	/** Land-dot brightness, ~0–10. Default 6. */
	mapBrightness?: number;
	/** Minimum (dark-side) dot brightness, 0–1. Default 0. */
	mapBaseBrightness?: number;
	/** Dot density. Default 16000. */
	mapSamples?: number;
	/** How far markers/arcs sit above the surface. Default 0.05. */
	markerElevation?: number;
	/** Whole-globe opacity, 0–1. Default 1. */
	opacity?: number;

	// ── Camera / animation ────────────────────────────────────────────────
	/** Initial rotation, radians. Default 0. */
	phi?: number;
	/** Vertical tilt, radians. Default 0.3. */
	theta?: number;
	/** Zoom factor. Default 1. */
	scale?: number;
	/** Pixel offset `[x, y]`. Default `[0, 0]`. */
	offset?: [number, number];
	/** Auto-rotate when not dragging. Default true. */
	autoRotate?: boolean;
	/** Radians added to phi per frame while auto-rotating. Default 0.005. */
	rotationSpeed?: number;
	/** Drag to spin. Default true. */
	enableDrag?: boolean;

	// ── Arc shape ─────────────────────────────────────────────────────────
	/** Arc line thickness. Default 1. */
	arcWidth?: number;
	/** Arc curve apex height. Default 0.3. */
	arcHeight?: number;

	// ── Layout / rendering ────────────────────────────────────────────────
	/** Max size of the (square) globe. `number` → px. Default 600. */
	size?: number | string;
	/** Backing-store pixel ratio. Default: device DPR capped at 2. */
	devicePixelRatio?: number;
	/** Horizontal alignment within the parent. Default "center". */
	align?: "left" | "center" | "right";
	/** Extra classes on the square wrapper. */
	className?: string;
	/** Override the default badge styling. */
	labelClassName?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/** Tiny classnames joiner (no dependency on `clsx`/`cn`). */
function cx(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(" ");
}

type RGB = [number, number, number];

/** Resolve any CSS colour (hex / rgb() / named / var(--token)) to cobe's 0–1 RGB.
 *  CSS custom properties are resolved against the live document, so design-token
 *  colours (e.g. `var(--primary)`) just work. */
function cssToRgb(color: string | undefined, fallback: RGB): RGB {
	const c = (color ?? "").trim();
	if (!c) return fallback;
	const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
	if (hex) {
		let h = hex[1];
		if (h.length === 3)
			h = h
				.split("")
				.map((ch) => ch + ch)
				.join("");
		const n = Number.parseInt(h, 16);
		return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
	}
	if (typeof document === "undefined") return fallback;
	// Resolve var()/named/oklch/… to a concrete computed colour string.
	const el = document.createElement("span");
	el.style.color = c;
	el.style.display = "none";
	document.body.appendChild(el);
	const resolved = getComputedStyle(el).color;
	el.remove();
	// Fast path: the computed value is already rgb()/rgba() (also handles the
	// space-separated `rgb(r g b / a)` form).
	const m = /rgba?\(([^)]+)\)/.exec(resolved);
	if (m) {
		const parts = m[1].split(/[\s,/]+/).map((p) => Number.parseFloat(p));
		if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n)))
			return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
	}
	// Robust fallback: rasterise the resolved colour on a 1×1 canvas and read back
	// the sRGB bytes. Covers colour spaces that getComputedStyle may serialise as
	// non-rgb() — notably the `oklch(…)` design tokens used by shadcn/tweakcn themes.
	try {
		const cv = document.createElement("canvas");
		cv.width = 1;
		cv.height = 1;
		const ctx = cv.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#000";
			ctx.fillStyle = resolved || c;
			ctx.fillRect(0, 0, 1, 1);
			const d = ctx.getImageData(0, 0, 1, 1).data;
			return [d[0] / 255, d[1] / 255, d[2] / 255];
		}
	} catch {
		/* getImageData can throw under a strict CSP / tainted canvas — fall through. */
	}
	return fallback;
}

// ── Marker projection (mirrors cobe's internal math) ──────────────────────────
// Used to anchor the HTML label badges to their markers. A square canvas is
// assumed (this component always renders the globe in an aspect-square box).

const DEG = Math.PI / 180;

/** lat/lng (degrees) → unit vector on the sphere (cobe's `U`). */
function latLngToVec3(lat: number, lng: number): RGB {
	const latR = lat * DEG;
	const lngR = lng * DEG - Math.PI;
	const cosLat = Math.cos(latR);
	return [-cosLat * Math.cos(lngR), Math.sin(latR), cosLat * Math.sin(lngR)];
}

function normalize(v: RGB): RGB {
	const m = Math.hypot(v[0], v[1], v[2]) || 1;
	return [v[0] / m, v[1] / m, v[2] / m];
}

/** Spherical interpolation between two unit vectors. */
function slerp(a: RGB, b: RGB, t: number): RGB {
	let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	dot = Math.max(-1, Math.min(1, dot));
	const omega = Math.acos(dot);
	if (omega < 1e-4) return a;
	const so = Math.sin(omega);
	const k0 = Math.sin((1 - t) * omega) / so;
	const k1 = Math.sin(t * omega) / so;
	return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}

const ARC_SAMPLES = 28;
/** Lifted great-circle points for an arc (static; projected each frame). */
function buildArcPoints(
	from: [number, number],
	to: [number, number],
	height: number,
): RGB[] {
	const a = latLngToVec3(from[0], from[1]);
	const b = latLngToVec3(to[0], to[1]);
	const pts: RGB[] = [];
	for (let i = 0; i < ARC_SAMPLES; i++) {
		const t = i / (ARC_SAMPLES - 1);
		const p = normalize(slerp(a, b, t));
		const r = 0.8 + height * Math.sin(Math.PI * t); // bulge toward the viewer
		pts.push([p[0] * r, p[1] * r, p[2] * r]);
	}
	return pts;
}

interface Projection {
	x: number; // 0..1 across the square canvas
	y: number; // 0..1 down the square canvas
	visible: boolean; // front hemisphere → badge shown
}
/** Project a sphere point with the globe's live phi/theta/scale/offset (cobe's `O`). */
function projectPoint(
	v: RGB,
	phi: number,
	theta: number,
	scale: number,
	offset: [number, number],
	cssSize: number,
): Projection {
	const cT = Math.cos(theta);
	const sT = Math.sin(theta);
	const cP = Math.cos(phi);
	const sP = Math.sin(phi);
	const c = cP * v[0] + sP * v[2];
	const s = sP * sT * v[0] + cT * v[1] - cP * sT * v[2];
	const z = -sP * cT * v[0] + sT * v[1] + cP * cT * v[2];
	// Square canvas → aspect 1; the dpr in cobe's offset term cancels, leaving
	// `offset * scale / cssSize`.
	const x = (c * scale + (offset[0] * scale) / cssSize + 1) / 2;
	const y = (-s * scale + (offset[1] * scale) / cssSize + 1) / 2;
	return { x, y, visible: z >= 0 || c * c + s * s >= 0.64 };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function Globe(props: GlobeProps) {
	const {
		markers = [],
		size = 600,
		align = "center",
		className,
		labelClassName,
		enableDrag = true,
	} = props;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const labelLayerRef = useRef<HTMLDivElement>(null);
	const arcLayerRef = useRef<SVGGElement>(null);
	const dragStart = useRef<number | null>(null);
	const dragDelta = useRef(0);

	const maxSize = typeof size === "number" ? `${size}px` : size;
	const labeled = markers.filter((m) => (m.label ?? "").trim().length > 0);
	const arcsList = props.arcs ?? [];
	const arcColorDefault = props.arcColor ?? "#3b82f6";

	// Live config the effect reads at (re)creation. Storing it in a ref lets the
	// effect depend only on `cfgKey` (a serialized snapshot) — no need to list every
	// prop in the dep array, and no eslint-disable. Updated synchronously each render.
	const live = useRef(props);
	live.current = props;

	// Re-create the globe only when a config-relevant prop actually changes.
	const cfgKey = JSON.stringify({
		markers,
		arcs: props.arcs,
		baseColor: props.baseColor,
		markerColor: props.markerColor,
		glowColor: props.glowColor,
		arcColor: props.arcColor,
		dark: props.dark,
		diffuse: props.diffuse,
		mapBrightness: props.mapBrightness,
		mapBaseBrightness: props.mapBaseBrightness,
		mapSamples: props.mapSamples,
		markerElevation: props.markerElevation,
		opacity: props.opacity,
		phi: props.phi,
		theta: props.theta,
		// scale/offset NO van aquí: se actualizan en vivo (zoom con rueda) sin
		// recrear el globo, para que sea suave.
		autoRotate: props.autoRotate,
		rotationSpeed: props.rotationSpeed,
		arcWidth: props.arcWidth,
		arcHeight: props.arcHeight,
		devicePixelRatio: props.devicePixelRatio,
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const c = live.current;

		// Defaults (kept here so the effect is the single source of truth).
		const markerColor = c.markerColor ?? "#e11d2f";
		const arcColor = c.arcColor ?? "#3b82f6";
		const theta = c.theta ?? 0.3;
		const scale = c.scale ?? 1;
		const offset = c.offset ?? [0, 0];
		const markerElevation = c.markerElevation ?? 0.05;
		const autoRotate = c.autoRotate ?? true;
		const rotationSpeed = c.rotationSpeed ?? 0.005;
		const initialPhi = c.phi ?? 0;
		const cMarkers = c.markers ?? [];
		const cArcs = c.arcs ?? [];
		const dpr =
			c.devicePixelRatio ??
			Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);

		const fallbackMarker = cssToRgb(markerColor, [1, 0.5, 0]);
		const fallbackArc = cssToRgb(arcColor, [0.3, 0.6, 1]);

		// Pre-compute elevated sphere vectors for labelled markers (static per cfg).
		const labelVecs = cMarkers
			.filter((m) => (m.label ?? "").trim().length > 0)
			.map((m) => {
				const v = latLngToVec3(m.location[0], m.location[1]);
				const r = 0.8 + markerElevation;
				return [v[0] * r, v[1] * r, v[2] * r] as RGB;
			});

		// Pre-compute lifted great-circle points per arc (static; projected each frame).
		const arcHeight = c.arcHeight ?? 0.3;
		const arcPointSets = cArcs.map((a) => buildArcPoints(a.from, a.to, arcHeight));

		let width = 0;
		let phi = initialPhi;
		let raf = 0;
		let globe: CobeGlobe | null = null;

		const positionLabels = (
			curPhi: number,
			curScale: number,
			curOffset: [number, number],
		) => {
			const layer = labelLayerRef.current;
			if (!layer || width <= 0) return;
			for (let i = 0; i < labelVecs.length; i++) {
				const el = layer.children[i] as HTMLElement | undefined;
				if (!el) continue;
				const p = projectPoint(labelVecs[i], curPhi, theta, curScale, curOffset, width);
				el.style.left = `${p.x * 100}%`;
				el.style.top = `${p.y * 100}%`;
				el.style.opacity = p.visible ? "1" : "0";
			}
		};

		// Draw the arcs as SVG paths + a travelling "comet" that loops along each arc.
		const updateArcs = (
			curPhi: number,
			now: number,
			curScale: number,
			curOffset: [number, number],
		) => {
			const layer = arcLayerRef.current;
			if (!layer || width <= 0) return;
			for (let i = 0; i < arcPointSets.length; i++) {
				const g = layer.children[i] as SVGGElement | undefined;
				if (!g) continue;
				const base = g.children[0] as SVGPathElement;
				const comet = g.children[1] as SVGPathElement;
				const head = g.children[2] as SVGCircleElement;

				const pts = arcPointSets[i].map((v) =>
					projectPoint(v, curPhi, theta, curScale, curOffset, width),
				);

				// Base line: connect consecutive visible points.
				let baseD = "";
				let pen = false;
				for (const p of pts) {
					if (p.visible) {
						baseD += `${pen ? "L" : "M"}${p.x.toFixed(4)} ${p.y.toFixed(4)} `;
						pen = true;
					} else pen = false;
				}
				base.setAttribute("d", baseD);

				// Travelling comet: a short bright window that loops 0→1.
				const headT = (now * 0.0004 + i * 0.137) % 1;
				const hi = Math.round(headT * (ARC_SAMPLES - 1));
				let cometD = "";
				pen = false;
				for (let j = Math.max(0, hi - 6); j <= hi; j++) {
					const p = pts[j];
					if (p && p.visible) {
						cometD += `${pen ? "L" : "M"}${p.x.toFixed(4)} ${p.y.toFixed(4)} `;
						pen = true;
					} else pen = false;
				}
				comet.setAttribute("d", cometD);

				const hp = pts[hi];
				if (hp && hp.visible) {
					head.setAttribute("cx", hp.x.toFixed(4));
					head.setAttribute("cy", hp.y.toFixed(4));
					head.style.opacity = "1";
				} else {
					head.style.opacity = "0";
				}
			}
		};

		// cobe initialises to a black blob at 0×0 if created before the canvas has a
		// real size — so gate creation on width, then resize via update().
		const tryCreate = () => {
			if (globe || width <= 0) return;
			const config: COBEOptions = {
				devicePixelRatio: dpr,
				// cobe multiplies width/height by devicePixelRatio internally for the
				// backing store, so pass the CSS px size here — NOT size * dpr.
				width,
				height: width,
				phi: initialPhi,
				theta,
				dark: c.dark ?? 0,
				diffuse: c.diffuse ?? 1.2,
				mapSamples: Math.round(c.mapSamples ?? 16000),
				mapBrightness: c.mapBrightness ?? 6,
				mapBaseBrightness: c.mapBaseBrightness ?? 0,
				baseColor: cssToRgb(c.baseColor ?? "#ffffff", [1, 1, 1]),
				markerColor: fallbackMarker,
				glowColor: cssToRgb(c.glowColor ?? "#ffffff", [1, 1, 1]),
				opacity: c.opacity ?? 1,
				scale,
				offset,
				markerElevation,
				markers: cMarkers.map((m) => ({
					location: m.location,
					size: m.size ?? 0.05,
					...(m.color ? { color: cssToRgb(m.color, fallbackMarker) } : {}),
				})),
				arcs: cArcs.map((a) => ({
					from: a.from,
					to: a.to,
					...(a.color ? { color: cssToRgb(a.color, fallbackArc) } : {}),
				})),
				arcColor: fallbackArc,
				arcWidth: c.arcWidth ?? 1,
				arcHeight: c.arcHeight ?? 0.3,
			};
			globe = createGlobe(canvas, config);
			// DOM-heavy work (labels + arcs) limitado a ~30fps para no atascar
			// el hilo principal; el globo WebGL sigue girando a tope.
			let lastDom = 0;
			const frame = () => {
				if (!globe) return;
				if (autoRotate && dragStart.current === null) phi += rotationSpeed;
				const curPhi = phi + dragDelta.current;
				// Zoom/offset EN VIVO desde los props (rueda del ratón): actualiza
				// el globo sin recrearlo → suave.
				const lc = live.current;
				const curScale = lc.scale ?? scale;
				const curOffset = lc.offset ?? offset;
				globe.update({ phi: curPhi, scale: curScale, offset: curOffset });
				const now = performance.now();
				if (now - lastDom >= 33) {
					positionLabels(curPhi, curScale, curOffset);
					updateArcs(curPhi, now, curScale, curOffset);
					lastDom = now;
				}
				raf = requestAnimationFrame(frame);
			};
			frame();
			requestAnimationFrame(() => {
				canvas.style.opacity = "1";
			});
		};

		const ro = new ResizeObserver(() => {
			const w = canvas.offsetWidth;
			if (w <= 0) return;
			width = w;
			if (globe) globe.update({ width, height: width });
			else tryCreate();
		});
		ro.observe(canvas);
		width = canvas.offsetWidth;
		tryCreate();

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			globe?.destroy();
		};
	}, [cfgKey]);

	const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (!enableDrag) return;
		dragStart.current = e.clientX;
		e.currentTarget.setPointerCapture(e.pointerId);
		e.currentTarget.style.cursor = "grabbing";
	};
	const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (dragStart.current === null) return;
		dragStart.current = null;
		if (e.currentTarget.hasPointerCapture(e.pointerId))
			e.currentTarget.releasePointerCapture(e.pointerId);
		e.currentTarget.style.cursor = enableDrag ? "grab" : "default";
	};
	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (dragStart.current === null) return;
		dragDelta.current += (e.clientX - dragStart.current) / 200;
		dragStart.current = e.clientX;
	};

	const justify =
		align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

	// When `size` is a number we render an EXACT square in px. Relying on
	// `aspect-square` inside a flex parent lets align-items:stretch deform the box
	// (the canvas turns oval). An explicit square width/height is bulletproof.
	const isNum = typeof size === "number";
	// Sin cap de ancho para size numérico: MeasuredGlobe lo dimensiona a propósito
	// más grande que el cuadro para que éste lo recorte limpio (globo "libre").
	const boxStyle = isNum
		? { width: size, height: size }
		: { maxWidth: maxSize };
	const boxClass = isNum ? "relative shrink-0" : "relative aspect-square w-full";

	return (
		<div className={cx("flex w-full items-center", justify)}>
			<div className={cx(boxClass, className)} style={boxStyle}>
				<canvas
					ref={canvasRef}
					className="size-full touch-none opacity-0 transition-opacity duration-500"
					style={{ cursor: enableDrag ? "grab" : "default" }}
					onPointerDown={onPointerDown}
					onPointerUp={onPointerEnd}
					onPointerCancel={onPointerEnd}
					onPointerMove={onPointerMove}
				/>
				{/* Arc layer — paths + travelling comets, updated by the rAF loop. */}
				<svg
					className="pointer-events-none absolute inset-0 size-full overflow-visible"
					viewBox="0 0 1 1"
					preserveAspectRatio="none"
				>
					<g ref={arcLayerRef}>
						{arcsList.map((a, i) => {
							const color = a.color ?? arcColorDefault;
							return (
								<g key={`${a.from[0]},${a.from[1]}-${a.to[0]},${a.to[1]}-${i}`}>
									<path
										fill="none"
										vectorEffect="non-scaling-stroke"
										strokeLinecap="round"
										style={{ stroke: color, strokeWidth: 1, opacity: 0.16 }}
									/>
									<path
										fill="none"
										vectorEffect="non-scaling-stroke"
										strokeLinecap="round"
										style={{ stroke: color, strokeWidth: 1.9 }}
									/>
									<circle r={0.013} style={{ fill: color }} />
								</g>
							);
						})}
					</g>
				</svg>
				{/* Label overlay — children are positioned by the rAF loop (index-aligned
				    with `labeled`). pointer-events-none so dragging passes through. */}
				<div ref={labelLayerRef} className="pointer-events-none absolute inset-0">
					{labeled.map((m, i) => (
						<div
							key={`${m.location[0]},${m.location[1]},${i}`}
							className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
							style={{ left: "50%", top: "50%", opacity: 0, transition: "opacity 150ms linear" }}
						>
							<div
								className={cx(
									"rounded-md bg-primary px-2 py-0.5 text-center font-semibold text-[11px] text-primary-foreground leading-tight shadow-md",
									labelClassName,
								)}
							>
								<span className="block whitespace-nowrap">{m.label}</span>
								{m.sublabel ? (
									<span className="block whitespace-nowrap font-normal text-[9px] opacity-80">
										{m.sublabel}
									</span>
								) : null}
							</div>
							<span className="h-2 w-px bg-primary/60" aria-hidden="true" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export default Globe;

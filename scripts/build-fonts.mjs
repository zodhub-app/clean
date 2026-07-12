// Descarga las fuentes de los temas de tweakcn como woff2 LOCALES (local-first:
// nunca se piden a Google en runtime) y genera src/fonts.css con sus @font-face.
// Ejecutar en una máquina con red:  node scripts/build-fonts.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS_DIR = resolve(ROOT, "public/fonts");

// [familia exacta (como en themes.css), slug de Fontsource]
// Solo familias NO del sistema (Georgia, Menlo, Courier New… ya están en macOS).
const FONTS = [
  ["Inter", "inter"],
  ["Plus Jakarta Sans", "plus-jakarta-sans"],
  ["Open Sans", "open-sans"],
  ["DM Sans", "dm-sans"],
  ["Montserrat", "montserrat"],
  ["Poppins", "poppins"],
  ["Geist", "geist"],
  ["Architects Daughter", "architects-daughter"],
  ["Antic", "antic"],
  ["Lora", "lora"],
  ["Merriweather", "merriweather"],
  ["Libre Baskerville", "libre-baskerville"],
  ["Source Serif 4", "source-serif-4"],
  ["JetBrains Mono", "jetbrains-mono"],
  ["Roboto Mono", "roboto-mono"],
  ["Fira Code", "fira-code"],
  ["IBM Plex Mono", "ibm-plex-mono"],
  ["Source Code Pro", "source-code-pro"],
  ["Geist Mono", "geist-mono"],
];

const vfUrl = (s) =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${s}:vf@latest/latin-wght-normal.woff2`;
const staticUrl = (s) =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${s}@latest/latin-400-normal.woff2`;

async function tryFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null; // descarta páginas de error
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(FONTS_DIR, { recursive: true });
  const faces = [
    "/* AUTO-GENERATED por scripts/build-fonts.mjs — fuentes locales (woff2). */",
    "",
  ];
  let ok = 0;

  for (const [family, slug] of FONTS) {
    process.stdout.write(`${family}... `);
    let buf = await tryFetch(vfUrl(slug));
    let weight = "100 900";
    if (!buf) {
      buf = await tryFetch(staticUrl(slug));
      weight = "400";
    }
    if (!buf) {
      console.log("OMITIDA (no encontrada)");
      continue;
    }
    await writeFile(resolve(FONTS_DIR, `${slug}.woff2`), buf);
    faces.push(
      `@font-face {`,
      `  font-family: "${family}";`,
      `  font-style: normal;`,
      `  font-weight: ${weight};`,
      `  font-display: swap;`,
      `  src: url("/fonts/${slug}.woff2") format("woff2");`,
      `}`,
      "",
    );
    ok++;
    console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  await writeFile(resolve(ROOT, "src/fonts.css"), faces.join("\n") + "\n");
  console.log(`\nGeneradas ${ok}/${FONTS.length} fuentes en public/fonts/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

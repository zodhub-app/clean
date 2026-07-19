#!/usr/bin/env python3
"""Genera la versión en inglés de la web a partir de la española.

Por qué así y no a mano: cada página ya lleva embebido su diccionario de
traducción (`var I18N = { en: {...} }`) con todas las cadenas indexadas por la
clave `data-i18n`. Ese diccionario es la ÚNICA fuente de verdad. Este script lo
lee y escribe las páginas de `en/` con el texto ya en inglés, de forma que:

  - nunca hay dos textos que actualizar a mano y que se desincronizan;
  - cada idioma tiene su propia URL, que es lo que necesitan los buscadores
    para indexar la versión inglesa (con el botón de idioma en JavaScript,
    Google solo veía la española);
  - se añaden las etiquetas `hreflang` recíprocas, que le dicen al buscador que
    ambas páginas son la misma en distinto idioma y cuál servir a cada usuario.

Uso:  python3 build-en.py        (desde la carpeta landing/)

Regenera `en/` por completo. Si tocas una traducción, hazlo en la página
española (dentro de su bloque I18N) y vuelve a ejecutar esto.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
OUT = ROOT / "en"
BASE = "https://zodhub-app.github.io/clean"

PAGES = ["index.html", "descargas.html", "donar.html", "privacidad.html", "terminos.html"]

# `<title>` y `<meta name="description">` no llevan clave `data-i18n`, así que
# van aquí. Son las dos cosas que se ven en los resultados de búsqueda, o sea
# que merecen estar escritas, no traducidas a máquina.
META = {
    "index.html": (
        "ZodHub CleanPC — honest maintenance for Mac and Windows",
        "ZodHub CleanPC: honest maintenance for Mac and Windows. Clear out caches, "
        "free up space, find duplicates and automate the boring parts. Local-first, "
        "no telemetry, 100% free.",
    ),
    "descargas.html": (
        "Download ZodHub CleanPC — Mac and Windows",
        "Download ZodHub CleanPC free and direct, no middlemen. Clear install guide "
        "for Mac (Apple Silicon and Intel) and Windows 10 and 11. Linux on the way.",
    ),
    "donar.html": (
        "Support ZodHub CleanPC — Donations",
        "Help keep ZodHub CleanPC free for everyone. Transparent, 100% optional "
        "donations. See exactly where every euro goes.",
    ),
    "privacidad.html": (
        "Privacy policy — ZodHub CleanPC",
        "What data ZodHub CleanPC handles and what it doesn't. The app runs locally, "
        "with no telemetry, and makes only two connections. Explained without small print.",
    ),
    "terminos.html": (
        "Terms and conditions of use — ZodHub CleanPC",
        "Terms of use for ZodHub CleanPC: what the app is and isn't, what each module "
        "does, your responsibility when deleting, licence, “as is” delivery and "
        "liability limits.",
    ),
}

# Sustituciones en crudo sobre el HTML de salida, para lo que no vive en un
# elemento con `data-i18n`: por ejemplo el texto que se precarga en el tuit de
# los botones de compartir, que va dentro del propio enlace. Sin esto, un lector
# inglés compartía la página con un texto en español.
RAW = {
    "ZodHub%20Clean%20%E2%80%94%20mantenimiento%20honesto%20para%20Mac%20y%20Windows%2C%20100%25%20gratis":
        "ZodHub%20CleanPC%20%E2%80%94%20honest%20maintenance%20for%20Mac%20and%20Windows%2C%20100%25%20free",
    "ZodHub%20Clean%20%E2%80%94%20mantenimiento%20honesto%20para%20Mac%2C%20100%25%20gratis":
        "ZodHub%20CleanPC%20%E2%80%94%20honest%20maintenance%20for%20Mac%2C%20100%25%20free",
}

TOGGLE_CLASSES = (
    "mono inline-flex items-center justify-center rounded-full px-3 py-2 text-[11px] "
    "text-slate-600 bg-white/78 border border-slate-200 shadow-[inset_0_1px_0_white] "
    "hover:text-blue-600 hover:-translate-y-0.5 transition-all"
)


def dictionary(page: Path) -> dict[str, str]:
    """Diccionario EN de la página, extraído con Node (evalúa el literal JS)."""
    out = subprocess.run(
        ["node", str(ROOT / "build-en.mjs"), str(page)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def hreflang(soup: BeautifulSoup, name: str) -> None:
    """Etiquetas recíprocas es/en + x-default apuntando al español."""
    for lang, href in (
        ("es", f"{BASE}/{name}"),
        ("en", f"{BASE}/en/{name}"),
        ("x-default", f"{BASE}/{name}"),
    ):
        tag = soup.new_tag("link", rel="alternate", href=href)
        tag["hreflang"] = lang
        soup.head.append(tag)


def swap_toggle(soup: BeautifulSoup, href: str, label: str, aria: str) -> None:
    """Convierte el botón de idioma en un ENLACE real a la otra versión.

    Con URLs propias por idioma, un botón que traduce en el sitio sobra y encima
    despista: el usuario cambia de idioma pero la dirección sigue siendo la
    misma, así que no puede compartirla ni guardarla. Un enlace normal se
    comparte, se abre en otra pestaña y lo siguen los buscadores.
    """
    btn = soup.find(id="langToggle")
    if not btn:
        return
    a = soup.new_tag("a", href=href)
    a["id"] = "langToggle"
    a["class"] = TOGGLE_CLASSES.split()
    a["aria-label"] = aria
    a["hreflang"] = "en" if label == "EN" else "es"
    a.string = label
    btn.replace_with(a)


def kill_listener(html: str) -> str:
    """Quita el manejador que traducía en el sitio (ahora el enlace navega)."""
    html = re.sub(
        r"\n\s*document\.getElementById\('langToggle'\)\.addEventListener\("
        r"'click',\s*function\(\)\{applyLang\([^\n]*\}\);",
        "",
        html,
    )
    # index.html usa un bloque multilínea con otro formato.
    html = re.sub(
        r"\n\s*document\.getElementById\('langToggle'\)\.addEventListener\('click',\s*"
        r"function \(\) \{\n[^}]*\}\);",
        "",
        html,
    )
    return html


def build_english(name: str) -> None:
    src = ROOT / name
    words = dictionary(src)
    soup = BeautifulSoup(src.read_text(encoding="utf-8"), "html.parser")

    soup.html["lang"] = "en"

    title, desc = META[name]
    if soup.title:
        soup.title.string = title
    meta = soup.find("meta", attrs={"name": "description"})
    if meta:
        meta["content"] = desc

    # Texto: se sustituye el contenido interno por la cadena inglesa. Se usa
    # HTML y no texto plano porque algunas traducciones llevan marcado (<strong>,
    # enlaces…), y las que no, se comportan igual.
    missing = []
    for el in soup.select("[data-i18n]"):
        key = el["data-i18n"]
        if key in words:
            el.clear()
            el.append(BeautifulSoup(words[key], "html.parser"))
        else:
            missing.append(key)
    for el in soup.select("[data-i18n-ph]"):
        key = el["data-i18n-ph"]
        if key in words:
            el["placeholder"] = words[key]
        else:
            missing.append(f"ph::{key}")

    if missing:
        raise SystemExit(f"{name}: faltan traducciones para {sorted(set(missing))}")

    hreflang(soup, name)
    swap_toggle(soup, f"../{name}", "ES", "Ver en español")

    out = kill_listener(str(soup))
    for es, en in RAW.items():
        out = out.replace(es, en)
    (OUT / name).write_text(out, encoding="utf-8")
    print(f"  en/{name}")


def annotate_spanish(name: str) -> None:
    """A la página española: hreflang + el botón EN pasa a ser un enlace."""
    src = ROOT / name
    soup = BeautifulSoup(src.read_text(encoding="utf-8"), "html.parser")

    if not soup.find("link", attrs={"hreflang": "es"}):
        hreflang(soup, name)
    swap_toggle(soup, f"en/{name}", "EN", "View in English")

    src.write_text(kill_listener(str(soup)), encoding="utf-8")
    print(f"  {name}")


if __name__ == "__main__":
    # Se sobrescribe en vez de borrar y recrear la carpeta: un script de build
    # no tiene por qué borrar nada del disco de nadie. Si algún día se retira
    # una página, se quita a mano.
    OUT.mkdir(exist_ok=True)

    print("Inglés:")
    for page in PAGES:
        build_english(page)
    print("Español (hreflang + enlace de idioma):")
    for page in PAGES:
        annotate_spanish(page)
    print("\nListo. Las traducciones se editan en el bloque I18N de las páginas")
    print("españolas; después, vuelve a ejecutar este script.")

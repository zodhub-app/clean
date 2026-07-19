// Extrae el diccionario de traducción EN embebido en una página de la web.
//
// Cada página lleva su propio `var I18N = { en: { ... } }` con las cadenas en
// inglés indexadas por la clave `data-i18n`. Ese diccionario es la ÚNICA fuente
// de verdad de la traducción: las páginas de /en/ se generan a partir de él con
// `build-en.py`, de modo que no hay dos textos que mantener sincronizados a
// mano. Si cambias una traducción, cámbiala en la página española y vuelve a
// generar.
//
// Uso:  node build-en.mjs <archivo.html>   → imprime el diccionario como JSON
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node build-en.mjs <archivo.html>");
  process.exit(1);
}

const html = readFileSync(file, "utf8");

// El literal va desde `var I18N` hasta el cierre `};` de su propia sentencia.
// Se busca el primer `{` y se avanza contando llaves, ignorando las que
// aparezcan dentro de cadenas: así no hace falta un parser de JS completo.
const start = html.indexOf("var I18N");
if (start < 0) {
  console.error(`No hay bloque I18N en ${file}`);
  process.exit(1);
}
const open = html.indexOf("{", start);

let depth = 0;
let inStr = null;
let escaped = false;
let end = -1;

for (let i = open; i < html.length; i++) {
  const c = html[i];
  if (inStr) {
    if (escaped) escaped = false;
    else if (c === "\\") escaped = true;
    else if (c === inStr) inStr = null;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") inStr = c;
  else if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}

if (end < 0) {
  console.error(`Bloque I18N mal cerrado en ${file}`);
  process.exit(1);
}

// Evaluar es seguro aquí: el contenido es nuestro, del propio repositorio.
const dict = new Function(`return ${html.slice(open, end)}`)();
process.stdout.write(JSON.stringify(dict.en ?? {}, null, 0));

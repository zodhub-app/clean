import type { Lang } from "@/components/language-provider";

/**
 * Muro de novedades de "Tu espacio" (pestaña Novedades). Bilingüe de forma
 * autocontenida (no pasa por el diccionario genérico de `language-provider`):
 * cada entrada nueva se añade aquí, en un solo sitio, con sus dos idiomas.
 *
 * Orden: más reciente primero. `npm run release` recuerda añadir una entrada
 * para la versión que se está publicando.
 */

type Localized = { es: string; en: string };

export type ChangelogEntry = {
  v: string;
  date: Localized;
  title: Localized;
  body: Localized;
  more?: Localized;
};

export function localize(text: Localized, lang: Lang): string {
  return lang === "en" ? text.en : text.es;
}

export const changelog: ChangelogEntry[] = [
  {
    v: "0.2.5",
    date: { es: "22 jul 2026", en: "22 Jul 2026" },
    title: {
      es: "Donaciones dentro de la app y «Tu espacio» reorganizado",
      en: "In-app donations and a reorganized “Your space”",
    },
    body: {
      es: "Ya puedes apoyar el proyecto pagando con tarjeta sin salir de la app, y «Tu espacio» se organiza en pestañas (Novedades, Suscripción, Apoyar) con un muro de novedades como este.",
      en: "You can now support the project by paying with a card without leaving the app, and “Your space” is organized into tabs (What's new, Subscribe, Support) with a news wall like this one.",
    },
    more: {
      es: "Además, cada pestaña recuerda sus datos y se abre al instante al volver (con auto-refresco opcional cada 24 h en Ajustes), la barra superior es más compacta y la app estrena el tema «Elegant Luxury» por defecto.",
      en: "Also, each tab remembers its data and opens instantly when you return (with optional 24 h auto-refresh in Settings), the top bar is more compact, and the app now ships with the “Elegant Luxury” theme by default.",
    },
  },
  {
    v: "0.2.4",
    date: { es: "21 jul 2026", en: "21 Jul 2026" },
    title: {
      es: "Aviso de disco lleno y vigilante en segundo plano",
      en: "Full-disk alert and background watcher",
    },
    body: {
      es: "Ahora la app vigila tu disco y te avisa —con una notificación del sistema— antes de que te quedes sin espacio, aunque la ventana esté cerrada en la barra.",
      en: "The app now watches your disk and warns you —with a system notification— before you run out of space, even when the window is hidden in the menu bar.",
    },
    more: {
      es: "Comprueba el espacio cada media hora y, si el disco suelta mucho de golpe, te lo explica: es «basura del sistema» que macOS acumula y libera sola, no la limpieza de la app. Así el número de Inicio y el del disco dejan de contradecirse.",
      en: "It checks space every half hour and, if the disk releases a lot at once, explains it: that's “system junk” macOS builds up and frees on its own, not the app's cleanup. So the Home number and the disk number stop contradicting each other.",
    },
  },
  {
    v: "0.2.3",
    date: { es: "19 jul 2026", en: "19 Jul 2026" },
    title: {
      es: "Mapa real de tu disco en Almacenamiento",
      en: "Real map of your disk in Storage",
    },
    body: {
      es: "El panel de Almacenamiento ya no muestra una lista de basura que no cuadraba: ahora ves dónde está de verdad tu espacio, con tus carpetas reales, y las barras suman el total usado.",
      en: "The Storage panel no longer shows a junk list that didn't add up: now you see where your space really is, with your real folders, and the bars add up to the total used.",
    },
    more: {
      es: "Mide tu carpeta de usuario como lo haría el sistema (Proyectos, Recursos, Library…), añade Aplicaciones y el resto del sistema, y lo ordena de mayor a menor. Para bajar al detalle carpeta a carpeta, tienes el Explorador.",
      en: "It measures your home folder the way the system would (Projects, Resources, Library…), adds Applications and the rest of the system, and sorts largest first. For folder-by-folder detail, use the Explorer.",
    },
  },
  {
    v: "0.2.2",
    date: { es: "19 jul 2026", en: "19 Jul 2026" },
    title: {
      es: "Limpieza con permisos de administrador",
      en: "Cleanup with admin permissions",
    },
    body: {
      es: "Añadido un botón que, con tu contraseña, vacía las cachés y logs del sistema (de root) que la limpieza normal no puede tocar, y te dice los GB reales que libera.",
      en: "Added a button that, with your password, empties the system caches and logs (owned by root) the normal cleanup can't touch, and tells you the real GB it frees.",
    },
  },
  {
    v: "0.2.1",
    date: { es: "19 jul 2026", en: "19 Jul 2026" },
    title: {
      es: "Limpieza más clara y honesta en Inicio",
      en: "Clearer, more honest cleanup on Home",
    },
    body: {
      es: "El estimado de «Liberar espacio» ahora enseña de qué se compone (cachés, npm, logs, Papelera…), así el número no aparece de la nada y cuadra con lo que de verdad se elimina.",
      en: "The “Free up space” estimate now shows what it's made of (caches, npm, logs, Trash…), so the number doesn't appear out of nowhere and matches what actually gets deleted.",
    },
  },
  {
    v: "0.2.0",
    date: { es: "19 jul 2026", en: "19 Jul 2026" },
    title: {
      es: "Buscador de duplicados por contenido",
      en: "Duplicate finder by content",
    },
    body: {
      es: "Encuentra archivos idénticos comparando su contenido real (huella SHA-256), no solo el nombre. Nunca borra nada: te muestra los grupos y decides tú.",
      en: "Finds identical files by comparing their real content (SHA-256 hash), not just the name. It never deletes anything: it shows you the groups and you decide.",
    },
    more: {
      es: "Primero agrupa por tamaño (rapidísimo) y solo calcula la huella de los candidatos. Distingue los clones de APFS y los enlaces duros, que comparten disco, para no prometerte un espacio recuperable que no existe.",
      en: "It first groups by size (very fast) and only hashes the candidates. It tells apart APFS clones and hard links, which share disk, so it won't promise reclaimable space that doesn't exist.",
    },
  },
  {
    v: "0.1.5",
    date: { es: "12 jul 2026", en: "12 Jul 2026" },
    title: {
      es: "Desinstalador de aplicaciones",
      en: "App uninstaller",
    },
    body: {
      es: "Lista tus apps con su peso y la basura que dejan (cachés, soportes, preferencias) y las desinstala del todo, sin restos olvidados por el sistema.",
      en: "Lists your apps with their size and the leftovers they leave (caches, support files, preferences) and uninstalls them completely, with no forgotten remnants.",
    },
  },
  {
    v: "0.1.4",
    date: { es: "12 jul 2026", en: "12 Jul 2026" },
    title: {
      es: "Instantáneas locales de Time Machine",
      en: "Local Time Machine snapshots",
    },
    body: {
      es: "Un panel para ver y liberar las copias locales que macOS guarda en tu disco aunque no tengas disco externo, y que suelen ocupar espacio «que aparece sin motivo».",
      en: "A panel to view and free the local copies macOS keeps on your disk even without an external drive, which often take up space that “appears for no reason”.",
    },
  },
  {
    v: "0.1.3",
    date: { es: "12 jul 2026", en: "12 Jul 2026" },
    title: {
      es: "Radar de red y monitor del sistema en vivo",
      en: "Live network radar and system monitor",
    },
    body: {
      es: "Inicio muestra CPU, memoria, disco y temperatura en tiempo real, más un radar de red honesto cuya intensidad usa la actividad real de tu equipo.",
      en: "Home shows CPU, memory, disk and temperature in real time, plus an honest network radar whose intensity uses your device's real activity.",
    },
  },
  {
    v: "0.1.2",
    date: { es: "12 jul 2026", en: "12 Jul 2026" },
    title: {
      es: "Explorador de archivos y carpetas grandes",
      en: "Large files and folders explorer",
    },
    body: {
      es: "Recorre cualquier carpeta y te enseña qué ocupa más, ordenado por tamaño, para encontrar de un vistazo lo que llena el disco. Puedes abrir en Finder o mover a la Papelera.",
      en: "Browse any folder and see what takes up most, sorted by size, to spot at a glance what's filling the disk. You can open in Finder or move to Trash.",
    },
  },
  {
    v: "0.1.0",
    date: { es: "12 jul 2026", en: "12 Jul 2026" },
    title: {
      es: "Limpieza de .DS_Store y «Comprimir limpio»",
      en: ".DS_Store cleanup and “Clean zip”",
    },
    body: {
      es: "Barre los .DS_Store que macOS esparce por tus carpetas y comprime en .zip sin metadatos ni __MACOSX, ideal para compartir con Windows o Linux.",
      en: "Sweeps the .DS_Store files macOS scatters across your folders and zips without metadata or __MACOSX, ideal for sharing with Windows or Linux.",
    },
    more: {
      es: "Puedes también evitar que se creen .DS_Store en unidades de red. Todo se hace en local, en tu equipo, sin enviar nada a ningún servidor.",
      en: "You can also stop .DS_Store from being created on network drives. Everything runs locally, on your device, sending nothing to any server.",
    },
  },
];

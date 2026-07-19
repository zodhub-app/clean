import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "es" | "en";

const LANG_KEY = "macup.lang";

/** Traducciones al inglés, indexadas por la cadena fuente en español. Si falta
 *  una clave, se devuelve el español tal cual (nunca queda vacío). */
const EN: Record<string, string> = {
  // ── Navegación / chrome ──────────────────────────────────────────────
  Inicio: "Home",
  Caché: "Cache",
  Memoria: "Memory",
  Tareas: "Tasks",
  Ajustes: "Settings",
  "Mantenimiento del Mac": "Mac maintenance",
  "Mantenimiento del equipo": "Device maintenance",
  "Tu equipo, ": "Your device, ",
  "Tu equipo, sencillamente limpio y seguro.":
    "Your device, simply clean and safe.",
  "Limpiar todo mi equipo": "Clean my whole device",
  "sin sensores en este equipo": "no sensors on this device",
  Novedades: "What's new",
  "Bienvenido a ZodHub CleanPC": "Welcome to ZodHub CleanPC",
  "Este espacio mostrará novedades y avisos nuestros, en tu idioma.":
    "This space will show our news and announcements, in your language.",
  "Saber más": "Learn more",
  "Modo claro": "Light mode",
  "Modo oscuro": "Dark mode",
  Español: "Spanish",
  Inglés: "English",
  Idioma: "Language",

  // ── Actualizaciones ──────────────────────────────────────────────────
  "Actualización disponible: {v}": "Update available: {v}",
  Actualizar: "Update",
  "Descargando actualización…": "Downloading update…",
  "Descargando… {p}%": "Downloading… {p}%",
  "Instalando…": "Installing…",
  "Actualización lista. Reiniciando…": "Update ready. Restarting…",
  "No se pudo actualizar": "Update failed",
  // ── Campana de notificaciones ────────────────────────────────────────
  Notificaciones: "Notifications",
  "Actualización disponible": "Update available",
  "Actualizar ahora": "Update now",
  "Descargando…": "Downloading…",
  "Buscar actualizaciones": "Check for updates",
  "Comprobando actualizaciones…": "Checking for updates…",
  "No se pudo comprobar": "Couldn't check for updates",
  Reintentar: "Retry",
  "Estás al día": "You're up to date",
  "Versión {v}": "Version {v}",
  "comprobado {t}": "checked {t}",

  // ── Hero / Acerca de ─────────────────────────────────────────────────
  "Tu Mac, ": "Your Mac, ",
  "sencillamente seguro": "simply safe",
  "sencillamente limpio y seguro": "simply clean and safe",
  "Tu Mac, sencillamente limpio y seguro.": "Your Mac, simply clean and safe.",
  "Limpiar todo mi Mac": "Clean my whole Mac",
  "Mantenimiento claro y en local — tus datos nunca salen de tu equipo.":
    "Clear, local maintenance — your data never leaves your computer.",
  "Sobre ZodHub CleanPC": "About ZodHub CleanPC",
  Cerrar: "Close",
  "Tu Mac, sencillamente seguro.": "Your Mac, simply safe.",
  "ZodHub CleanPC es una utilidad de mantenimiento para Mac directa y sin humo: limpia cachés, libera espacio, ordena los .DS_Store y automatiza el mantenimiento. Lo esencial, bien hecho.":
    "ZodHub CleanPC is a no-nonsense Mac maintenance utility: it clears caches, frees space, tidies .DS_Store files and automates maintenance. The essentials, done well.",
  "Sencillo de verdad": "Truly simple",
  "Solo las operaciones que tu Mac necesita para ir fino. Sin menús interminables ni funciones de relleno.":
    "Only the operations your Mac needs to run smoothly. No endless menus or filler features.",
  "Privado y en local": "Private and local",
  "Todo se ejecuta en tu equipo. Tus archivos y métricas nunca se suben a la nube. Cero telemetría por defecto.":
    "Everything runs on your computer. Your files and metrics are never uploaded to the cloud. Zero telemetry by default.",
  Transparente: "Transparent",
  "Te enseña qué va a hacer y con qué datos antes de tocar nada. Sin cajas negras: lo que ves es lo que pasa.":
    "It shows what it will do and with what data before touching anything. No black boxes: what you see is what happens.",
  "¿Por qué ZodHub CleanPC?": "Why ZodHub CleanPC?",
  "Ligera, clara y respetuosa con tus datos, frente a los limpiadores pesados llenos de avisos y suscripciones. Hace lo justo, y lo hace bien.":
    "Lightweight, clear and respectful of your data, unlike the heavy cleaners full of warnings and subscriptions. It does just enough, and does it well.",
  "Nota honesta: ZodHub CleanPC no es un antivirus ni un cortafuegos. El radar de red representa el ruido constante de escaneos de internet que recibe cualquier equipo conectado; su intensidad, en vivo, refleja la actividad real de tu red para mantenerte al tanto de lo que pasa de puertas afuera. · Versión 0.1.0":
    "Honest note: ZodHub CleanPC is not an antivirus or a firewall. The network radar represents the constant noise of internet scans any connected computer receives; its live intensity reflects your network's real activity to keep you aware of what's happening outside your door. · Version 0.1.0",

  // ── Dashboard ────────────────────────────────────────────────────────
  "Temperatura estable": "Stable temperature",
  "Temperatura alta": "High temperature",
  "Temperatura muy alta": "Very high temperature",
  "Temperatura crítica": "Critical temperature",
  "No se pudieron leer las métricas del sistema.":
    "Couldn't read system metrics.",
  Disco: "Disk",
  Temperatura: "Temperature",
  "uso global": "global usage",
  "{a} de {b}": "{a} of {b}",
  "sin sensores en este Mac": "no sensors on this Mac",

  // ── Monitor de red ───────────────────────────────────────────────────
  Red: "Network",
  "Paquetes recibidos": "Packets received",
  "Paquetes enviados": "Packets sent",
  "Recibidos/s": "Received/s",
  "Enviados/s": "Sent/s",
  Paquetes: "Packets",
  "Datos recibidos": "Data received",
  "Datos enviados": "Data sent",

  // ── Radar / globo ────────────────────────────────────────────────────
  "Radar de red": "Network radar",
  "Representación del ruido constante de escaneos de internet. La intensidad usa la actividad real de tu red.":
    "A representation of the constant noise of internet scans. The intensity uses your network's real activity.",
  "En vivo": "Live",
  "Tu Mac": "Your Mac",
  "Este equipo": "This computer",
  Tranquila: "Calm",
  Normal: "Normal",
  Elevada: "Elevated",
  Agresiva: "Aggressive",
  intensidad: "intensity",
  Descarga: "Download",
  Subida: "Upload",
  "{n} conexiones · {m} puertos a la escucha":
    "{n} connections · {m} listening ports",
  "actividad real de tu red": "your network's real activity",
  Ampliar: "Expand",
  "Ampliar globo": "Expand globe",
  Escaneo: "Scan",
  "Fuerza bruta": "Brute force",
  Troyano: "Trojan",
  // Ciudades
  Moscú: "Moscow",
  Pekín: "Beijing",
  "Nueva York": "New York",
  Teherán: "Tehran",
  Singapur: "Singapore",
  Kiev: "Kyiv",
  Lagos: "Lagos",
  "Ciudad de México": "Mexico City",
  "Nueva Delhi": "New Delhi",
  Sídney: "Sydney",
  Seúl: "Seoul",
  Berlín: "Berlin",
  Londres: "London",
  Tokio: "Tokyo",
  Estambul: "Istanbul",
  "El Cairo": "Cairo",
  Bangkok: "Bangkok",
  Yakarta: "Jakarta",
  "Hong Kong": "Hong Kong",
  Ámsterdam: "Amsterdam",
  Bucarest: "Bucharest",
  Karachi: "Karachi",
  Johannesburgo: "Johannesburg",
  Toronto: "Toronto",
  "Los Ángeles": "Los Angeles",
  Bogotá: "Bogotá",

  // ── Caché ────────────────────────────────────────────────────────────
  "No se pudo escanear la caché": "Couldn't scan the cache",
  "Liberados {n}": "Freed {n}",
  "{n} elementos eliminados": "{n} items removed",
  "{n} no se pudieron borrar": "{n} couldn't be deleted",
  "Error al limpiar": "Cleanup error",
  Escanear: "Scan",
  "Limpiar ({n})": "Clean ({n})",
  Seleccionado: "Selected",
  "{a} de {b} elementos": "{a} of {b} items",
  "escaneando…": "scanning…",
  "{n} en total": "{n} total",
  "Borrado permanente. Cierra las apps importantes antes; tras limpiar, su primer arranque puede ir algo más lento mientras regeneran la caché.":
    "Permanent deletion. Close important apps first; after cleaning, their first launch may be a bit slower while they rebuild the cache.",
  "Seleccionar todo": "Select all",
  "No se encontraron cachés que limpiar. ¡Todo despejado!":
    "No caches found to clean. All clear!",
  "Escaneando caché…": "Scanning cache…",
  "Liberando espacio…": "Freeing space…",
  "Vaciando {n}": "Emptying {n}",
  "¿Borrar las cachés elegidas?": "Delete the selected caches?",
  "Se eliminarán {count} elementos ({size}) de forma permanente. Las apps volverán a crear sus cachés cuando las uses.":
    "{count} items ({size}) will be permanently deleted. Apps will rebuild their caches as you use them.",
  Cancelar: "Cancel",
  Borrar: "Delete",

  // ── Memoria ──────────────────────────────────────────────────────────
  Media: "Medium",
  Alta: "High",
  "No liberable": "Non-reclaimable",
  "En uso": "In use",
  Automática: "Automatic",
  Reclamable: "Reclaimable",
  Wired: "Wired",
  "Memoria del núcleo y los drivers. Reside siempre en RAM; no se puede paginar ni liberar.":
    "Kernel and driver memory. Always resident in RAM; it can't be paged out or freed.",
  Activa: "Active",
  "Memoria que las apps abiertas están usando ahora mismo. No se libera mientras siga en uso.":
    "Memory the open apps are using right now. It isn't freed while still in use.",
  Comprimida: "Compressed",
  "Datos poco usados que macOS comprime dentro de la RAM para evitar ir al disco. Se gestiona solo.":
    "Rarely used data that macOS compresses inside RAM to avoid hitting the disk. It manages itself.",
  Inactiva: "Inactive",
  "Datos recientes que ya no se usan pero siguen en RAM por si vuelven a hacer falta. macOS los reclama al instante si hay presión.":
    "Recent data no longer in use but kept in RAM in case it's needed again. macOS reclaims it instantly under pressure.",
  "Caché de archivos": "File cache",
  "Archivos leídos del disco que macOS conserva para acelerar próximos accesos. Se descartan sin coste.":
    "Files read from disk that macOS keeps to speed up future access. Discarded at no cost.",
  "macOS gestiona la memoria automáticamente y muy bien. Liberar (purga) solo vacía cachés inactivas; rara vez hace falta y puede ralentizar brevemente las apps mientras recargan datos. Úsalo solo si notas el equipo atascado.":
    "macOS manages memory automatically and very well. Freeing (purge) only empties inactive caches; it's rarely needed and can briefly slow apps as they reload data. Use it only if you notice the computer bogging down.",
  "Memoria en uso": "Memory in use",
  "Presión {label}": "{label} pressure",
  "Aproximación: fracción de memoria no reclamable. No es la métrica exacta de presión de Apple.":
    "Approximation: fraction of non-reclaimable memory. Not Apple's exact pressure metric.",
  "Swap: {a} de {b}": "Swap: {a} of {b}",
  "Swap: sin uso": "Swap: unused",
  "Liberar memoria inactiva": "Free inactive memory",
  "Liberando memoria…": "Freeing memory…",
  "Vaciando cachés inactivas": "Emptying inactive caches",
  Desglose: "Breakdown",
  "Cargando…": "Loading…",
  "Liberados {n2}": "Freed {n2}",
  "Cachés inactivas vaciadas. El resto está en uso real.":
    "Inactive caches emptied. The rest is genuinely in use.",
  "Memoria ya optimizada": "Memory already optimized",
  "macOS apenas tenía cachés liberables en este momento.":
    "macOS had almost no reclaimable caches at this moment.",
  "No se pudo liberar la memoria": "Couldn't free memory",
  "¿Qué significa cada dato?": "What does each value mean?",
  "Cómo se mide": "How it's measured",
  "Datos reales de macOS vía vm_stat: páginas de cada tipo × el tamaño de página del Mac (16 KB en Apple Silicon).":
    "Real macOS data via vm_stat: pages of each type × the Mac's page size (16 KB on Apple Silicon).",
  "Qué hace «Liberar»": "What “Free” does",
  "Ejecuta purge (con permiso de admin): vacía la caché de archivos y las páginas reclamables. No toca lo que está en uso.":
    "Runs purge (with admin permission): empties the file cache and reclaimable pages. It doesn't touch what's in use.",
  "Por qué rara vez ayuda": "Why it rarely helps",
  "macOS ya libera memoria solo cuando hay presión, y vuelve a cachear enseguida. La memoria «Activa» nunca baja: está en uso.":
    "macOS already frees memory on its own under pressure, and re-caches right away. “Active” memory never drops: it's in use.",
  "Nota: estas categorías provienen de vm_stat y no suman exactamente el total de RAM, porque algunas se solapan (p. ej. la caché de archivos puede contarse también como activa o inactiva).":
    "Note: these categories come from vm_stat and don't add up exactly to total RAM, because some overlap (e.g. the file cache can also count as active or inactive).",

  // ── .DS_Store ────────────────────────────────────────────────────────
  "Comprimido limpio · {n} archivos": "Clean zip · {n} files",
  "{size}": "{size}",
  "{size} · {n} elementos basura omitidos": "{size} · {n} junk items skipped",
  "Error al comprimir": "Compression error",
  "{n} archivos .DS_Store eliminados": "{n} .DS_Store files removed",
  "Liberados {n3}": "Freed {n3}",
  "Ya estaba limpio": "Already clean",
  "Error en el barrido": "Sweep error",
  "No se crearán .DS_Store en unidades de red":
    "No .DS_Store will be created on network drives",
  "Comportamiento por defecto restaurado": "Default behavior restored",
  "No se pudo cambiar el ajuste": "Couldn't change the setting",
  "Comprimiendo…": "Compressing…",
  "Barriendo .DS_Store": "Sweeping .DS_Store",
  "Comprimir limpio": "Clean compress",
  "Arrastra una carpeta o archivos aquí": "Drag a folder or files here",
  "o haz clic para elegir una carpeta · zip sin .DS_Store, __MACOSX ni resource forks":
    "or click to choose a folder · zip without .DS_Store, __MACOSX or resource forks",
  "Elegir carpeta": "Choose folder",
  "Elegir archivos": "Choose files",
  "Próximamente: «Comprimir con ZodHub CleanPC» en el clic derecho de Finder (al empaquetar la app).":
    "Coming soon: “Compress with ZodHub CleanPC” in Finder's right-click menu (once the app is packaged).",
  "Barrido de .DS_Store": ".DS_Store sweep",
  "Elimina los archivos .DS_Store existentes en las carpetas que elijas (Finder los regenera al abrirlas).":
    "Removes existing .DS_Store files in the folders you choose (Finder recreates them when reopened).",
  "Elegir carpetas…": "Choose folders…",
  "Unidades de red": "Network drives",
  "No crear .DS_Store en unidades de red (ajuste oficial de macOS). Aplica al volver a montar la unidad.":
    "Don't create .DS_Store on network drives (official macOS setting). Applies when the drive is remounted.",

  // ── Tareas / scheduler ───────────────────────────────────────────────
  "Borra los .DS_Store de tu carpeta de inicio.":
    "Removes .DS_Store files from your home folder.",
  "Limpiar cachés": "Clean caches",
  "Vacía las cachés de usuario (las apps las regeneran).":
    "Empties user caches (apps rebuild them).",
  "Vaciar la papelera": "Empty the Trash",
  "Elimina definitivamente lo que haya en la papelera.":
    "Permanently deletes whatever is in the Trash.",
  Manual: "Manual",
  Diaria: "Daily",
  Semanal: "Weekly",
  Mensual: "Monthly",
  "Vaciando la papelera…": "Emptying the Trash…",
  "Barriendo .DS_Store…": "Sweeping .DS_Store…",
  "Eliminando definitivamente": "Permanently deleting",
  "Vaciando cachés de usuario": "Emptying user caches",
  "Recorriendo tu carpeta de inicio": "Scanning your home folder",
  "Papelera vaciada": "Trash emptied",
  "Cachés limpiadas": "Caches cleaned",
  ".DS_Store eliminados": ".DS_Store removed",
  "Las tareas programadas se ejecutan solas a las 03:00 con launchd, aunque ZodHub CleanPC esté cerrada. La purga de memoria no se programa porque requiere permiso de administrador.":
    "Scheduled tasks run on their own at 03:00 via launchd, even when ZodHub CleanPC is closed. Memory purge isn't schedulable because it requires admin permission.",
  "Ejecutar ahora": "Run now",
  "Programación desactivada": "Schedule disabled",
  "Programada: {cadence}": "Scheduled: {cadence}",
  "No se pudo programar": "Couldn't schedule",
  "Error al ejecutar": "Run error",

  // ── Ajustes ──────────────────────────────────────────────────────────
  Apariencia: "Appearance",
  "Claro, oscuro o el del sistema.": "Light, dark or system.",
  Claro: "Light",
  Oscuro: "Dark",
  Sistema: "System",
  "Tamaño de la interfaz": "Interface size",
  "Escala toda la app.": "Scales the whole app.",
  "Estilo de superficie": "Surface style",
  "Zeus: relieve 3D. Hera: diseño de cristal flotante.":
    "Zeus: 3D relief. Hera: floating glass design.",
  Plano: "Flat",
  Filigrana: "Filigree",
  "Scroll suave": "Smooth scroll",
  Fondo: "Background",
  "Para el estilo Plano.": "For the Flat style.",
  Liso: "Solid",
  Degradado: "Gradient",
  Aurora: "Aurora",
  "Material de las tarjetas": "Card material",
  "Sólido, cristal o cristal mate con grano.":
    "Solid, glass or matte glass with grain.",
  Sólido: "Solid",
  Cristal: "Glass",
  Mate: "Matte",
  Efectos: "Effects",
  "Desenfoque, grano y sombra.": "Blur, grain and shadow.",
  "Incluye Sidebar": "Include sidebar",
  Desenfoque: "Blur",
  Grano: "Grain",
  Sombra: "Shadow",
  Ninguna: "None",
  Suave: "Soft",
  Fuerte: "Strong",
  "Muy fuerte": "Very strong",
  "Tema de color": "Color theme",
  "ZodHub CleanPC 0.1.0 · mantenimiento sencillo y honesto.":
    "ZodHub CleanPC 0.1.0 · simple, honest maintenance.",
  "Barra de menús": "Menu bar",
  "Icono de acceso rápido de ZodHub CleanPC en la barra superior de macOS.":
    "ZodHub CleanPC quick-access icon in the macOS menu bar.",
  "Con el icono activo, cerrar la ventana deja ZodHub CleanPC en la barra de menús.":
    "With the icon on, closing the window keeps ZodHub CleanPC in the menu bar.",
  "Barra de menús: muestra el icono de ZodHub CleanPC en la barra superior de macOS para acceso rápido. Con él activo, cerrar la ventana deja ZodHub CleanPC en la barra.":
    "Menu bar: shows the ZodHub CleanPC icon in the macOS menu bar for quick access. With it on, closing the window keeps ZodHub CleanPC in the menu bar.",

  // ── Almacenamiento (Fase 0) ──────────────────────────────────────────
  Almacenamiento: "Storage",
  "Qué ocupa tu disco": "What's filling your disk",
  Usado: "Used",
  Analizar: "Analyze",
  "{a} usados de {b} · {c} libres": "{a} used of {b} · {c} free",
  "{n} instantáneas APFS locales (ocupan espacio recuperable).":
    "{n} local APFS snapshots (they hold reclaimable space).",
  "Volúmenes APFS": "APFS volumes",
  "Sin datos": "No data",
  "Qué ocupa más": "What takes up most",
  "Nada destacable por aquí.": "Nothing notable here.",
  "Cachés de usuario": "User caches",
  "Modelos HuggingFace": "HuggingFace models",
  "Modelos Ollama": "Ollama models",
  Descargas: "Downloads",
  Papelera: "Trash",
  Aplicaciones: "Applications",
  "Evolución del espacio usado": "Used space over time",
  "Solo lectura: aquí nada se borra. Los tamaños son reales (medidos en disco) y las áreas pueden solaparse, así que no suman el total. El histórico se va formando cada vez que abres esta pestaña.":
    "Read-only: nothing is deleted here. Sizes are real (measured on disk) and areas can overlap, so they don't add up to the total. The history builds up each time you open this tab.",

  // ── Explorador (Fase 1) ──────────────────────────────────────────────
  Explorador: "Explorer",
  "Archivos y carpetas grandes": "Large files and folders",
  Subir: "Up",
  "Analizando…": "Analyzing…",
  "No se pudo analizar la carpeta": "Couldn't analyze the folder",
  "Carpeta vacía o sin acceso.": "Empty folder or no access.",
  "Total: {s}": "Total: {s}",
  "Abrir en Finder": "Show in Finder",
  "Mover a la Papelera": "Move to Trash",
  "¿Mover a la Papelera?": "Move to Trash?",
  "«{name}» ({size}) se moverá a la Papelera. Podrás recuperarlo desde ahí.":
    "“{name}” ({size}) will be moved to the Trash. You can recover it from there.",
  "Movido a la Papelera · liberado {n}": "Moved to Trash · freed {n}",
  "No se pudo mover": "Couldn't move",

  // ── Duplicados (Fase 7) ──────────────────────────────────────────────
  Duplicados: "Duplicates",
  "Archivos repetidos por contenido": "Files repeated by content",
  "No se pudieron buscar duplicados": "Couldn't search for duplicates",
  "Debes conservar al menos una copia de cada grupo.":
    "You must keep at least one copy of each group.",
  "Movidos {n} a la Papelera": "Moved {n} to Trash",
  "{n} grupos · sobran {s} · marcados {m}":
    "{n} groups · {s} wasted · {m} marked",
  "Buscando duplicados…": "Finding duplicates…",
  "Sin duplicados en esta carpeta.": "No duplicates in this folder.",
  "{n} copias · {s} c/u · sobran {w}": "{n} copies · {s} each · {w} wasted",
  "Mover a la Papelera ({n})": "Move to Trash ({n})",
  "Moviendo…": "Moving…",
  "Se comparan por contenido exacto (SHA-256). Lo marcado se mueve a la Papelera (recuperable); siempre se conserva al menos una copia de cada grupo.":
    "Compared by exact content (SHA-256). What's marked is moved to the Trash (recoverable); at least one copy of each group is always kept.",

  // ── Desinstalador de apps ────────────────────────────────────────────
  "Desinstalar apps y sus restos": "Uninstall apps and their leftovers",
  "Analizando aplicaciones…": "Analyzing apps…",
  "{n} aplicaciones · {s}": "{n} apps · {s}",
  "Sin restos detectados": "No leftovers detected",
  Desinstalar: "Uninstall",
  "Desinstalando…": "Uninstalling…",
  "¿Desinstalar {name}?": "Uninstall {name}?",
  "Se moverán a la Papelera la app ({app}) y sus restos ({rest}) — en total {total}. Podrás recuperarlo desde la Papelera.":
    "The app ({app}) and its leftovers ({rest}) — {total} in total — will be moved to the Trash. You can recover it from there.",
  "Desinstalada · liberado {n}": "Uninstalled · freed {n}",
  "No se pudo desinstalar": "Couldn't uninstall",

  // ── Desarrollo (Fase 3) ──────────────────────────────────────────────
  Desarrollo: "Development",
  "Docker, Xcode, paquetes e IA": "Docker, Xcode, packages and AI",
  "Recuperable: {s}": "Reclaimable: {s}",
  "Nada que limpiar por aquí. ¡Todo despejado!":
    "Nothing to clean here. All clear!",
  Limpiar: "Clean",
  "No se pudo limpiar del todo": "Couldn't fully clean",
  "¿Limpiar «{label}»?": "Clean “{label}”?",
  "Se moverá a la Papelera ({size}). Es una caché regenerable; podrás recuperarla desde la Papelera hasta que la vacíes.":
    "It will be moved to the Trash ({size}). It's a regenerable cache; you can recover it from the Trash until you empty it.",
  "Ejecutará «docker system prune -af»: borra imágenes, contenedores parados y caché de build. NO toca los volúmenes, así que tus datos (p. ej. SurrealDB) están a salvo. Esto es permanente.":
    "It will run “docker system prune -af”: removes images, stopped containers and build cache. It does NOT touch volumes, so your data (e.g. SurrealDB) is safe. This is permanent.",
  "Soporte de dispositivos iOS": "iOS device support",
  "Cachés del Simulador": "Simulator caches",
  "Caché de npm": "npm cache",
  "Almacén de pnpm": "pnpm store",
  "Caché de Yarn": "Yarn cache",
  "Caché de pip": "pip cache",
  "Caché de Homebrew": "Homebrew cache",
  "Modelos LM Studio": "LM Studio models",
  "Docker · imágenes y caché de build": "Docker · images and build cache",
  "Liberar espacio": "Free up space",
  "Limpia toda la basura del disco": "Clean all disk junk",
  "Cachés del sistema y apps": "System & app caches",
  "Cachés de navegadores": "Browser caches",
  "Copias de seguridad de iOS": "iOS backups",
  "⚠️ Son tus copias de seguridad de iPhone/iPad ({size}). Se moverán a la Papelera (recuperables). Bórralas solo si no las necesitas.":
    "⚠️ These are your iPhone/iPad backups ({size}). They'll be moved to the Trash (recoverable). Delete them only if you don't need them.",
  "Registros (logs)": "Logs",
  "Limpiar todo": "Clean all",
  "¿Limpiar todo ({s})?": "Clean everything ({s})?",
  "Se eliminará permanentemente toda la basura de ficheros (cachés, logs, Xcode, modelos…) y se vaciará la Papelera para liberar espacio al instante. Es regenerable. Docker NO se toca aquí (usa su botón).":
    "All file junk (caches, logs, Xcode, models…) will be permanently deleted and the Trash emptied to free space instantly. It's regenerable. Docker is NOT touched here (use its button).",
  "Se vaciará la Papelera ({size}) de forma permanente.":
    "The Trash ({size}) will be emptied permanently.",
  "Se eliminará permanentemente ({size}) para liberar espacio ya. Es basura regenerable: se recrea cuando haga falta.":
    "It will be permanently deleted ({size}) to free space now. It's regenerable junk: it's recreated when needed.",
  "Basura regenerable lista para eliminar (estimado).":
    "Regenerable junk ready to delete (estimated).",
  "Liberar espacio ahora": "Free up space now",
  "Automático (semanal)": "Automatic (weekly)",
  "Limpieza automática activada (semanal)":
    "Automatic cleanup enabled (weekly)",
  "Limpieza automática desactivada": "Automatic cleanup disabled",
  "¿Liberar espacio ahora?": "Free up space now?",
  "Se eliminará permanentemente la basura regenerable (cachés, logs, Xcode, modelos de IA…) y se vaciará la Papelera para recuperar espacio al instante. Docker se limpia en su pestaña.":
    "Regenerable junk (caches, logs, Xcode, AI models…) will be permanently deleted and the Trash emptied to reclaim space instantly. Docker is cleaned from its own tab.",
  "Limpia cachés, logs, Xcode y vacía la Papelera (no toca modelos de IA ni Docker).":
    "Cleans caches, logs, Xcode and empties the Trash (doesn't touch AI models or Docker).",
  "Cachés, logs, Xcode y Papelera": "Caches, logs, Xcode and Trash",
  "Espacio liberado": "Space freed",

  // ── Instantáneas APFS (Fase 2) ───────────────────────────────────────
  Instantáneas: "Snapshots",
  "Copias locales de Time Machine": "Local Time Machine copies",
  "macOS guarda «copias locales» de Time Machine dentro de tu propio disco (aunque no tengas disco externo). Se acumulan solas y ocupan espacio que Utilidad de Discos cuenta como usado — suele ser el motivo de que el disco «se llene sin motivo». Son recuperables: al liberarlas, macOS recupera ese espacio. Tus copias en disco externo, si las tienes, no se tocan.":
    "macOS keeps “local copies” of Time Machine inside your own disk (even without an external drive). They pile up on their own and take space that Disk Utility counts as used — often the reason a disk “fills up for no reason”. They're reclaimable: freeing them gives that space back. Your external-drive backups, if any, aren't touched.",
  "{n} instantáneas locales": "{n} local snapshots",
  "Liberar todas": "Free all",
  "No hay instantáneas locales ahora mismo.": "No local snapshots right now.",
  "¿Liberar todas las instantáneas?": "Free all snapshots?",
  "macOS pedirá tu contraseña de administrador y eliminará las copias locales de Time Machine para recuperar espacio. Tus copias en disco externo (si las tienes) no se tocan.":
    "macOS will ask for your admin password and remove the local Time Machine copies to reclaim space. Your external-drive backups (if any) aren't touched.",
  "Liberando instantáneas…": "Freeing snapshots…",
  "Liberado {n} en instantáneas": "Freed {n} in snapshots",
  "Instantáneas liberadas": "Snapshots freed",
  "El espacio puede tardar unos segundos en reflejarse.":
    "The space may take a few seconds to show up.",
  "No se pudieron liberar": "Couldn't free them",
  "Nota: macOS no expone el tamaño exacto de cada instantánea; al liberarlas verás cuánto espacio se recupera. Se pedirá tu contraseña de administrador.":
    "Note: macOS doesn't expose the exact size of each snapshot; when you free them you'll see how much space is reclaimed. Your admin password will be requested.",
};

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (es: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(LANG_KEY) as Lang) || "es",
  );

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const value = useMemo<Ctx>(() => {
    const set = (l: Lang) => {
      setLangState(l);
      localStorage.setItem(LANG_KEY, l);
    };
    return {
      lang,
      setLang: set,
      toggle: () => set(lang === "es" ? "en" : "es"),
      t: (es, vars) =>
        interpolate(lang === "en" ? EN[es] ?? es : es, vars),
    };
  }, [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

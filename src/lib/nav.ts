import {
  LayoutDashboard,
  Sparkles,
  HardDrive,
  Camera,
  FolderSearch,
  CopyCheck,
  AppWindow,
  Cpu,
  FileArchive,
  CalendarClock,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type ViewId =
  | "dashboard"
  | "storage"
  | "snapshots"
  | "explorer"
  | "duplicates"
  | "apps"
  | "dev"
  | "cache"
  | "memory"
  | "dsstore"
  | "scheduler"
  | "settings"
  | "account";

export type NavItem = {
  id: ViewId;
  title: string;
  description: string;
  icon: LucideIcon;
  /**
   * Sistemas donde la sección tiene sentido. Si falta, vale para todos.
   * Las secciones que no aplican se ocultan en vez de enseñarse vacías.
   */
  os?: Array<"macos" | "windows" | "linux">;
  /** No aparece en la barra lateral (se accede desde la barra superior). */
  hideInSidebar?: boolean;
};

/** Navegación filtrada para el sistema actual. */
export function navFor(os: string): NavItem[] {
  // Mientras no se sepa el SO (arranque), se muestra todo para no parpadear.
  if (os !== "macos" && os !== "windows" && os !== "linux") return NAV_ITEMS;
  return NAV_ITEMS.filter(
    (i) => !i.os || i.os.includes(os as "macos" | "windows" | "linux"),
  );
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    title: "Inicio",
    description: "Estado de tu equipo en vivo",
    icon: LayoutDashboard,
  },
  {
    id: "dev",
    title: "Liberar espacio",
    description: "Limpia toda la basura del disco",
    icon: Sparkles,
  },
  {
    id: "storage",
    title: "Almacenamiento",
    description: "Qué ocupa tu disco",
    icon: HardDrive,
  },
  {
    id: "explorer",
    title: "Explorador",
    description: "Archivos y carpetas grandes",
    icon: FolderSearch,
  },
  {
    id: "duplicates",
    title: "Duplicados",
    description: "Archivos repetidos por contenido",
    icon: CopyCheck,
  },
  {
    id: "apps",
    title: "Aplicaciones",
    description: "Desinstalar apps y sus restos",
    icon: AppWindow,
  },
  {
    id: "snapshots",
    title: "Instantáneas",
    description: "Copias locales de Time Machine",
    icon: Camera,
    os: ["macos"], // APFS/Time Machine: concepto exclusivo de macOS
  },
  {
    id: "memory",
    title: "Memoria",
    description: "Presión y purga de RAM",
    icon: Cpu,
  },
  {
    id: "dsstore",
    title: ".DS_Store",
    description: "Comprimir limpio y barrido",
    icon: FileArchive,
    os: ["macos"], // los .DS_Store los crea el Finder de macOS
  },
  {
    id: "scheduler",
    title: "Tareas",
    description: "Automatiza el mantenimiento",
    icon: CalendarClock,
  },
  {
    id: "settings",
    title: "Ajustes",
    description: "Tema y preferencias",
    icon: Settings,
  },
  {
    id: "account",
    title: "Tu espacio",
    description: "Novedades, apoyo y legal",
    icon: UserRound,
    hideInSidebar: true, // se abre desde el botón de la barra superior
  },
];

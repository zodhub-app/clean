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
  | "settings";

export type NavItem = {
  id: ViewId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    title: "Inicio",
    description: "Estado de tu Mac en vivo",
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
];

import { invoke } from "@tauri-apps/api/core";

export type SystemStats = {
  cpu_usage: number; // 0..100 (global average)
  mem_used: number; // bytes
  mem_total: number;
  swap_used: number;
  swap_total: number;
  disk_used: number;
  disk_total: number;
  uptime_secs: number;
  temp: number | null; // °C del sensor más caliente, o null si no hay sensores
  host_name: string;
};

export function getSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("system_stats");
}

export type SensorInfo = { label: string; temp: number };

export function getSensors(): Promise<SensorInfo[]> {
  return invoke<SensorInfo[]>("list_sensors");
}

export type CacheEntry = {
  id: string;
  name: string;
  path: string;
  size: number; // bytes
  location: string;
};

export type CleanResult = {
  freed: number; // bytes
  removed: number;
  errors: string[];
};

export function scanCaches(): Promise<CacheEntry[]> {
  return invoke<CacheEntry[]>("scan_caches");
}

export function cleanCaches(paths: string[]): Promise<CleanResult> {
  return invoke<CleanResult>("clean_caches", { paths });
}

export type NetworkStats = {
  rx_total: number; // cumulative bytes
  tx_total: number;
  pkt_rx_total: number; // cumulative packets
  pkt_tx_total: number;
  established: number;
  listening: number;
};

export function getNetworkStats(): Promise<NetworkStats> {
  return invoke<NetworkStats>("network_stats");
}

export type ProcInfo = {
  pid: number;
  name: string;
  cpu: number; // % of total machine
  mem: number; // bytes
};

export type TopProcesses = {
  by_cpu: ProcInfo[];
  by_mem: ProcInfo[];
  total: number;
};

export function getTopProcesses(): Promise<TopProcesses> {
  return invoke<TopProcesses>("top_processes");
}

export type MemoryStats = {
  total: number;
  used: number;
  available: number;
  free: number;
  swap_used: number;
  swap_total: number;
  wired: number;
  active: number;
  inactive: number;
  compressed: number;
  cached: number;
};

export function getMemoryStats(): Promise<MemoryStats> {
  return invoke<MemoryStats>("memory_stats");
}

export function purgeMemory(): Promise<void> {
  return invoke<void>("purge_memory");
}

export type CompressResult = {
  entries: number;
  skipped: number;
  size: number;
  dest: string;
};

export function cleanZip(paths: string[], dest: string): Promise<CompressResult> {
  return invoke<CompressResult>("clean_zip", { paths, dest });
}

export type SweepResult = {
  removed: number;
  freed: number;
  errors: string[];
};

export function sweepDsStore(roots: string[]): Promise<SweepResult> {
  return invoke<SweepResult>("sweep_ds_store", { roots });
}

export function getNetworkStoresDisabled(): Promise<boolean> {
  return invoke<boolean>("get_network_stores_disabled");
}

export function setNetworkStoresDisabled(disabled: boolean): Promise<void> {
  return invoke<void>("set_network_stores_disabled", { disabled });
}

export type Cadence = "manual" | "daily" | "weekly" | "monthly";
export type ScheduleInfo = { task: string; cadence: Cadence };

export function listSchedules(): Promise<ScheduleInfo[]> {
  return invoke<ScheduleInfo[]>("list_schedules");
}

export function setSchedule(task: string, cadence: Cadence): Promise<void> {
  return invoke<void>("set_schedule", { task, cadence });
}

export function runTaskNow(task: string): Promise<void> {
  return invoke<void>("run_task_now", { task });
}

/** Panel de almacenamiento (Fase 0, solo lectura). */
export type VolumeInfo = { name: string; role: string; consumed: number };
export type AreaInfo = {
  key: string;
  path: string;
  size: number;
  exists: boolean;
};
export type StorageStats = {
  total: number;
  used: number;
  free: number;
  snapshots: number;
  volumes: VolumeInfo[];
  areas: AreaInfo[];
};
export type StorageSample = {
  t: number;
  total: number;
  used: number;
  free: number;
};

export function getStorageStats(): Promise<StorageStats> {
  return invoke<StorageStats>("storage_stats");
}
export function getStorageHistory(): Promise<StorageSample[]> {
  return invoke<StorageSample[]>("storage_history");
}

/** Explorador de archivos/carpetas grandes (Fase 1, solo lectura). */
export type ScanEntry = {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
};
export type ScanResult = {
  path: string;
  parent: string | null;
  total: number;
  entries: ScanEntry[];
};

export type TrashResult = { moved: number; freed: number; errors: string[] };

export function scanDir(path: string): Promise<ScanResult> {
  return invoke<ScanResult>("scan_dir", { path });
}
export function revealInFinder(path: string): Promise<void> {
  return invoke<void>("reveal_in_finder", { path });
}
export function moveToTrash(paths: string[]): Promise<TrashResult> {
  return invoke<TrashResult>("move_to_trash", { paths });
}

/** Desinstalador de aplicaciones. */
export type AppInfo = {
  name: string;
  path: string;
  size: number;
  bundle_id: string;
};
export type Leftover = { path: string; size: number };
export type LeftoverResult = { total: number; items: Leftover[] };

export function listApps(): Promise<AppInfo[]> {
  return invoke<AppInfo[]>("list_apps");
}
export function appLeftovers(
  bundleId: string,
  name: string,
): Promise<LeftoverResult> {
  return invoke<LeftoverResult>("app_leftovers", { bundleId, name });
}
/** Sistema operativo actual: "macos" | "windows" | "linux". */
export function osName(): Promise<string> {
  return invoke<string>("os_name");
}

export function uninstallApp(
  appPath: string,
  leftovers: string[],
  /** Windows: comando de desinstalación oficial (viene en `bundle_id`). */
  uninstaller?: string,
): Promise<TrashResult> {
  return invoke<TrashResult>("uninstall_app", {
    appPath,
    leftovers,
    uninstaller,
  });
}

/** Liberar espacio — basura del sistema, dev, IA, Docker y Papelera. */
export type DevItem = {
  key: string;
  kind: "file" | "docker" | "trash" | "backup";
  size: number;
  paths: string[];
};
export type DevCleanResult = { freed: number; errors: string[] };

export function listDevJunk(): Promise<DevItem[]> {
  return invoke<DevItem[]>("list_dev_junk");
}
export function cleanDev(key: string): Promise<DevCleanResult> {
  return invoke<DevCleanResult>("clean_dev", { key });
}
export function cleanAllJunk(): Promise<DevCleanResult> {
  return invoke<DevCleanResult>("clean_all_junk");
}

/** Fase 2 — instantáneas APFS / Time Machine locales. */
export type Snapshot = { name: string; date: string };
export type ThinResult = {
  freed: number;
  count_before: number;
  count_after: number;
};

export function listSnapshots(): Promise<Snapshot[]> {
  return invoke<Snapshot[]>("list_snapshots");
}
export function thinSnapshots(): Promise<ThinResult> {
  return invoke<ThinResult>("thin_snapshots");
}

/** Fase 7 — buscador de duplicados por contenido. */
export type DupGroup = {
  size: number;
  count: number;
  wasted: number;
  files: string[];
};

export function findDuplicates(path: string): Promise<DupGroup[]> {
  return invoke<DupGroup[]>("find_duplicates", { path });
}

/** Icono de ZodHub CleanPC en la barra de menús de macOS. */
export function getTrayVisible(): Promise<boolean> {
  return invoke<boolean>("get_tray_visible");
}

export function setTrayVisible(visible: boolean): Promise<void> {
  return invoke<void>("set_tray_visible", { visible });
}

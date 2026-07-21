# ZodHub Pulse — Roadmap multiplataforma (macOS · Windows · Linux)

Plan por fases para llevar la app —hoy 100% macOS— a Windows y Linux
**manteniendo un solo proyecto**: un frontend compartido (React/TS, portable tal
cual) y un backend Rust con **ramas por sistema operativo** vía
`#[cfg(target_os = "...")]`. La regla de oro no cambia: **toda la lógica real va
en Rust** como `#[tauri::command]`; el frontend solo hace UI, estado y formato.

> Estado de partida (2026-07-12): app funcional y universal en macOS. Backend
> Rust apoyado íntegramente en binarios de macOS (`vm_stat`, `tmutil`,
> `diskutil`, `osascript`, `launchctl`, `purge`, `du`, `netstat`, `defaults`,
> APFS, Finder…). El frontend es portable; el backend **no**.

---

## 1. Principio de arquitectura: un proyecto, backend con ramas por SO

La firma de cada comando Tauri (nombre, parámetros, structs de retorno) es el
**contrato estable** que ve el frontend. Ese contrato NO cambia entre sistemas;
lo que cambia es la **implementación** debajo. Patrón recomendado por módulo:

```
src-tauri/src/
  storage/
    mod.rs        // #[tauri::command] pub fn storage_stats(...) -> StorageStats
                  //   → delega en el backend del SO actual
    macos.rs      // #[cfg(target_os = "macos")]
    windows.rs    // #[cfg(target_os = "windows")]
    linux.rs      // #[cfg(target_os = "linux")]
    types.rs      // structs compartidos (serde) — idénticos en los 3
```

Reglas:

- El **struct de retorno es común** a los tres SO. Si un dato no existe en una
  plataforma, se devuelve `None`/`—` (principio de honestidad), nunca un valor
  inventado.
- Cada `mod.rs` selecciona la implementación con `#[cfg(target_os = ...)]`. Un
  `#[cfg(not(any(target_os="macos",target_os="windows",target_os="linux")))]`
  como fallback devuelve error o `unimplemented` claro.
- Preferir **crates multiplataforma** (una sola implementación) a shelling-out
  a binarios del SO siempre que sea posible: menos ramas, menos frágil, más
  rápido, y no depende de que un binario exista. Solo se baja a comandos nativos
  cuando el crate no cubre el caso.

### Crates que borran ramas (recomendados)

| Necesidad | Crate multiplataforma | Sustituye a |
|---|---|---|
| CPU, RAM, procesos, discos, temperatura | **`sysinfo`** | `vm_stat`, `top`, `df` parcial |
| Espacio por volumen | **`sysinfo`** Disks | `df`, `diskutil` |
| Enviar a la Papelera / Reciclaje | **`trash`** | `osascript`/Finder |
| Recorrer disco sin seguir symlinks | **`walkdir`** / `jwalk` | recorrido manual |
| Hash de duplicados | **`sha2`** / `blake3` | `shasum` |
| Abrir carpeta en el explorador del SO | **`opener`** (ya se usa el plugin) | `open` |
| Icono en bandeja + menú | **API nativa de Tauri 2** (`tray`) | ya es portable |

`sysinfo` y `trash` por sí solos convierten en portables varios módulos hoy
específicos de macOS.

---

## 2. Inventario de módulos Rust y su equivalente por SO

Trece módulos actuales. Para cada uno: qué hace, qué invoca hoy en macOS, y su
equivalente en Windows y Linux. Columna **Portabilidad**: 🟢 portable casi tal
cual (crate) · 🟡 requiere rama por SO pero con crate/API estándar · 🔴 hay que
reimplementar de cero por sistema.

### `system` — telemetría (CPU, memoria, procesos, sensores)
Comandos: `system_stats`, `list_sensors`, `top_processes`.
- **macOS hoy:** `vm_stat`, `sysinfo`, sensores de CPU.
- **Windows:** `sysinfo` cubre CPU/RAM/procesos. Temperatura: WMI
  `MSAcpi_ThermalZoneTemperature` / LibreHardwareMonitor (a menudo requiere
  admin; si no hay dato → `—`).
- **Linux:** `sysinfo` + `/proc/stat`, `/proc/meminfo`. Temperatura vía
  `/sys/class/hwmon/*`.
- **Portabilidad:** 🟡 (el grueso 🟢 con `sysinfo`; solo sensores necesitan rama).

### `storage` — desglose de almacenamiento + histórico
Comandos: `storage_stats`, `storage_history`.
- **macOS hoy:** `diskutil apfs list`, `df`, `du`, categorías APFS
  (Sistema/Datos/VM/Preboot/snapshots).
- **Windows:** `sysinfo` Disks para tamaño/libre; `GetDiskFreeSpaceEx`. NTFS no
  tiene el concepto de contenedor APFS; las categorías se recalculan (Sistema,
  Usuario, Windows.old, Reciclaje, Archivos temporales) vía rutas conocidas y
  Storage Sense (`cleanmgr`/API de Storage).
- **Linux:** `statvfs` / `sysinfo`; `/proc/mounts`; categorías por punto de
  montaje y por rutas XDG. Sin equivalente a snapshots APFS salvo Btrfs/LVM.
- **Portabilidad:** 🟡 (tamaños/libre 🟢; el desglose por categorías es
  específico de cada SO y hay que remodelarlo).

### `scanner` — explorador de archivos/carpetas grandes + Papelera + revelar
Comandos: `scan_dir`, `reveal_in_finder`, `move_to_trash`.
- **macOS hoy:** `walkdir`-style + `open -R` (revelar) + Papelera vía Finder.
- **Windows:** `walkdir` igual; revelar con `explorer /select,<ruta>`; Papelera
  con crate `trash`.
- **Linux:** `walkdir` igual; revelar con `xdg-open` a la carpeta contenedora (o
  `dbus` FileManager1 para seleccionar); Papelera con `trash` (spec
  freedesktop `~/.local/share/Trash`).
- **Portabilidad:** 🟢 el escaneo (walkdir); 🟡 revelar y Papelera (crate
  `trash` + rama para "revelar"). Renombrar `reveal_in_finder` →
  `reveal_in_file_manager` en el contrato.

### `snapshots` — instantáneas locales APFS/Time Machine
Comandos: `list_snapshots`, `thin_snapshots`.
- **macOS hoy:** `tmutil listlocalsnapshots` / `thinlocalsnapshots`.
- **Windows:** concepto análogo = **Volume Shadow Copies** (VSS): `vssadmin list
  shadows` / `Get-ComputerRestorePoint` (PowerShell); recuperar espacio con
  `vssadmin resize shadowstorage`. Requiere admin.
- **Linux:** no hay equivalente universal. Solo aplica en **Btrfs** (`btrfs
  subvolume list/delete`), **ZFS** (`zfs list -t snapshot`) o **Timeshift/LVM**.
  Si el FS no lo soporta → módulo oculto/`—`.
- **Portabilidad:** 🔴 reimplementación total por SO; en Linux, **capacidad
  condicional** (detectar FS antes de mostrar la función).

### `apps` — listar apps instaladas, restos y desinstalar
Comandos: `list_apps`, `app_leftovers`, `uninstall_app`.
- **macOS hoy:** `/Applications` + bundles `.app`; restos en `~/Library`.
- **Windows:** inventario por **registro**
  (`HKLM/HKCU\...\Uninstall`) + paquetes MSIX/Store (`Get-AppxPackage`).
  Desinstalar = lanzar el `UninstallString` / `msiexec /x`. Restos en
  `%AppData%`, `%LocalAppData%`, `%ProgramData%`.
- **Linux:** gestor de paquetes: `dpkg -l`/`apt`, `rpm -qa`/`dnf`, `flatpak
  list`, `snap list`. Desinstalar delega en el gestor (con permiso). "Restos" =
  configs en `~/.config`, `~/.cache`, `~/.local/share`.
- **Portabilidad:** 🔴 lógica muy distinta por SO (registro vs. gestor de
  paquetes vs. bundles). Contrato común, tres implementaciones.

### `devclean` — cachés de desarrollo (Docker, Node, Xcode, IA, gestores)
Comandos: `list_dev_junk`, `clean_dev`, `clean_all_junk`.
- **macOS hoy:** `docker system df/prune`, `ollama`, DerivedData de Xcode,
  `node_modules`, cachés npm/yarn/pnpm/pip/brew.
- **Windows:** Docker igual (CLI portable). Xcode no existe → se quita. Node/
  npm/yarn/pnpm/pip **portables** (mismas cachés, rutas en `%AppData%`/
  `%LocalAppData%`). Añadir: caché de NuGet, Visual Studio, Gradle. `ollama`
  portable.
- **Linux:** Docker/Podman, Node/pip/etc. en rutas XDG (`~/.cache`). Añadir:
  caché de `apt`/`dnf`, Gradle, Maven. `ollama` portable.
- **Portabilidad:** 🟡 buena parte **portable** (Docker CLI, herramientas de dev
  cross-platform); cambian las **rutas de caché** y se quita/añade lo específico
  (Xcode fuera; NuGet/apt dentro). La detección "¿existe esta herramienta?" ya
  es la abstracción natural.

### `memory` — estadísticas y purga de RAM
Comandos: `memory_stats`, `purge_memory`.
- **macOS hoy:** `vm_stat` + `purge`.
- **Windows:** `sysinfo` para stats. "Purgar" = `EmptyWorkingSet` /
  `SetProcessWorkingSetSize` (API Win32) o vaciar standby list (requiere admin;
  utilidad limitada). Marcar como aproximación.
- **Linux:** `/proc/meminfo`. "Purgar" = `echo 1|2|3 >
  /proc/sys/vm/drop_caches` (necesita root; efecto discutible). Marcar como
  aproximación honesta o **ocultar la purga** si no aporta.
- **Portabilidad:** 🟡 stats 🟢 con `sysinfo`; la "purga" es específica y de
  dudoso valor fuera de macOS → tratarla con honestidad o retirarla por SO.

### `network` — throughput y estadísticas de red
Comando: `network_stats`.
- **macOS hoy:** `netstat`.
- **Windows:** `sysinfo` Networks (bytes rx/tx) o IpHelper API (`GetIfTable`).
- **Linux:** `sysinfo` Networks o `/proc/net/dev`.
- **Portabilidad:** 🟢 `sysinfo` da contadores de red en los tres SO; una sola
  implementación probable.

### `scheduler` — mantenimiento programado
Comandos: `list_schedules`, `set_schedule`, `run_task_now`.
- **macOS hoy:** LaunchAgents vía `launchctl` (plist en `~/Library/
  LaunchAgents`).
- **Windows:** **Programador de tareas** (`schtasks` o COM Task Scheduler /
  PowerShell `Register-ScheduledTask`).
- **Linux:** **systemd user timers** (`systemctl --user`, unidades
  `.timer`+`.service`) como opción principal; `cron` como alternativa.
- **Portabilidad:** 🔴 tres backends distintos, pero el **contrato** (crear/
  listar/borrar/ejecutar-ahora una tarea con periodicidad) se abstrae bien. El
  trabajo real que dispara la tarea puede ser el propio binario con un flag
  (`--run-task <id>`), común a los tres.

### `dsstore` — limpiar `.DS_Store` + zip limpio
Comandos: `clean_zip`, `sweep_ds_store`, `get/set_network_stores_disabled`.
- **macOS hoy:** barrido de `.DS_Store` + `defaults` (deshabilitar `.DS_Store`
  en red).
- **Windows:** el equivalente conceptual es **`Thumbs.db`/`desktop.ini`** (y
  `Zone.Identifier`). El zip limpio (sin metadatos de macOS) sigue teniendo
  sentido. `defaults` no existe → esa opción se oculta.
- **Linux:** equivalente = `.directory` (KDE), `.Trash-1000`. Menos relevante.
- **Portabilidad:** 🟡 el zip limpio es portable; el "barrido" cambia de objetivo
  por SO (`.DS_Store` → `Thumbs.db`/`.directory`) y la opción de red es solo
  macOS. Renombrar el módulo a algo neutro (p. ej. `junkfiles`) o mostrar el
  objetivo según el SO.

### `cache` — caché de usuario
Comandos: `scan_caches`, `clean_caches`.
- **macOS hoy:** `~/Library/Caches`.
- **Windows:** `%LocalAppData%\...\Cache`, `%Temp%`, caché de navegadores por
  perfil, `INetCache`.
- **Linux:** `~/.cache` (XDG), `/tmp`, cachés por app.
- **Portabilidad:** 🟡 misma mecánica (medir + borrar a Papelera con dry-run);
  cambian **solo las rutas** → tabla de rutas por SO y el resto se comparte.

### `duplicates` — buscador de duplicados por hash
Comando: `find_duplicates`.
- **macOS hoy:** `walkdir` + `shasum`/SHA-256.
- **Windows/Linux:** idéntico con crates `walkdir` + `sha2`/`blake3`.
- **Portabilidad:** 🟢 totalmente portable en cuanto se sustituya `shasum` por el
  crate `sha2`/`blake3` (además, más rápido).

### `tray` — icono en la barra/bandeja del sistema
Comandos: `get_tray_visible`, `set_tray_visible`.
- **macOS hoy:** API de bandeja de Tauri 2.
- **Windows/Linux:** la **API de bandeja de Tauri 2 ya es multiplataforma**
  (Windows: system tray; Linux: `libayatana-appindicator`, dependencia de build).
- **Portabilidad:** 🟢 casi tal cual. En Linux hay que añadir la dependencia de
  sistema del appindicator en el runner/instalador. El detalle macOS de
  "cerrar la ventana la oculta" se puede mantener en los tres.

### Resumen del inventario

| Módulo | Portabilidad | Nota clave |
|---|---|---|
| `duplicates` | 🟢 | `sha2`/`blake3` + `walkdir` |
| `network` | 🟢 | `sysinfo` Networks |
| `tray` | 🟢 | API Tauri 2 (Linux: appindicator) |
| `system` | 🟡 | `sysinfo`; sensores por SO |
| `storage` | 🟡 | tamaños con `sysinfo`; categorías por SO |
| `scanner` | 🟡 | `walkdir` + crate `trash`; "revelar" por SO |
| `devclean` | 🟡 | Docker/dev portables; rutas y Xcode/NuGet cambian |
| `memory` | 🟡 | stats portables; "purga" específica/honesta |
| `cache` | 🟡 | misma mecánica, rutas por SO |
| `dsstore` | 🟡 | zip portable; objetivo del barrido cambia |
| `snapshots` | 🔴 | APFS→VSS→Btrfs/ZFS; capacidad condicional |
| `apps` | 🔴 | registro/MSIX vs. gestor de paquetes vs. bundles |
| `scheduler` | 🔴 | launchd→Programador de tareas→systemd timers |

---

## 3. Qué es portable tal cual y qué es específico

**Portable sin cambios (frontend):** toda la UI React/TS, i18n, temas (tweakcn),
fuentes locales, skin Hera, efectos, estado y formato. No toca disco/red/sistema.

**Portable con un crate (una sola implementación):** `duplicates`, `network`, la
parte de CPU/RAM/procesos de `system`, tamaños de disco de `storage`, el escaneo
de `scanner`, la Papelera (crate `trash`), abrir carpeta (`opener`).

**Específico por SO (rama obligatoria):** sensores de temperatura, categorías de
almacenamiento, `snapshots`, `apps`, `scheduler`, la "purga" de `memory`, el
objetivo de `dsstore`, las rutas de `cache`/`devclean`, y la opción de red de
`.DS_Store` (solo macOS).

---

## 4. Fases (orden por valor/riesgo)

### Fase 0 — Refactor a arquitectura por SO (sin cambiar comportamiento) · base
Reorganizar cada módulo a `mod.rs` (contrato) + `macos.rs` (implementación
actual movida tal cual) + `types.rs`. Meter todo el código actual bajo
`#[cfg(target_os = "macos")]`. Añadir stubs `windows.rs`/`linux.rs` que
devuelven `unimplemented`/`—`. **Riesgo: bajo** (macOS sigue igual). Sin esto,
todo lo demás es más caro. Aprovechar para migrar a crates portables
(`sysinfo`, `trash`, `sha2`) lo que hoy hace shell-out: reduce ramas futuras.
> Entregable: compila en macOS idéntico; esqueleto listo para rellenar Windows/Linux.

### Fase 1 — Windows: núcleo de solo lectura (bajo riesgo, alto valor)
`system`, `network`, `storage` (tamaños), `scanner` (escaneo + revelar), y las
partes de solo lectura. Nada que borre todavía. Validar el build en runner
`windows-latest` (MSI/NSIS). **Riesgo: bajo.** Da una app que ya "muestra" en
Windows.

### Fase 2 — Linux: núcleo de solo lectura (paralelo a Fase 1)
Lo mismo para Linux (`/proc`, `sysinfo`, XDG). Build en `ubuntu-latest`
(AppImage + `.deb`), añadiendo las dependencias de sistema de Tauri
(webkit2gtk, appindicator). **Riesgo: bajo.**

### Fase 3 — Limpieza portable (el gran valor común)
`cache`, `devclean`, `duplicates` y la Papelera de `scanner` con **dry-run +
Papelera + log** (motor `reclaim` común). Es donde más se comparte: mecánica
idéntica, solo cambian rutas y objetivos. **Riesgo: medio** (borra) → mismas
salvaguardas que en macOS: previsualización obligatoria, whitelist, a Papelera.

### Fase 4 — Programación multiplataforma
`scheduler` con backend por SO (Programador de tareas / systemd user timers) y
el binario ejecutando la tarea con un flag común. **Riesgo: medio.**

### Fase 5 — Específicos avanzados (capacidad condicional)
`snapshots` (VSS en Windows; Btrfs/ZFS/Timeshift en Linux, oculto si el FS no lo
soporta), `apps` (registro/MSIX; gestores de paquetes), sensores de temperatura,
"purga" de memoria honesta o retirada. **Riesgo: medio-alto**; se muestran solo
donde aportan valor real (honestidad).

### Fase 6 — Empaquetado, firma e instaladores por SO
- **Windows:** instalador MSI/NSIS; firma con certificado de code-signing
  (EV/OV) para no disparar SmartScreen.
- **Linux:** AppImage + `.deb`/`.rpm` (opcional Flatpak); sin firma equivalente,
  pero checksums/repos.
- **macOS:** activar la firma Developer ID + notarización ya dejada preparada en
  el CI.
Actualizar `tauri.conf.json` con `bundle.targets` por SO y el workflow con una
**matriz** (`macos-latest`, `windows-latest`, `ubuntu-latest`).

---

## 5. Adaptaciones de texto / UX por sistema

- **Terminología del dispositivo:** hoy los textos dicen "Mac". Externalizar a
  i18n una variable de dispositivo y decir **"tu Mac"** en macOS, **"tu PC"** en
  Windows y **"tu equipo/dispositivo"** en Linux. Igual con "Finder" → "el
  Explorador" (Windows) / "el gestor de archivos" (Linux).
- **Papelera:** "Papelera" (macOS/Linux) vs. "Papelera de reciclaje" (Windows).
- **Conceptos que se ocultan si no aplican:** instantáneas APFS, opción de
  `.DS_Store` en red, sensores de temperatura sin dato → no mostrar función
  vacía; principio de honestidad (`—` o función oculta, nunca simulada).
- **Rutas y ejemplos** en la UI: no hardcodear `~/Library/...`; mostrar la ruta
  real que devuelve el backend del SO.
- **Permisos/elevación:** macOS `osascript ... with administrator privileges`;
  Windows manifiesto UAC / relanzar elevado; Linux `pkexec`/`polkit`. Un único
  helper de "esto necesita permisos de administrador" con backend por SO.
- **Barra de menús vs. bandeja:** el texto "barra de menús" (macOS) → "bandeja
  del sistema" (Windows) / "área de notificación" (Linux).
- **Marca:** revisar que "ZodHub Pulse" y los textos legales/ayuda no asuman
  macOS. El identificador `com.viper.macup` es interno y **no se cambia**.

---

## 6. Impacto en el CI/CD

El workflow actual compila solo macOS universal. Al llegar a las Fases 1–2,
convertirlo en **matriz**:

```yaml
strategy:
  matrix:
    include:
      - { os: macos-latest,  args: --target universal-apple-darwin }
      - { os: windows-latest, args: "" }
      - { os: ubuntu-latest,  args: "" }   # + apt-get de webkit2gtk/appindicator
```

Con `tauri-apps/tauri-action` cada runner produce su instalador y todo se sube a
la misma Release. Linux necesita un paso previo de dependencias del sistema.

---

## 7. Resumen ejecutivo

El **frontend entero es portable** y una buena parte del backend se vuelve
multiplataforma solo con crates (`sysinfo`, `trash`, `sha2`, `walkdir`). El
trabajo específico se concentra en cuatro módulos 🔴 (`snapshots`, `apps`,
`scheduler`, y parcialmente `storage`) más ajustes de rutas y de textos. Camino
recomendado: **Fase 0 (refactor por SO en macOS, sin cambiar nada) → núcleo de
solo lectura en Windows y Linux → limpieza portable → programación → específicos
→ empaquetado/firma**. Así cada fase entrega algo usable y el riesgo de borrado
solo entra cuando el motor de seguridad común ya está portado.

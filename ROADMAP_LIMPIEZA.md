# ZodHub Pulse — Módulo de Mantenimiento y Limpieza (roadmap)

Objetivo: que ZodHub Pulse **detecte, muestre y libere** de forma segura lo que llena el
disco (instantáneas, cachés de dev, modelos de IA, basura del sistema) y pueda
hacerlo **programado**, sin volver a llenarse sin darse cuenta.

> **Estado:** Fase 0 (Almacenamiento) ✅ · Fase 1 (Explorador + Papelera) ✅ ·
> Fase 2 (Instantáneas APFS) ✅ · Desinstalador de apps ✅ · Fase 3 → ampliada a
> "Liberar espacio" de un botón (cachés, logs, Xcode, paquetes, IA, Docker,
> Papelera) ✅ · Limpieza en Inicio + medición de espacio libre real ✅ ·
> Fase 6 básica (auto semanal vía launchd) ✅.
> Fase 5 (navegadores por perfil + copias de iOS) ✅ · Fase 7 (buscador de
> duplicados por SHA-256) ✅.
> **Pendiente:** adjuntos de Mail (opcional, muy protegido por TCC) y consolidar
> el motor de seguridad común (`reclaim.rs`: dry-run/whitelist/log unificados).
> Fuera del plan de limpieza: auto-actualizaciones, firma/notarización, servicio
> nativo de Finder y afinar la temperatura.

Regla de oro del proyecto: **toda la lógica real en Rust** (`#[tauri::command]`),
el frontend solo UI. Y nada se borra sin previsualización + confirmación.

---

## Lo que ZodHub Pulse YA tiene (reutilizable)

- **Caché de usuario** (`cache.rs`): escaneo + borrado de `~/Library/Caches`.
- **Memoria** (`memory.rs`): purga de RAM.
- **.DS_Store** (`dsstore.rs`): comprimir limpio + barrido.
- **Papelera** y **cachés** vía **tareas launchd** (`scheduler.rs`): base de
  automatización periódica ya montada (diaria/semanal/mensual, async).
- **Telemetría** de disco/CPU/memoria (`system.rs`) y **red** (`network.rs`).
- Sistema de **overlays/efectos**, **i18n**, **temas** y **tray**.

## Lo que FALTA (este módulo)

1. Panel de **almacenamiento** por categorías + volúmenes + **histórico**.
2. **Explorador de archivos/carpetas grandes** (mapa tipo DaisyDisk).
3. **Instantáneas APFS/Time Machine**: listar, tamaño, adelgazar/eliminar.
4. **Cachés de desarrollo**: Docker, node_modules, npm/yarn/pnpm/pip/brew,
   Xcode DerivedData/Archives, carpetas build/dist.
5. **Modelos y cachés de IA**: HuggingFace, Ollama, LM Studio.
6. **Sistema**: logs, Descargas antiguas, cachés de navegadores, adjuntos de
   Mail, copias de iOS. (Extiende el limpiador de caché actual.)
7. **Duplicados** (opcional).
8. **Mantenimiento programado inteligente** con reglas seguras + aviso previo.

---

## Capa de SEGURIDAD (transversal, se construye desde el minuto 1)

Un único "motor de recuperación" en Rust que TODAS las limpiezas usan:

- **Dry-run / previsualización obligatoria**: cada operación devuelve primero un
  informe (qué, dónde, cuánto se liberaría, nivel de riesgo). Nada se borra en
  esa fase.
- **Lista blanca de rutas protegidas**: sistema/SIP, `~` sensibles, y los
  **proyectos activos** que el usuario marque. Nunca se tocan sin permiso.
- **A la Papelera, no borrado permanente**, siempre que se pueda (vía
  `NSFileManager trashItem` / Finder), con opción de borrado definitivo explícito.
- **Registro (log) de todo lo borrado**: JSON auditable, para deshacer/consultar.
- **Etiqueta de riesgo y explicación por categoría** (seguro / requiere revisión
  / avanzado), visibles en la UI antes de actuar.
- **"Aprende qué es seguro"**: cada categoría que el usuario confirma como segura
  se recuerda en un fichero de reglas; el modo automático solo actúa sobre
  categorías ya consentidas y siempre avisa antes.

Nuevos módulos Rust previstos: `storage.rs` (desglose), `scanner.rs` (barrido de
tamaños, sin seguir symlinks), `snapshots.rs` (`tmutil`), `devclean.rs`
(Docker/Node/Xcode/IA) y `reclaim.rs` (motor dry-run + Papelera + log + whitelist).

---

## Fases (orden por valor/riesgo)

### Fase 0 — Panel de Almacenamiento (solo lectura) · base
- Rust: `storage.rs` — desglose por categorías (Sistema, Datos, VM, Preboot,
  snapshots, apps, dev, IA…) leyendo `df`, `diskutil apfs list`, tamaños por
  carpeta. Guardar muestras periódicas → **histórico** (gráfica de crecimiento).
- UI: pestaña "Almacenamiento" con barras por categoría/volumen + gráfica de
  evolución. Riesgo: **nulo** (no borra).

### Fase 1 — Explorador de grandes (solo lectura)
- Rust: `scanner.rs` — top de archivos/carpetas por tamaño (walkdir, sin
  symlinks, con límites y cancelable). UI: lista + treemap; abrir en Finder.
  Riesgo: nulo.

### Fase 2 — Instantáneas APFS/Time Machine
- Rust: `snapshots.rs` — `tmutil listlocalsnapshots /` + tamaño; adelgazar con
  `tmutil thinlocalsnapshots` / borrar una concreta (con confirmación y admin).
  Riesgo: bajo (se pierden restauraciones locales).

### Fase 3 — Cachés de desarrollo (el gran ahorro para este perfil)
- Rust: `devclean.rs` — detectar y medir, borrar con dry-run + Papelera/log:
  - **Docker**: `docker system df -v`; prune de imágenes/contenedores/build cache
    **sin volúmenes por defecto** (los volúmenes se listan aparte y se avisa muy
    fuerte: pueden contener datos, p. ej. SurrealDB).
  - **Xcode** DerivedData/Archives (borrable).
  - **node_modules** por proyecto (con antigüedad/último uso).
  - Cachés **npm/yarn/pnpm/pip/brew**; carpetas `build`/`dist`.
- UI: por categoría, con tamaño, riesgo y previsualización. Riesgo: medio (con
  las salvaguardas, seguro; Docker-volúmenes = manual y muy señalizado).

### Fase 4 — Modelos y cachés de IA
- HuggingFace (`~/.cache/huggingface/hub`), Ollama (`ollama list`/`rm`), LM Studio.
  Mostrar por modelo, tamaño y fecha; borrar selectivo. Riesgo: bajo (re-descargable).

### Fase 5 — Sistema (extensión del limpiador actual)
- Logs, Descargas antiguas (por antigüedad), cachés de navegadores por perfil,
  adjuntos de Mail, copias de iOS. Todo con previsualización + Papelera.

### Fase 6 — Mantenimiento programado inteligente
- Reglas por categoría (solo las consentidas), integradas en el `scheduler.rs`
  existente; aviso/resumen antes de actuar; informe de lo liberado.

### Fase 7 — Duplicados (opcional)
- Por hash de contenido, con revisión manual antes de borrar.

---

## Primer paso propuesto
Construir **Fase 0 (Panel de Almacenamiento)** + el esqueleto del **motor de
seguridad** (`reclaim.rs` con dry-run, whitelist, Papelera y log). Es la base
sobre la que se enchufan todas las limpiezas, y ya aporta valor (ver el
crecimiento del disco) sin ningún riesgo.

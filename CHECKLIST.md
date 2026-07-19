# ZodHub CleanPC — Checklist de verificación

Lista viva de comprobaciones antes de dar por buena una tarea y, sobre todo,
**antes de un build/empaquetado**. Si algo cambia en la app, se actualiza aquí.
Marcar lo verificado en cada repaso.

> Regla rápida: cambios en `src-tauri/**` o `Cargo.toml` → hay que **recompilar**
> (`npm run tauri dev`). Cambios solo de frontend → recarga en caliente.

---

## 1. Funcionalidad real (datos honestos)

- [ ] **Resumen/Inicio**: CPU, Memoria, Disco y Temperatura muestran datos
      reales y en vivo. Si un sensor no existe (p. ej. temperatura), muestra `—`,
      nunca un valor inventado.
- [ ] **Temperatura**: usa sensores de CPU filtrados (no el máximo de todos los
      sensores). Valor creíble (no 88 °C de la GPU).
- [ ] **Caché**: escanear lista cachés reales con tamaños correctos; limpiar
      **borra de verdad**, reporta bytes liberados y re-escanea al terminar.
- [ ] **Memoria**: el desglose es proporcional al total de RAM (las barras se
      mueven); la purga real libera caché de archivos/reclamables; «Activa» no baja.
- [ ] **.DS_Store**: «Comprimir limpio» genera zip sin `.DS_Store`, `__MACOSX`
      ni resource forks; el barrido elimina los `.DS_Store` reales.
- [ ] **Red / Radar**: paquetes, datos y throughput reales; el radar es una
      representación honesta (su intensidad usa datos reales de la red).

## 2. Tareas (launchd) — «Ejecutar ahora» y programación

- [ ] **Vaciar la papelera**: funciona; con papelera vacía NO da error
      (se ignora el `-128`); silencia el aviso de Finder.
- [ ] **Limpiar cachés** y **Barrido .DS_Store**: terminan en éxito aunque haya
      archivos bloqueados/protegidos (best-effort, `exit 0`).
- [ ] El barrido **no recorre** Library/.Trash/node_modules/fototecas/.app
      (sin cuelgues ni pelota de playa).
- [ ] Todas las operaciones corren **fuera del hilo principal** (async +
      `spawn_blocking`): no se bloquea la UI ni aparece el spinner del sistema.
- [ ] Programar diaria/semanal/mensual crea/borra el LaunchAgent correctamente.

## 3. Integraciones macOS (requieren build/empaquetado)

- [ ] **Icono en la barra de menús**: aparece arriba; el menú *Abrir ZodHub CleanPC /
      Salir* funciona; el interruptor de Ajustes lo activa/desactiva; con el icono
      activo, cerrar la ventana la **oculta** (la app sigue en la barra), no cierra.
- [ ] **«Comprimir con ZodHub CleanPC» (clic derecho)**: la Acción Rápida aparece en
      *Acciones rápidas* y produce un zip limpio. (Versión nativa integrada =
      pendiente de empaquetar el `.app` con el Servicio del sistema.)

## 4. Efectos visuales y UX

- [ ] **Efecto de escaneo** (≥4,5 s) solo en operaciones de *escaneo*.
- [ ] **Efecto de vaciado** (≥4,5 s, sincronizado hasta que la operación acabe)
      en limpiar caché, liberar memoria, vaciar papelera y barrido .DS_Store.
- [ ] Los loaders **aparecen siempre** (no se quedan bloqueados por el hilo
      principal).
- [ ] **Filigrana de Hera**: líneas parejas y limpias en TODAS las tarjetas
      (pinstripe suave en `::after`, no en el panel grande de fondo).
- [ ] Espaciado de **10px** entre todas las tarjetas, en todas las vistas.
- [ ] Tabla de Caché a alto completo + scroll; zona de arrastre de .DS_Store
      expandible; todo responsive a la resolución/ventana.
- [ ] **Arranque sin lag**: las pestañas responden a la primera, la ventana se
      arrastra desde el inicio (widgets pesados diferidos con `useReady`).

## 5. Idiomas (i18n)

- [ ] El botón de la bandera alterna ES/EN y se recuerda entre sesiones.
- [ ] **Toda cadena nueva** visible se envuelve en `t(...)` y se añade su
      traducción al diccionario `EN` de `src/components/language-provider.tsx`.
      (Si falta, cae al español: no debe quedar texto vacío.)

## 6. Build y entorno

- [ ] Cambios en Rust (`src-tauri/**`, `Cargo.toml`) → recompilar con
      `npm run tauri dev`. El registro npm está bloqueado en el entorno del
      asistente: **compila el usuario en su Mac**.
- [ ] Tras añadir dependencias (crates o JS) → reinstalar/recompilar.
- [ ] **NO editar a mano**: `src/themes.css` ni `src/lib/themes.ts`
      (`npm run themes`); `src/fonts.css` (`npm run fonts`).
- [ ] Toda operación real (disco/red/sistema) está en **Rust** como
      `#[tauri::command]` y **registrada** en el `invoke_handler` de `lib.rs`.
- [ ] Modales con `createPortal` a `body` (para no quedar bajo el blur de Hera).

## 7. Actualizaciones (updater) y CI/CD

- [ ] **Clave del updater generada** (`npm run tauri signer generate`): la
      pública está en `tauri.conf.json` (`plugins.updater.pubkey`); la privada,
      como secret `TAURI_SIGNING_PRIVATE_KEY` en GitHub (+ `_PASSWORD` si tiene).
- [ ] **Endpoint correcto**: `plugins.updater.endpoints` apunta a
      `https://github.com/zodhub-app/clean/releases/latest/download/latest.json`
      (el repo NO se renombra aunque el producto sea «CleanPC»: esa URL va grabada
      en las versiones ya publicadas).
- [ ] **`createUpdaterArtifacts: true`**: OJO, `npm run tauri build` **exige** la
      clave privada en el entorno (`export TAURI_SIGNING_PRIVATE_KEY=…`). `tauri
      dev` no la necesita. En CI la aporta el secret.
- [ ] **Release publicada**: el updater solo ve la última release **publicada**
      (no borrador ni prerelease). Publicar el borrador que crea el workflow.
- [ ] **Campana de la barra**: entre el botón de tema y el de idioma. Con versión
      nueva muestra **LED rojo con el número**; al pulsar, panel con «Actualizar
      ahora» + barra de progreso, y reinicia al terminar. Sin novedad dice «Estás
      al día»; sin red o en `dev`, «No se pudo comprobar» (nunca finge estar al día).
      Re-comprueba cada 6 h y tiene botón de comprobación manual.
- [ ] **Subir la versión** en `tauri.conf.json` y `Cargo.toml`/`package.json`
      antes de taggear; el tag `vX.Y.Z` debe coincidir.

## 7 bis. Web pública, legal y donaciones

- [ ] **Dominio**: el oficial es **zodhub.app** (antes se usó `zodhub.pro`; no
      debe quedar ninguna ocurrencia). Contacto provisional: `info@zodhub.com`.
- [ ] **Páginas legales existen y enlazan**: `landing/privacidad.html` y
      `landing/terminos.html`. Los enlaces desde la app («Tu espacio → legal»)
      apuntan a `https://zodhub-app.github.io/clean/…`: si se cambia el nombre de
      un archivo, hay que tocar `LINKS` en `src/pages/account.tsx`.
- [ ] **Coherencia legal ↔ código**: la política de privacidad afirma que las
      únicas salidas de red son la comprobación de actualizaciones y la
      suscripción voluntaria. Si se añade **cualquier** otra petición de red, la
      política deja de ser cierta → actualizarla en el mismo commit.
- [ ] **Donaciones**: el bloque `PAY` de `landing/donar.html` (Stripe / Ko-fi /
      GitHub Sponsors). Con todo vacío el botón sale desactivado y dice
      «Donaciones aún no abiertas» — es el estado honesto, no un bug.
- [ ] **Cifras de ejemplo**: la meta del mes y los apoyos de `donar.html` son
      ilustrativos y están etiquetados como tales. Al abrir donaciones, poner
      datos reales o quitar los módulos.
- [ ] **Suscripción**: `ENDPOINT` en `src-tauri/src/subscribe.rs`. Debe ser un
      servicio con identificador **público** (Formspree, Web3Forms) o función
      serverless propia. NUNCA una API con clave secreta: el binario se distribuye.

### Errores ya cometidos aquí (no repetir)

- `reqwest` 0.13 renombró la feature `rustls-tls` → **`rustls`**. Con el nombre
  viejo, `cargo` falla con «does not have that feature».
- En `Cargo.toml` **no existe** `cfg(desktop)`: es un cfg de Tauri, no de Cargo.
  Para dependencias de escritorio usar
  `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.

## 8. Principios innegociables (recordatorio)

- [ ] **Lógica real en Rust**; el frontend solo hace UI/estado/formato.
- [ ] **Honestidad**: nada simulado que engañe; `—` cuando no hay dato real.
- [ ] **Local-first**: cero telemetría; los datos no salen del equipo.
- [ ] **Borrado responsable**: permanente y confirmado; rutas validadas; nunca
      tocar rutas del sistema/SIP; admin solo cuando hace falta.

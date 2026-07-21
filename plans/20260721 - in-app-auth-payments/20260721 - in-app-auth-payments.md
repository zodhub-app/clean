# Plan de implementación: Onboarding, suscripción y donaciones in‑app (sin muros; login como fase futura)

> Nivel: **Completo (Full)** — introduce un flujo de pago dentro del WebView (Stripe Elements) y una superficie de datos mínima; sensible en seguridad y en experiencia/confianza.
> Autor/fecha: Claude / 2026‑07‑21  ·  Estado: Listo
> Proyecto: **app de escritorio ZodHub Pulse** — repo `zodhub-app/pulse`, nombre interno **`macup`** (Tauri v2 + React 19 + Vite + TypeScript).
> Plan complementario: los endpoints del back‑end viven en el plan de la **plataforma ZodHub** `app-api-secure-surface`. Esta app consume ese contrato. Lo que la app usa **ahora** es la ruta pública de newsletter y `POST /api/app/donations/intent` (invitado). La superficie Bearer (`/api/app/token*`, `/api/app/entitlements`) es la base del back‑end que esta app adopta en su **fase futura** (§ Fase G).

---

## 0. Contexto para un lector sin contexto (leer primero)

**Qué construimos y por qué.** La app debe captar, como mucho, **nombre + email** del usuario y permitir **donar con tarjeta real**, todo **dentro de la app** (sin navegador externo), para que sienta un producto profesional. Pero con una regla de producto innegociable, decidida con el dueño del proyecto: **sin muros.** El diferenciador de ZodHub es la transparencia; la propia página de descargas promete "Sin cuenta ni datos · No pedimos registro. Nada de telemetría." Un modal obligatorio de "activa la app con tu email" rompería esa promesa y la sensación de sencillez. Por eso:

- **Primero valor, luego permiso.** La app funciona al 100% sin pedir nada. Solo tras dar valor se ofrece —opcional y saltable— dejar nombre+email.
- **Modelo progresivo "suscriptor → usuario".** Ahora solo hay **suscripción** (nombre+email, vía newsletter, con doble opt‑in que ya existe en el back‑end). El **registro/login no se implementa ahora**; queda diseñado para que, cuando haya recursos de pago, un suscriptor se convierta en usuario **con un clic** (solo pedirle una contraseña). Ver Fase G.
- **Donaciones ahora, como invitado.** Donar no requiere cuenta; se hace con Stripe Elements y un PaymentIntent de invitado. La tarjeta nunca toca nuestro código (vive en el iframe de Stripe).

**Hechos fundamentados en el repo el 2026‑07‑21:**
- Tauri **v2**, React **19**, Vite, TS. Deps: `@tauri-apps/api ^2`, plugins `opener`, `dialog`, `process`, `updater`. **No** hay plugin de almacenamiento seguro **ni** plugin HTTP aún.
- Las llamadas de red hoy pasan por el **lado Rust vía `invoke()`**. La newsletter **ya está cableada**: `subscribe(name,email)` → `invoke("subscribe", …)` y `subscribeAvailable()` → `invoke("subscribe_available")` en `src/lib/api.ts`. Patrón establecido: **Rust posee el HTTP**, JS llama a `invoke`.
- `src/lib/links.ts` `openUrl()` abre enlaces en el navegador **externo**; `src/pages/account.tsx` manda las donaciones ahí hoy. Su comentario declara la postura local‑first ("no incrusta contenido remoto"). **Este plan introduce una excepción controlada por CSP:** solo Stripe + nuestro back‑end.
- `src-tauri/tauri.conf.json`: `productName "ZodHub Pulse"`, `identifier "com.viper.macup"`, **`csp: null`** (hay que fijarlo para Stripe.js). El Cargo.toml ya anota "cuando haya endpoint de suscripción: usar `tauri-plugin-http`".
- Stripe **no** está aún en la app; hay que añadir `@stripe/stripe-js`, `@stripe/react-stripe-js`. Stripe.js **debe** cargarse desde `js.stripe.com` en runtime (no bundleado) por PCI/compliance.
- **Nota de alcance frente al plan anterior:** como el login se aplaza, **ahora NO hace falta almacenamiento seguro de tokens** (stronghold/keychain) ni el manejo de access/refresh en la app. Eso entra con la Fase G. El ahora es más pequeño y de menor riesgo.

## 1. Objetivo y definición de terminado
- **Objetivo:** Onboarding acogedor que presente la app y ofrezca la suscripción (nombre+email) como paso **opcional y saltable**; captar suscriptores sin muros; y permitir una **donación con tarjeta in‑app** (invitado) — todo dentro de la app, seguro para usuario y para nosotros, sin traicionar la promesa de "sin registro".
- **Definición de terminado (observable):**
  1. En el primer arranque aparece una **pantalla de bienvenida/onboarding** que presenta la app y ofrece suscribirse (nombre+email) con un **"Ahora no" bien visible**; saltar no penaliza ni bloquea nada.
  2. La app funciona **al 100% sin suscribirse** (limpieza, stats, todo), y la suscripción vive también, siempre disponible, en su pestaña (Cuenta/Apoyar) presentada de forma bonita.
  3. Suscribirse envía nombre+email por el `subscribe` de Rust existente; el usuario recibe el email de doble opt‑in (flujo del back‑end).
  4. Una **donación** se completa **dentro de la app**: pantalla Elements/Payment Element que carga Stripe.js desde `js.stripe.com`, obtiene `{clientSecret, publishableKey}` del back‑end (invitado) y `confirmPayment` tiene éxito en modo test — sin ninguna ventana de navegador externo.
  5. El CSP de `tauri.conf.json` permite dominios de Stripe + nuestro back‑end y bloquea todo lo demás; la app sigue corriendo.
  6. `npm run build` (`tsc && vite build`) pasa; `npm run tauri build` produce una app ejecutable.
- **Restricciones:** **sin muros** (nada bloquea el uso por no dar datos); ningún secreto en el cliente; Stripe.js solo desde `js.stripe.com`; mantener la postura de no‑contenido‑remoto‑arbitrario salvo Stripe + back‑end permitidos por CSP; APIs de Tauri v2; el marco de la captación es **"novedades/suscripción", nunca "activación"**.
- **No‑objetivos (ahora):** Login/registro y pantalla de contraseña. Almacenamiento seguro de tokens. Gateo de funciones por entitlement/plan de pago. Todo eso queda **diseñado** en la Fase G, no construido.

## 2. Stack y entorno (fundamentado)
- **App:** Tauri v2 (`tauri = { version = "2" }`), React `^19.1.0`, Vite, TS. UI: Radix, tailwind‑merge, toasts `sonner`, `next-themes`.
- **Build/run:** `npm run dev` (vite), `npm run build` (`tsc && vite build`), `npm run tauri` (CLI de Tauri).
- **A añadir (ahora):** JS — `@stripe/stripe-js`, `@stripe/react-stripe-js`. Rust — capacidad de POST HTTP al back‑end para el `donation-intent` (extender el reqwest existente o `tauri-plugin-http`; el `subscribe` ya lo hace). **No** se añade almacén seguro de tokens ahora (Fase G).
- **Patrones a seguir:** wrappers tipados en `src/lib/api.ts` sobre `invoke(...)`; páginas bajo `src/pages/`; `openUrl` solo para enlaces genuinamente externos.

## 3. Mapa de módulos / archivos afectados
| Ruta | Rol hoy | Cambio |
|------|---------|--------|
| `src/pages/account.tsx` | UI de cuenta; suscripción básica; donación → navegador externo | Convertir la sección de suscripción en una **bienvenida/onboarding bonita** (presentación + opt‑in opcional); enrutar la donación a la nueva pantalla in‑app. |
| `src/components/onboarding/` (nuevo) | — | Pantalla/paso de bienvenida de primer arranque con opt‑in de suscripción opcional y "Ahora no"; recuerda si ya se mostró/saltó (estado local, no dato personal). |
| `src/pages/donate.tsx` (nuevo) | — | Pantalla de donación con Stripe Elements (invitado). |
| `src-tauri/tauri.conf.json` | `csp: null` | Fijar un CSP estricto que permita Stripe (`js.stripe.com`, `*.stripe.com`, `*.stripe.network`) + origen del back‑end. |
| `src-tauri/Cargo.toml` + comando Rust | `subscribe` ya hace HTTP | Añadir un comando `donation_intent` (POST invitado a `/api/app/donations/intent`) siguiendo el patrón del `subscribe`. |
| `src/lib/api.ts` | API basada en `invoke` (sistema + newsletter) | Añadir wrapper tipado `createDonationIntent(amount, currency, frequency?)`. |
| `src/lib/links.ts` | `openUrl` externo | Mantener para enlaces realmente externos; la donación ya no lo usa. |
| `src/lib/config.ts` (nuevo) | — | Base URL del back‑end desde env de build (`VITE_API_BASE`) — ver Supuestos. |

## 4. Cambios de contrato
- **Consume ahora** (del plan de plataforma): la **ruta pública de newsletter** (`POST /api/mod/public/newsletter/subscribe`, ya usada por el `subscribe` de Rust) y `POST /api/app/donations/intent` **como invitado** (sin Bearer). La donación devuelve `{clientSecret, publishableKey}`; `confirmPayment` va del WebView directo a Stripe.
- **No consume ahora:** `/api/app/token*` ni `/api/app/entitlements` (Fase G).
- **Transporte:** el POST del `donation-intent` se hace en **Rust** (como `subscribe`), sin CORS de navegador. Solo Stripe.js corre en el WebView, con el `client_secret`.

## 5. Pasos

### Paso 1 — Onboarding/bienvenida con suscripción opcional y saltable
- **Objetivo:** Captar nombre+email de quien quiera, sin muros, tras/junto a la presentación de la app.
- **Archivos que toca:** `src/components/onboarding/*`, `src/pages/account.tsx`, `src/lib/api.ts` (usa `subscribe`/`subscribeAvailable` existentes).
- **Precondiciones:** ninguna (el `subscribe` de Rust ya existe).
- **Acciones:** Pantalla de bienvenida en el primer arranque que presenta la app y ofrece suscribirse (campos nombre + email) con un **"Ahora no"** prominente; guardar en estado local si ya se mostró/saltó (no es dato personal). Rehacer la sección de suscripción de la pestaña Cuenta/Apoyar como esa misma bienvenida bonita, siempre accesible. Texto honesto: "opcional, solo para avisarte de novedades y nuevas versiones". Nunca la palabra "activar"; nunca bloquear funcionalidad.
- **Criterios de aceptación:** Saltar el onboarding deja la app plenamente usable; suscribirse dispara el email de doble opt‑in; reabrir la app no vuelve a forzar el modal si ya se saltó; la suscripción sigue disponible en su pestaña.
- **Rollback / alternativa:** Ocultar la pantalla de bienvenida; la suscripción queda solo en su pestaña (como hoy).
- **Riesgo:** bajo — pero cuidar el copy/UX para no derivar en muro.

### Paso 2 — Dependencias de Stripe + comando Rust de donación
- **Objetivo:** Poder crear el PaymentIntent de donación (invitado) y cargar Elements.
- **Archivos que toca:** `package.json` (Stripe JS), `src-tauri/Cargo.toml` + comando Rust `donation_intent`, `src/lib/api.ts` (`createDonationIntent`).
- **Precondiciones:** Pasos 6–7 del plan de plataforma vivos en **modo test** de Stripe.
- **Acciones:** `npm i @stripe/stripe-js @stripe/react-stripe-js`. Añadir comando Rust `donation_intent` que hace POST a `/api/app/donations/intent` (con `X-ZodHub-App: 1`) y devuelve `{clientSecret, publishableKey}`. Wrapper JS `createDonationIntent`.
- **Criterios de aceptación:** `import { loadStripe } from "@stripe/stripe-js"` type‑checkea; `createDonationIntent(500,"eur")` devuelve un `client_secret`; `npm run tauri build` compila.
- **Rollback / alternativa:** Quitar deps/comando.
- **Riesgo:** bajo.

### Paso 3 — CSP estricto para Stripe
- **Objetivo:** Permitir Stripe Elements manteniendo la app cerrada.
- **Archivos que toca:** `src-tauri/tauri.conf.json` (`csp`).
- **Precondiciones:** ninguna.
- **Acciones:** Sustituir `csp: null` por una política con `default-src 'self'` y permitir `script-src`/`frame-src`/`connect-src` para `https://js.stripe.com https://*.stripe.com https://*.stripe.network` + origen del back‑end; ningún otro contenido remoto.
- **Criterios de aceptación:** La pantalla de donación carga Stripe.js y renderiza el Payment Element sin violaciones de CSP; cargas remotas ajenas bloqueadas.
- **Rollback / alternativa:** Relajar temporal para diagnosticar y re‑apretar; nunca enviar `csp: null`.
- **Riesgo:** medio — un CSP demasiado estricto rompe Elements en silencio; probar también el 3DS (Paso 4).

### Paso 4 — Donación in‑app (invitado) vía Stripe Elements
- **Objetivo:** Donación completa con tarjeta dentro de la app, sin que los datos de tarjeta toquen nuestro código.
- **Archivos que toca:** `src/pages/donate.tsx`; `createDonationIntent`; actualizar `account.tsx` para abrir esta pantalla en vez de `openUrl(donate)`.
- **Precondiciones:** Pasos 2 + 3.
- **Acciones:** Selector de importe (el servidor lo acota igual) → `createDonationIntent` → `loadStripe(publishableKey)`, `<Elements options={{clientSecret}}>` + `<PaymentElement>` → `confirmPayment`. Éxito/fallo con `sonner`; manejar el reto **3D Secure** inline.
- **Criterios de aceptación:** Una donación con tarjeta de test se completa in‑app **sin navegador externo**; una tarjeta test 3DS completa su reto dentro del WebView; el webhook del back‑end registra la donación (verificado en servidor).
- **Rollback / alternativa:** Reactivar temporalmente `openUrl(donate)` a la web de donación mientras se arregla.
- **Riesgo:** alto — el reto 3DS en un WebView es el punto conocido‑frágil; probar varias tarjetas test de banco pronto.

## 6. Estrategia de pruebas
- **Manual (Tauri dev + modo test):** onboarding se puede saltar y no bloquea nada; suscripción dispara doble opt‑in; la app funciona sin suscribirse; donación camino feliz + una tarjeta test 3DS, ambas del todo in‑app; consola de CSP limpia.
- **Gates de build:** `npm run build` (`tsc && vite build`) limpio; `npm run tauri build` ejecutable.
- **Cruce:** cada donación aparece en el back‑end (webhook) y en el dashboard test de Stripe.

## 7. Migración y despliegue
- **Despliegue:** pantallas aditivas; las funciones de limpieza del sistema sin tocar. **Rollback:** ocultar el onboarding y la pantalla de donación in‑app; restaurar `openUrl(donate)`; el resto de la app sin afectar.
- **Observabilidad:** errores de suscripción/donación con `sonner`; loguear (sin secretos) en Rust el camino de la donación.

### Fase G — Suscriptor → usuario (login/registro y gateo por plan) — DISEÑADA, NO IMPLEMENTADA AHORA
- **Objetivo (futuro):** Cuando haya recursos de pago, convertir un suscriptor en usuario **con un clic** (pidiéndole solo una contraseña) y desbloquear funciones según su plan — todo in‑app.
- **Cómo encaja:** (1) UI "conviértete en usuario": el suscriptor pone contraseña → registro creado sobre su email ya conocido. (2) Login nativo in‑app contra `POST /api/app/token` (password/OTP). (3) **Ahora sí** entra el **almacén seguro de tokens en Rust** (`tauri-plugin-stronghold`/keychain): refresh en almacenamiento seguro, access en memoria, llamadas autenticadas por comandos Rust con auto‑refresh en 401 — el JS del WebView nunca ve el refresh token. (4) Gateo por entitlement leyendo `GET /api/app/entitlements` (que la plataforma ya construye). (5) Compra del plan in‑app con Elements/suscripción (Fase F del plan de plataforma).
- **Definición de terminado de esa fase:** un suscriptor añade contraseña y queda logueado; `GET /api/app/entitlements` refleja su plan; una función premium se desbloquea/bloquea en consecuencia. La decisión ya tomada: el entitlement se apoya en el sistema de **Ofertas** existente del back‑end (solo consumirlo).

## 8. Supuestos
- **Base URL / dominio de prod del back‑end** vía `VITE_API_BASE` (dev vs prod) — **PREGUNTA ABIERTA:** confirmar el origen de producción (HTTPS). *Impacto si falla:* solo cambia el valor de config.
- El `subscribe` de Rust existente apunta (o se puede apuntar) a `POST /api/mod/public/newsletter/subscribe` de la plataforma — *impacto si falla:* ajustar la URL/comando; no cambia el diseño.
- El endpoint `donation-intent` admite invitado (sin Bearer), como especifica el plan de plataforma (Paso 6) — *impacto si falla:* la donación in‑app requeriría login antes, lo que contradice el "sin muros"; verificar en el plan de plataforma antes del Paso 2.
- Los retos 3D Secure renderizan aceptablemente en el WebView del sistema en los SO objetivo — *impacto si falla:* abrir solo el paso 3DS en una ventana hija de Tauri, o (último recurso) el pago en navegador externo.

## 9. Riesgos y mitigaciones
- **Que el onboarding derive en muro** (el error que se quiere evitar) → "Ahora no" prominente, cero bloqueo de funcionalidad, copy honesto "opcional · solo novedades", nunca "activar"; revisar el UX con ese criterio explícito.
- **Romper la promesa "sin cuenta ni datos"** → la app funciona íntegra sin dar datos; la suscripción es opt‑in con doble confirmación; consentimiento libre (no condicionado al uso), limpio frente a RGPD.
- **El CSP rompe Elements / 3DS falla en WebView** → construir/probar donación + 3DS pronto (Paso 4), mantener la donación por navegador externo como fallback temporal, acotar el CSP a Stripe.
- **Manipulación del importe** → irrelevante en cliente: el servidor fija el importe cobrado.
- **Repo público** → ningún secreto en la app; solo la **publishable** key de Stripe (segura) viaja al cliente. (Los tokens y su almacenamiento seguro no existen hasta la Fase G.)

## 10. Preguntas abiertas
- **Origen de producción (dominio HTTPS)** para `VITE_API_BASE` — compartido con el plan de plataforma; fijar antes del Paso 2.
- **¿El onboarding se muestra en el primer arranque o tras la primera limpieza con éxito?** — ambas cumplen "sin muros"; decidir el momento exacto (recomendación: bienvenida en el arranque con "Ahora no", y además tarjeta descartable tras la primera limpieza). No bloquea el desarrollo; afecta solo al disparador del Paso 1.
- **Fase G (futuro):** `tauri-plugin-stronghold` vs keychain del SO, y confirmar la forma de `GET /api/app/entitlements`. Fuera del alcance de ahora.

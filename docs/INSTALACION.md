# Guía de instalación — ZodHub CleanPC

Todo lo que necesitas para instalar y usar ZodHub CleanPC en **macOS** y en **Windows**,
incluido qué hacer con los avisos de seguridad del sistema y cómo comprobar por tu cuenta
que el archivo que has descargado es el nuestro.

> 🇬🇧 [Read this guide in English](INSTALL.md)

---

## Índice

- [Elegir el archivo correcto](#elegir-el-archivo-correcto)
- [Instalación en macOS](#instalación-en-macos)
- [Instalación en Windows](#instalación-en-windows)
- [Actualizaciones automáticas](#actualizaciones-automáticas)
- [Qué hace cada sistema](#qué-hace-cada-sistema)
- [Verificar la descarga](#verificar-la-descarga)
- [Desinstalar](#desinstalar)
- [Problemas frecuentes](#problemas-frecuentes)

---

## Elegir el archivo correcto

Todos los archivos están en **[la última versión](https://github.com/zodhub-app/clean/releases/latest)**,
en la sección *Assets*.

| Tu sistema | Descarga | Por qué |
| --- | --- | --- |
| macOS 12 (Monterey) o superior | `ZodHub.CleanPC_x.y.z_universal.dmg` | Un solo archivo válido para Intel y Apple Silicon |
| Windows 10 u 11, 64 bits | `ZodHub.CleanPC_x.y.z_x64-setup.exe` | Instalador normal, el recomendado |
| Windows en empresa | `ZodHub.CleanPC_x.y.z_x64_en-US.msi` | Para despliegue silencioso por directiva de grupo |

No hace falta saber qué procesador tiene tu Mac: el `.dmg` es universal y funciona en los dos.

En Windows, si dudas entre `.exe` y `.msi`, coge el `.exe`. El `.msi` solo tiene sentido si
administras varios equipos y despliegas software de forma centralizada.

---

## Instalación en macOS

1. Abre el `.dmg` descargado. Se monta una ventana con la app y un acceso a *Aplicaciones*.
2. **Arrastra ZodHub CleanPC a la carpeta Aplicaciones.**
3. La primera vez, **no la abras con doble clic**: haz **clic derecho sobre la app → Abrir**,
   y confirma con **Abrir** en el diálogo que aparece.
4. Expulsa la ventana del `.dmg` (el icono en el escritorio o en la barra lateral del Finder).

A partir de la segunda vez se abre con doble clic como cualquier otra app.

### Por qué pide el clic derecho

macOS muestra *«no se puede abrir porque procede de un desarrollador no identificado»* con
cualquier aplicación que no haya pasado por la **notarización** de Apple, un trámite de pago.
No significa que la app sea peligrosa: significa que Apple no la ha revisado. Nosotros aún no
hemos pagado ese trámite y preferimos decirlo antes que disimularlo.

Si el clic derecho no te funciona, hay una segunda vía:
**Ajustes del Sistema → Privacidad y seguridad →** baja hasta el aviso sobre ZodHub CleanPC
**→ Abrir de todos modos**.

### Permisos que puede pedir

La app solicita acceso a carpetas concretas cuando lo necesita, no antes:

- **Acceso total al disco** — solo si quieres analizar carpetas fuera de tu usuario.
  Puedes negarlo; la app seguirá funcionando con el resto.
- **Permisos de administrador** — únicamente en operaciones que de verdad los requieren,
  como purgar memoria. Aparece el diálogo del sistema y puedes cancelarlo.

---

## Instalación en Windows

1. Ejecuta el archivo `...-setup.exe` que has descargado.
2. Aparecerá una pantalla azul: **«Windows protegió tu PC»**.
   Pulsa **Más información** y después **Ejecutar de todas formas**.
3. Sigue el instalador. Al terminar tendrás ZodHub CleanPC en el **menú Inicio**.

Ocupa alrededor de 12 MB instalado.

### Por qué sale el aviso azul

Windows SmartScreen avisa de todo programa que no venga firmado con un **certificado de código**
de pago, y también de los que sí lo llevan pero todavía tienen pocas descargas. El aviso no dice
que el programa sea dañino: dice que Windows no lo conoce.

Todavía no hemos comprado ese certificado. En vez de pedirte que te fíes, te damos dos formas de
comprobarlo tú mismo, explicadas en [Verificar la descarga](#verificar-la-descarga).

### Instalación silenciosa (administradores)

Con el `.msi`, para desplegar sin interacción:

```powershell
msiexec /i "ZodHub.CleanPC_x.y.z_x64_en-US.msi" /quiet /norestart
```

Y para desinstalar del mismo modo:

```powershell
msiexec /x "ZodHub.CleanPC_x.y.z_x64_en-US.msi" /quiet /norestart
```

La app se instala **por usuario**, no requiere derechos de administrador para funcionar y no
instala servicios ni tareas en segundo plano salvo las que el propio usuario programe desde la
sección *Tareas*.

---

## Actualizaciones automáticas

Funcionan igual en los dos sistemas y **no hay que reinstalar nada a mano**.

- La app comprueba si hay versión nueva **al arrancar y cada 6 horas**.
- Cuando la hay, la **campana** de la barra superior se enciende con un **punto rojo**.
- Al pulsarla verás la versión disponible y sus novedades. Con un clic en *Actualizar ahora*
  se descarga, se **verifica la firma criptográfica**, se instala y la app se reinicia.
- Si no hay novedades dice *«Estás al día»*. Si no puede comprobarlo —por ejemplo sin
  conexión— lo dice claramente, en lugar de fingir que todo está al día.

También puedes forzar la comprobación desde la propia campana.

### Qué se envía en esa comprobación

Solo se descarga un archivo público alojado en GitHub. Como en cualquier petición web, GitHub
recibe tu dirección IP y la versión de la app; nosotros no recibimos nada ni podemos saber
quién ha hecho la consulta. Si prefieres evitarlo, puedes **desactivar la comprobación
automática** en *Ajustes* y actualizar manualmente desde la web.

Todos los paquetes van **firmados criptográficamente** con nuestra clave, así que el
actualizador rechaza cualquier archivo que no proceda de nosotros.

---

## Qué hace cada sistema

Las funciones que no tienen sentido en un sistema **no aparecen** en él. No se muestran vacías
ni fingen hacer algo.

| Sección | macOS | Windows | Notas |
| --- | :---: | :---: | --- |
| Inicio (telemetría en vivo) | ✅ | ✅ | Temperatura solo si hay sensores accesibles |
| Liberar espacio | ✅ | ✅ | En Windows: temporales, cachés de navegador, npm, pnpm, NuGet, Gradle, modelos de IA y Papelera |
| Almacenamiento | ✅ | ✅ | El desglose por volúmenes APFS es exclusivo de macOS |
| Explorador | ✅ | ✅ | Revela en Finder o en el Explorador según el sistema |
| Duplicados | ✅ | ✅ | Compara por contenido (SHA-256), no por nombre |
| Aplicaciones | ✅ | ✅ | En Windows lee el registro y llama al desinstalador oficial de cada programa |
| Memoria | ✅ | ✅ | La purga de memoria inactiva solo existe en macOS |
| Tareas | ✅ | ✅ | `launchd` en macOS, Programador de tareas en Windows |
| Instantáneas | ✅ | — | Copias locales de Time Machine: concepto exclusivo de APFS |
| .DS_Store | ✅ | — | Esos archivos los crea el Finder de macOS |

---

## Verificar la descarga

No hace falta que confíes en nuestra palabra. Hay tres formas de comprobarlo, de menos a más
esfuerzo:

**1. Leer el código.** Todo el código fuente está en
[este repositorio](https://github.com/zodhub-app/clean). Puedes revisar exactamente qué hace
el programa, incluidas las peticiones de red.

**2. Analizar el archivo.** Sube el instalador a
[VirusTotal](https://www.virustotal.com/gui/home/upload) y verás el resultado de más de setenta
motores antivirus.

**3. Comparar la huella SHA-256** con la publicada en la página de la versión:

```bash
# macOS
shasum -a 256 ~/Downloads/ZodHub.CleanPC_0.2.0_universal.dmg
```

```powershell
# Windows
Get-FileHash .\ZodHub.CleanPC_0.2.0_x64-setup.exe -Algorithm SHA256
```

Si el resultado coincide, el archivo es exactamente el que publicamos y nadie lo ha alterado
por el camino.

---

## Desinstalar

**macOS** — arrastra ZodHub CleanPC de *Aplicaciones* a la Papelera. Sus preferencias quedan en
`~/Library/Application Support/com.viper.macup`; puedes borrar esa carpeta si quieres no dejar
rastro. Si programaste tareas, quítalas antes desde la sección *Tareas* para que no queden
agentes de `launchd` huérfanos.

**Windows** — *Configuración → Aplicaciones → Aplicaciones instaladas → ZodHub CleanPC →
Desinstalar*. Sus preferencias quedan en `%APPDATA%\com.viper.macup`. Igual que en macOS,
conviene desactivar antes las tareas programadas.

---

## Problemas frecuentes

**«La app está dañada y debería moverse a la papelera» (macOS).**
Suele ocurrir si el `.dmg` se descargó a medias o si el navegador le puso el atributo de
cuarentena. Vuelve a descargarlo desde la página de versiones. Si persiste, en el Terminal:
`xattr -dr com.apple.quarantine /Applications/ZodHub\ CleanPC.app`.

**El instalador de Windows no arranca.**
Comprueba que descargaste el `-setup.exe` completo (el tamaño debe coincidir con el de la
página de versiones) y que tu Windows es de 64 bits. En equipos gestionados por una empresa,
puede haber una directiva que bloquee software no firmado; en ese caso habla con quien
administre el equipo.

**«Liberar espacio» dice que quedaron elementos en uso.**
Es lo normal y no es un fallo. Las carpetas temporales siempre tienen archivos abiertos por
otros programas; la app limpia todo lo demás y te dice cuántos ha dejado intactos. Cierra los
programas que no uses y vuelve a pasarla si quieres afinar más.

**No aparece la sección Instantáneas o .DS_Store.**
Correcto: solo existen en macOS. Ver [Qué hace cada sistema](#qué-hace-cada-sistema).

**La campana dice «No se pudo comprobar».**
No hay conexión a internet, o un cortafuegos bloquea el acceso a GitHub. La app prefiere
decirlo a dar por hecho que estás al día.

---

¿Algo que esta guía no resuelve? Abre un asunto en
[el repositorio](https://github.com/zodhub-app/clean/issues) o escribe a `info@zodhub.com`.

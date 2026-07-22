import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Bell,
  Bug,
  ChevronDown,
  Code2,
  Coffee,
  FileText,
  Gauge,
  Github,
  Globe,
  Globe2,
  Heart,
  HeartHandshake,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  Newspaper,
  Scale,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/language-provider";
import { useUpdates } from "@/components/updates-provider";
import { subscribe, subscribeAvailable } from "@/lib/api";
import { openUrl } from "@/lib/links";
import { DonatePanel } from "@/components/donate-panel";

/** Enlaces públicos del proyecto. Un único sitio donde cambiarlos. */
const LINKS = {
  web: "https://zodhub.app",
  donate: "https://zodhub-app.github.io/pulse/donar.html",
  privacy: "https://zodhub-app.github.io/pulse/privacidad.html",
  terms: "https://zodhub-app.github.io/pulse/terminos.html",
  repo: "https://github.com/zodhub-app/pulse",
  releases: "https://github.com/zodhub-app/pulse/releases",
  issues: "https://github.com/zodhub-app/pulse/issues",
  shareX:
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent("ZodHub Pulse — mantenimiento honesto para tu equipo, 100% gratis") +
    "&url=" +
    encodeURIComponent("https://zodhub.app"),
  shareLinkedin:
    "https://www.linkedin.com/sharing/share-offsite/?url=" +
    encodeURIComponent("https://zodhub.app"),
};

export function AccountPage() {
  const { t } = useLang();

  return (
    <div className="space-y-2.5">
      <Hero />

      <Tabs defaultValue="novedades" className="w-full gap-2.5">
        {/* El componente Tabs trae por defecto "gap-2" entre la lista y el
            contenido; lo pisamos a 2.5 para que sea EXACTAMENTE el mismo
            hueco que separa la Cabecera de los tabs (`space-y-2.5` del
            contenedor), y quitamos el mt-2.5 duplicado que llevaba cada
            TabsContent (sumaba un hueco mayor y descuadraba la simetría). */}
        {/* Borde de la pestaña activa: el mismo hairline translúcido que el resto
            de la app (no el `border-input`, más sólido, que traía por defecto). */}
        <TabsList className="w-full">
          <TabsTrigger
            value="novedades"
            className="data-[state=active]:border-foreground/[0.07] dark:data-[state=active]:border-foreground/[0.07]"
          >
            <Newspaper className="size-4" />
            {t("Novedades")}
          </TabsTrigger>
          <TabsTrigger
            value="correo"
            className="data-[state=active]:border-foreground/[0.07] dark:data-[state=active]:border-foreground/[0.07]"
          >
            <Bell className="size-4" />
            {t("Suscripción")}
          </TabsTrigger>
          <TabsTrigger
            value="apoyar"
            className="data-[state=active]:border-foreground/[0.07] dark:data-[state=active]:border-foreground/[0.07]"
          >
            <Heart className="size-4" />
            {t("Apoyar")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novedades">
          {/* 60/40: el hilo de novedades a la izquierda; a la derecha, la
              tarjeta "Sobre ZodHub Pulse" (antes un modal aparte), alineada
              arriba con el hilo (items-start) y fija (sticky) para que solo
              el hilo se mueva al hacer scroll. */}
          <div className="grid items-start gap-2.5 lg:grid-cols-[3fr_2fr]">
            <Changelog />
            <AboutCard />
          </div>
        </TabsContent>

        <TabsContent value="correo">
          <SubscribeTab />
        </TabsContent>

        <TabsContent value="apoyar">
          <SupportTab />
        </TabsContent>
      </Tabs>

      <p className="px-1 pb-1 text-center text-xs text-muted-foreground">
        {t("Hecho con cuidado. Tu equipo, sencillamente limpio y seguro.")}
      </p>
    </div>
  );
}

/* ─────────────────────────────── Cabecera ─────────────────────────────── */

function Hero() {
  const { t } = useLang();
  const u = useUpdates();

  const state =
    u.status === "available"
      ? t("Hay una versión nueva disponible")
      : u.status === "uptodate"
        ? t("Estás al día")
        : u.status === "checking" || u.status === "idle"
          ? t("Comprobando actualizaciones…")
          : t("No se pudo comprobar");

  return (
    <div data-slot="card" className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-medium leading-tight">ZodHub Pulse</h2>
          <p className="text-sm text-muted-foreground">
            {u.currentVersion ? `v${u.currentVersion} · ` : ""}
            {state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openUrl(LINKS.web)}>
            <Globe className="size-4" />
            {t("Visitar la web")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openUrl(LINKS.repo)}>
            <Github className="size-4" />
            {t("Ver en GitHub")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Tab 1 · Muro de novedades (hilo) ─────────────────── */

type Update = {
  v: string;
  date: string;
  title: string;
  body: string;
  more?: string;
};

function Changelog() {
  const { t } = useLang();
  const [open, setOpen] = useState<string | null>(null);

  // Historial de mejoras. Cada entrada resume, en pocas líneas, qué se trajo a
  // la app; las que dan para más, se despliegan como acordeón. Contenido real
  // (funciones que existen), redactado para que el usuario entienda el valor.
  const items: Update[] = [
    {
      v: "0.2.5",
      date: t("22 jul 2026"),
      title: t("Donaciones dentro de la app y «Tu espacio» reorganizado"),
      body: t(
        "Ya puedes apoyar el proyecto pagando con tarjeta sin salir de la app, y «Tu espacio» se organiza en pestañas (Novedades, Suscripción, Apoyar) con un muro de novedades como este.",
      ),
      more: t(
        "Además, cada pestaña recuerda sus datos y se abre al instante al volver (con auto-refresco opcional cada 24 h en Ajustes), la barra superior es más compacta y la app estrena el tema «Elegant Luxury» por defecto.",
      ),
    },
    {
      v: "0.2.4",
      date: t("21 jul 2026"),
      title: t("Aviso de disco lleno y vigilante en segundo plano"),
      body: t(
        "Ahora la app vigila tu disco y te avisa —con una notificación del sistema— antes de que te quedes sin espacio, aunque la ventana esté cerrada en la barra.",
      ),
      more: t(
        "Comprueba el espacio cada media hora y, si el disco suelta mucho de golpe, te lo explica: es «basura del sistema» que macOS acumula y libera sola, no la limpieza de la app. Así el número de Inicio y el del disco dejan de contradecirse.",
      ),
    },
    {
      v: "0.2.3",
      date: t("19 jul 2026"),
      title: t("Mapa real de tu disco en Almacenamiento"),
      body: t(
        "El panel de Almacenamiento ya no muestra una lista de basura que no cuadraba: ahora ves dónde está de verdad tu espacio, con tus carpetas reales, y las barras suman el total usado.",
      ),
      more: t(
        "Mide tu carpeta de usuario como lo haría el sistema (Proyectos, Recursos, Library…), añade Aplicaciones y el resto del sistema, y lo ordena de mayor a menor. Para bajar al detalle carpeta a carpeta, tienes el Explorador.",
      ),
    },
    {
      v: "0.2.2",
      date: t("19 jul 2026"),
      title: t("Limpieza con permisos de administrador"),
      body: t(
        "Añadido un botón que, con tu contraseña, vacía las cachés y logs del sistema (de root) que la limpieza normal no puede tocar, y te dice los GB reales que libera.",
      ),
    },
    {
      v: "0.2.1",
      date: t("19 jul 2026"),
      title: t("Limpieza más clara y honesta en Inicio"),
      body: t(
        "El estimado de «Liberar espacio» ahora enseña de qué se compone (cachés, npm, logs, Papelera…), así el número no aparece de la nada y cuadra con lo que de verdad se elimina.",
      ),
    },
    {
      v: "0.2.0",
      date: t("19 jul 2026"),
      title: t("Buscador de duplicados por contenido"),
      body: t(
        "Encuentra archivos idénticos comparando su contenido real (huella SHA-256), no solo el nombre. Nunca borra nada: te muestra los grupos y decides tú.",
      ),
      more: t(
        "Primero agrupa por tamaño (rapidísimo) y solo calcula la huella de los candidatos. Distingue los clones de APFS y los enlaces duros, que comparten disco, para no prometerte un espacio recuperable que no existe.",
      ),
    },
    {
      v: "0.1.5",
      date: t("12 jul 2026"),
      title: t("Desinstalador de aplicaciones"),
      body: t(
        "Lista tus apps con su peso y la basura que dejan (cachés, soportes, preferencias) y las desinstala del todo, sin restos olvidados por el sistema.",
      ),
    },
    {
      v: "0.1.4",
      date: t("12 jul 2026"),
      title: t("Instantáneas locales de Time Machine"),
      body: t(
        "Un panel para ver y liberar las copias locales que macOS guarda en tu disco aunque no tengas disco externo, y que suelen ocupar espacio «que aparece sin motivo».",
      ),
    },
    {
      v: "0.1.3",
      date: t("12 jul 2026"),
      title: t("Radar de red y monitor del sistema en vivo"),
      body: t(
        "Inicio muestra CPU, memoria, disco y temperatura en tiempo real, más un radar de red honesto cuya intensidad usa la actividad real de tu equipo.",
      ),
    },
    {
      v: "0.1.2",
      date: t("12 jul 2026"),
      title: t("Explorador de archivos y carpetas grandes"),
      body: t(
        "Recorre cualquier carpeta y te enseña qué ocupa más, ordenado por tamaño, para encontrar de un vistazo lo que llena el disco. Puedes abrir en Finder o mover a la Papelera.",
      ),
    },
    {
      v: "0.1.0",
      date: t("12 jul 2026"),
      title: t("Limpieza de .DS_Store y «Comprimir limpio»"),
      body: t(
        "Barre los .DS_Store que macOS esparce por tus carpetas y comprime en .zip sin metadatos ni __MACOSX, ideal para compartir con Windows o Linux.",
      ),
      more: t(
        "Puedes también evitar que se creen .DS_Store en unidades de red. Todo se hace en local, en tu equipo, sin enviar nada a ningún servidor.",
      ),
    },
  ];

  return (
    <div data-slot="card" className="rounded-lg border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Newspaper className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("Lo último que hemos traído")}</h3>
      </header>

      <ol className="relative">
        {items.map((it, i) => {
          const isOpen = open === it.v;
          const last = i === items.length - 1;
          return (
            <li key={it.v} className="relative flex gap-3">
              {/* Hilo continuo: la línea se posiciona sobre el <li> y se prolonga
                  por debajo (-bottom) hasta alcanzar el punto del item siguiente,
                  cruzando el hueco entre tarjetas. En el último item no hay línea. */}
              {!last && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-[5px] top-3 -bottom-3 w-px -translate-x-1/2 bg-foreground/20"
                />
              )}
              <div className="relative z-10 flex w-2.5 shrink-0 justify-center pt-1.5">
                <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
              </div>

              <article
                className={cn(
                  "min-w-0 flex-1 rounded-lg border border-foreground/[0.07] bg-background/40 p-3.5",
                  !last && "mb-3",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                    v{it.v}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{it.date}</span>
                </div>
                <h4 className="mt-1.5 text-sm font-semibold leading-snug">
                  {it.title}
                </h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {it.body}
                </p>

                {it.more && (
                  <>
                    {isOpen && (
                      <p className="mt-2 border-t border-foreground/[0.07] pt-2 text-xs leading-5 text-muted-foreground">
                        {it.more}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : it.v)}
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      {isOpen ? t("Ver menos") : t("Ver más")}
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      <Separator className="my-4" />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => openUrl(LINKS.releases)}
      >
        <FileText className="size-4" />
        {t("Ver historial completo de versiones")}
      </Button>
    </div>
  );
}

/* ──────────── Tab 1 · Tarjeta "Sobre ZodHub Pulse" (antes un modal) ────── */

function AboutFeature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  );
}

/** Antes vivía en un modal aparte (botón "i" de Inicio). Ahora es la tarjeta
 *  fija (sticky) junto al hilo de novedades: misma información, siempre a la
 *  vista, y con la versión leída en vivo (nunca escrita a mano). */
function AboutCard() {
  const { t } = useLang();
  const u = useUpdates();

  return (
    // El sticky va en este div ENVOLVENTE, no en el de data-slot="card": el
    // skin Hera define `[data-slot="card"] { position: relative }` con más
    // especificidad CSS que la utilidad `.lg:sticky`, así que puesto en el
    // propio card el "relative" del skin siempre ganaba y el sticky no hacía
    // nada. Envolviendo, el hijo con data-slot="card" mantiene su estilo de
    // cristal intacto y el "sticky" (en un elemento sin ese atributo) manda.
    <div className="lg:sticky lg:top-2.5 lg:self-start">
      <div data-slot="card" className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="logo-badge flex size-10 shrink-0 items-center justify-center rounded-xl text-white">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="gradient-text text-base font-semibold leading-tight">
              ZodHub Pulse
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {t("Tu equipo, sencillamente limpio y seguro.")}
            </p>
          </div>
        </div>

        <p className="mt-3.5 text-xs leading-5 text-muted-foreground">
          {t(
            "ZodHub Pulse es una utilidad de mantenimiento para tu equipo, directa y sin humo: limpia cachés, libera espacio y automatiza el mantenimiento en Mac, Windows y Linux. Lo esencial, bien hecho.",
          )}
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <AboutFeature
            icon={<Sparkles className="size-3.5" />}
            title={t("Sencillo de verdad")}
          >
            {t(
              "Solo las operaciones que tu equipo necesita para ir fino. Sin menús interminables ni funciones de relleno.",
            )}
          </AboutFeature>
          <AboutFeature
            icon={<Lock className="size-3.5" />}
            title={t("Privado y en local")}
          >
            {t(
              "Todo se ejecuta en tu equipo. Tus archivos y métricas nunca se suben a la nube. Cero telemetría por defecto.",
            )}
          </AboutFeature>
          <AboutFeature
            icon={<Gauge className="size-3.5" />}
            title={t("Transparente")}
          >
            {t(
              "Te enseña qué va a hacer y con qué datos antes de tocar nada. Sin cajas negras: lo que ves es lo que pasa.",
            )}
          </AboutFeature>
          <AboutFeature
            icon={<HeartHandshake className="size-3.5" />}
            title={t("¿Por qué ZodHub Pulse?")}
          >
            {t(
              "Ligera, clara y respetuosa con tus datos, frente a los limpiadores pesados llenos de avisos y suscripciones. Hace lo justo, y lo hace bien.",
            )}
          </AboutFeature>
        </div>

        <p className="mt-4 border-t border-foreground/[0.07] pt-3 text-[11px] leading-5 text-muted-foreground">
          {t(
            "Nota honesta: ZodHub Pulse no es un antivirus ni un cortafuegos. El radar de red representa el ruido constante de escaneos de internet que recibe cualquier equipo conectado; su intensidad, en vivo, refleja la actividad real de tu red para mantenerte al tanto de lo que pasa de puertas afuera.",
          )}
          {u.currentVersion ? ` · ${t("Versión")} ${u.currentVersion}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────── Tab 2 · Suscripción (form + info) ──────────────────── */

function SubscribeTab() {
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 lg:grid-cols-[1.1fr_0.9fr]">
        <Subscribe />
        <SubscribeInfo />
      </div>
      <LegalFooter />
    </div>
  );
}

function SubscribeInfo() {
  const { t } = useLang();
  const points: Array<{ icon: typeof Sparkles; title: string; desc: string }> = [
    {
      icon: Sparkles,
      title: t("Funciones nuevas primero"),
      desc: t("Te contamos las mejoras que valen la pena en cuanto salen."),
    },
    {
      icon: ShieldCheck,
      title: t("Solo lo importante"),
      desc: t("Sin spam ni correos de relleno: escribimos poco y con motivo."),
    },
    {
      icon: Mail,
      title: t("Baja cuando quieras"),
      desc: t("Un clic y fuera. Tus datos son tuyos, siempre."),
    },
  ];
  return (
    <section data-slot="card" className="relative overflow-hidden rounded-lg border bg-card p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl"
      />
      <header className="relative mb-3 flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("¿Por qué suscribirte?")}</h3>
      </header>
      <div className="relative space-y-3">
        {points.map((p) => (
          <div key={p.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <p.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium leading-tight">{p.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {p.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Separator className="relative my-4" />
      <p className="relative text-xs leading-5 text-muted-foreground">
        {t(
          "La app se actualiza sola: suscribirte es solo para enterarte de las novedades, nunca un requisito.",
        )}
      </p>
    </section>
  );
}

/* ────────────────────────────── Suscripción ────────────────────────────── */

function Subscribe() {
  const { t } = useLang();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    subscribeAvailable()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const emailOk = email.includes("@") && email.includes(".") && email.length > 4;
  const canSend = emailOk && consent && !sending;

  async function onSubmit() {
    setSending(true);
    try {
      await subscribe(name, email);
      setDone(true);
      toast.success(t("¡Suscripción completada!"));
    } catch (e) {
      toast.error(t("No se pudo completar la suscripción"), {
        description: String(e),
      });
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section data-slot="card" className="flex flex-col items-center justify-center rounded-lg border bg-card p-5 text-center">
        <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <BadgeCheck className="size-5" />
        </span>
        <p className="text-sm font-medium">{t("¡Gracias por suscribirte!")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Te escribiremos solo cuando haya algo que merezca la pena.")}
        </p>
      </section>
    );
  }

  return (
    <section data-slot="card" className="rounded-lg border bg-card p-5">
      <header className="mb-1 flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("Novedades por correo")}</h3>
      </header>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        {t(
          "Si quieres, te avisamos de las funciones nuevas y las mejoras importantes. Es completamente opcional: la app ya se actualiza sola sin necesidad de esto.",
        )}
      </p>

      {available === false ? (
        <p className="rounded-lg bg-black/10 p-3 text-xs text-muted-foreground">
          {t("La suscripción no está disponible por ahora.")}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name" className="text-xs">
                {t("Nombre (opcional)")}
              </Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Tu nombre")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-email" className="text-xs">
                {t("Correo electrónico")}
              </Label>
              <Input
                id="sub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </div>
          </div>

          {/* Consentimiento explícito y SIN premarcar (requisito del RGPD). */}
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              {t(
                "Acepto recibir novedades de ZodHub Pulse y he leído la política de privacidad. Puedo darme de baja cuando quiera.",
              )}
            </span>
          </label>

          <Button className="w-full" disabled={!canSend} onClick={onSubmit}>
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("Enviando…")}
              </>
            ) : (
              <>
                <Mail className="size-4" />
                {t("Suscribirme")}
              </>
            )}
          </Button>

          {/* Matiz de honestidad: la app no envía nada por su cuenta. */}
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            {t(
              "ZodHub Pulse no envía ningún dato de tu equipo. Lo único que sale de aquí es lo que escribas arriba, y solo si pulsas Suscribirme.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── Tab 3 · Apoyar ────────────────────────────── */

function SupportTab() {
  const { t } = useLang();

  const spend: Array<{
    pct: number;
    label: string;
    desc: string;
    icon: typeof Server;
  }> = [
    {
      pct: 45,
      label: t("Servidor y CDN"),
      desc: t("Alojar y servir las descargas rápido en todo el mundo."),
      icon: Server,
    },
    {
      pct: 35,
      label: t("Desarrollo"),
      desc: t("Horas para funciones nuevas, Linux y Windows."),
      icon: Code2,
    },
    {
      pct: 10,
      label: t("Dominio"),
      desc: t("Mantener zodhub.app y los correos activos."),
      icon: Globe2,
    },
    {
      pct: 10,
      label: t("Café e imprevistos"),
      desc: t("Lo que mantiene despierto a quien lo programa."),
      icon: Coffee,
    },
  ];

  const free: Array<{ icon: typeof Share2; label: string; url: string }> = [
    { icon: Share2, label: t("Compártelo en X"), url: LINKS.shareX },
    { icon: Linkedin, label: t("Compártelo en LinkedIn"), url: LINKS.shareLinkedin },
    { icon: Bug, label: t("Reporta un fallo"), url: LINKS.issues },
  ];

  return (
    <div className="space-y-2.5">
      {/* Módulo de donación (selector + meta del mes), pago dentro de la app. */}
      <DonatePanel />

      <div className="grid gap-2.5 lg:grid-cols-2">
        {/* A dónde va cada euro. */}
        <section data-slot="card" className="rounded-lg border bg-card p-5">
          <header className="mb-1 flex items-center gap-2">
            <Scale className="size-4 text-primary" />
            <h3 className="text-sm font-medium">{t("A dónde va cada euro")}</h3>
          </header>
          <p className="mb-4 text-xs leading-5 text-muted-foreground">
            {t("Sin sueldos millonarios ni humo. Esto es lo que sostiene el proyecto:")}
          </p>
          <div className="space-y-3">
            {spend.map((s) => (
              <div key={s.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <s.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{s.label}</p>
                    <span className="text-xs font-semibold tabular-nums text-primary">
                      {s.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ayudar es gratis. */}
        <section data-slot="card" className="rounded-lg border bg-card p-5">
          <header className="mb-1 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-medium">{t("¿Sin presupuesto? Igual ayudas")}</h3>
          </header>
          <p className="mb-4 text-xs leading-5 text-muted-foreground">
            {t("Ayudar es gratis. Cualquiera de estas suma un montón:")}
          </p>
          <div className="space-y-1.5">
            {free.map((f) => (
              <button
                key={f.label}
                onClick={() => openUrl(f.url)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-foreground/[0.07] px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
              >
                <f.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{f.label}</span>
                <ChevronDown className="size-3.5 -rotate-90 text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t("Donéis o no, gracias por usar ZodHub Pulse. De verdad.")}
          </p>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────── Pie · Acerca de y legal ───────────────────── */

function LegalFooter() {
  const { t } = useLang();
  const rows: Array<{ icon: typeof FileText; label: string; url: string }> = [
    { icon: ShieldCheck, label: t("Política de privacidad"), url: LINKS.privacy },
    { icon: FileText, label: t("Términos de uso"), url: LINKS.terms },
    { icon: Scale, label: t("Licencia y atribuciones"), url: LINKS.repo },
  ];

  return (
    <section data-slot="card" className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Scale className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("Acerca de")}</h3>
      </header>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.label}
            onClick={() => openUrl(r.url)}
            className="flex items-center gap-2 rounded-lg border border-foreground/[0.07] px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
          >
            <r.icon className="size-4 shrink-0 text-muted-foreground" />
            <span>{r.label}</span>
          </button>
        ))}
      </div>
      <Separator className="my-3" />
      <p className="text-xs leading-5 text-muted-foreground">
        {t(
          "ZodHub Pulse funciona en local: los análisis y las limpiezas se hacen en tu equipo y no se envía información a ningún servidor.",
        )}
      </p>
    </section>
  );
}

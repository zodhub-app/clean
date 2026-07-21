import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bell,
  FileText,
  Heart,
  Loader2,
  Mail,
  Newspaper,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLang } from "@/components/language-provider";
import { useUpdates } from "@/components/updates-provider";
import { subscribe, subscribeAvailable } from "@/lib/api";
import { openUrl } from "@/lib/links";
import { DonateDialog } from "@/components/donate-dialog";

/** Enlaces públicos del proyecto. Un único sitio donde cambiarlos. */
const LINKS = {
  web: "https://zodhub-app.github.io/pulse/",
  donate: "https://zodhub-app.github.io/pulse/donar.html",
  privacy: "https://zodhub-app.github.io/pulse/privacidad.html",
  terms: "https://zodhub-app.github.io/pulse/terminos.html",
  repo: "https://github.com/zodhub-app/pulse",
  releases: "https://github.com/zodhub-app/pulse/releases",
};

export function AccountPage() {
  const { t } = useLang();

  return (
    <div className="space-y-2.5">
      <Hero />
      <div className="grid gap-2.5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-2.5">
          <News />
          <Subscribe />
        </div>
        <div className="space-y-2.5">
          <Support />
          <Legal />
        </div>
      </div>
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
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-medium leading-tight">ZodHub Pulse</h2>
          <p className="text-sm text-muted-foreground">
            {u.currentVersion ? `v${u.currentVersion} · ` : ""}
            {state}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => openUrl(LINKS.web)}>
          {t("Visitar la web")}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Novedades ─────────────────────────────── */

function News() {
  const { t } = useLang();
  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Newspaper className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("Novedades")}</h3>
      </header>

      {/* Honestidad: mientras no haya un canal de novedades real, no inventamos
          contenido de relleno. Se explica qué es esto y se enlaza al historial
          de versiones, que sí es información verdadera y útil. */}
      <p className="text-sm leading-6 text-muted-foreground">
        {t(
          "Aquí aparecerán las novedades del proyecto: funciones nuevas, mejoras y avisos importantes. Mientras tanto, puedes ver todos los cambios publicados en el historial de versiones.",
        )}
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => openUrl(LINKS.releases)}
      >
        {t("Ver historial de versiones")}
      </Button>
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
      <section className="rounded-xl border bg-card p-5 text-center">
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
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-1 flex items-center gap-2">
        <Bell className="size-4 text-primary" />
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
                placeholder={t("Cómo quieres que te llamemos")}
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

/* ──────────────────────────────── Apoyar ──────────────────────────────── */

function Support() {
  const { t } = useLang();
  const [donateOpen, setDonateOpen] = useState(false);
  return (
    <section className="relative overflow-hidden rounded-xl border bg-card p-5">
      {/* Halo suave, en la línea del módulo de la web. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-rose-500/15 blur-3xl"
      />
      <header className="relative mb-1 flex items-center gap-2">
        <Heart className="size-4 text-rose-500" />
        <h3 className="text-sm font-medium">{t("Apoya el proyecto")}</h3>
      </header>
      <p className="relative mb-4 text-sm leading-6 text-muted-foreground">
        {t(
          "ZodHub Pulse es gratis, sin anuncios y sin suscripciones. Si te resulta útil y quieres que siga creciendo, puedes echar una mano.",
        )}
      </p>
      <Button
        className="relative w-full bg-rose-500 text-white hover:bg-rose-600"
        onClick={() => setDonateOpen(true)}
      >
        <Heart className="size-4" />
        {t("Hacer una donación")}
      </Button>
      <p className="relative mt-2.5 text-center text-xs text-muted-foreground">
        {t("Pago seguro con tarjeta, dentro de la app. Sin compromiso ni cuotas.")}
      </p>
      <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} />
    </section>
  );
}

/* ───────────────────────────── Acerca de y legal ───────────────────────── */

function Legal() {
  const { t } = useLang();
  const rows: Array<{ icon: typeof FileText; label: string; url: string }> = [
    { icon: ShieldCheck, label: t("Política de privacidad"), url: LINKS.privacy },
    { icon: FileText, label: t("Términos de uso"), url: LINKS.terms },
    { icon: Scale, label: t("Licencia y atribuciones"), url: LINKS.repo },
  ];

  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Scale className="size-4 text-primary" />
        <h3 className="text-sm font-medium">{t("Acerca de y legal")}</h3>
      </header>
      <div className="space-y-1">
        {rows.map((r) => (
          <button
            key={r.label}
            onClick={() => openUrl(r.url)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/5"
          >
            <r.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{r.label}</span>
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

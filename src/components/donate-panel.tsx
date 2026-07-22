import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Coffee, CreditCard, Heart, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/language-provider";
import { createDonationIntent } from "@/lib/api";

// Importes sugeridos, en unidades menores (céntimos): 3 €, 5 €, 10 €, 25 €.
const AMOUNTS = [300, 500, 1000, 2500] as const;

// loadStripe cachea por publishable key: no recargamos el script en cada uso.
const stripeByKey = new Map<string, Promise<Stripe | null>>();
function stripeFor(pk: string): Promise<Stripe | null> {
  let p = stripeByKey.get(pk);
  if (!p) {
    p = loadStripe(pk);
    stripeByKey.set(pk, p);
  }
  return p;
}

function euros(minor: number): string {
  const n = minor / 100;
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;
}

/** Paso de pago: tarjeta (Stripe Elements) + confirmación, todo dentro de la app. */
function PaymentStep({
  amountLabel,
  onDone,
  onBack,
}: {
  amountLabel: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = useLang();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    // redirect:"if_required" resuelve el 3DS en línea, dentro del WebView, sin
    // salir de la app. La tarjeta la maneja el iframe seguro de Stripe.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? t("No se pudo completar el pago."));
      return;
    }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      toast.success(t("¡Gracias por tu apoyo!"));
      onDone();
    } else {
      toast.error(t("El pago no se completó."));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("Pago seguro con tarjeta, dentro de la app.")}
      </p>
      <PaymentElement />
      <Button
        className="w-full bg-rose-500 text-white hover:bg-rose-600"
        disabled={busy || !stripe}
        onClick={pay}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
        {busy ? t("Procesando…") : t("Donar {s}", { s: amountLabel })}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {t("Cambiar importe")}
      </button>
    </div>
  );
}

/** Módulo de donaciones inline (selector + meta del mes), con pago en la app. */
export function DonatePanel() {
  const { t } = useLang();
  const [freq, setFreq] = useState<"once" | "monthly">("once");
  const [amount, setAmount] = useState<number>(500);
  const [custom, setCustom] = useState("");
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pk, setPk] = useState<string | null>(null);

  // Importe efectivo: la cantidad personalizada manda si es válida (≥ 1 €).
  const customMinor = Math.round(
    parseFloat(custom.replace(",", ".").replace(/[^\d.]/g, "")) * 100,
  );
  const usingCustom = custom.trim() !== "" && customMinor >= 100;
  const effective = usingCustom ? customMinor : amount;

  async function donate() {
    setBusy(true);
    try {
      const r = await createDonationIntent(effective, { frequency: freq });
      setPk(r.publishableKey);
      setClientSecret(r.clientSecret);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "donations_closed") {
        setClosed(true);
      } else if (
        msg === "stripe_not_configured" ||
        msg === "stripe_publishable_key_missing"
      ) {
        // No es fallo de la app: el pago no está configurado en el servidor.
        toast.error(t("El pago no está configurado en el servidor todavía."));
      } else {
        // Mostramos el detalle del backend (no un genérico) para poder diagnosticar.
        toast.error(t("No se pudo iniciar la donación. Inténtalo de nuevo."), {
          description: msg || undefined,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setClientSecret(null);
    setPk(null);
  }

  const ready = clientSecret && pk;

  return (
    <div className="grid gap-2.5 lg:grid-cols-[1.35fr_1fr]">
      {/* Izquierda: selector de importe o, tras elegir, el pago. */}
      <section data-slot="card" className="rounded-lg border bg-card p-5">
        {ready ? (
          <Elements
            stripe={stripeFor(pk as string)}
            options={{ clientSecret: clientSecret as string, locale: "es" }}
          >
            <PaymentStep
              amountLabel={euros(effective)}
              onDone={reset}
              onBack={reset}
            />
          </Elements>
        ) : (
          <>
            {/* Toggle Una vez / Cada mes. */}
            <div className="inline-flex rounded-full bg-muted p-1 text-sm">
              {(["once", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-medium transition-colors",
                    freq === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f === "once" ? t("Una vez") : t("Cada mes")}
                </button>
              ))}
            </div>

            {/* Importes sugeridos. */}
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {AMOUNTS.map((a) => {
                const active = !usingCustom && amount === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAmount(a);
                      setCustom("");
                    }}
                    className={cn(
                      "rounded-lg border py-3 text-center text-base font-semibold tabular-nums transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/[0.07] text-foreground hover:bg-white/5",
                    )}
                  >
                    {euros(a)}
                  </button>
                );
              })}
            </div>

            {/* Otra cantidad. */}
            <div className="relative mt-2.5">
              <Pencil className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                inputMode="decimal"
                placeholder={t("Otra cantidad")}
                className={cn(
                  "w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-8 text-sm outline-none transition-colors",
                  usingCustom
                    ? "border-primary"
                    : "border-foreground/[0.07] focus:border-primary",
                )}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>

            {/* Botón de donar. */}
            <Button
              className="mt-4 w-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-70"
              disabled={closed || busy}
              onClick={donate}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Heart className="size-4" />
              )}
              {closed
                ? t("Donaciones aún no abiertas")
                : busy
                  ? t("Iniciando…")
                  : t("Donar {s}", { s: euros(effective) })}
            </Button>

            {/* Métodos. */}
            <div className="mt-4 flex items-center gap-2.5 text-xs text-muted-foreground">
              <span>{t("Métodos disponibles:")}</span>
              <CreditCard className="size-4" />
              <Coffee className="size-4" />
              <Heart className="size-4" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t(
                "Pago seguro a través del proveedor. Sin recompensas de pago ni funciones bloqueadas: donar no desbloquea nada, solo nos ayuda a seguir.",
              )}
            </p>
          </>
        )}
      </section>

      {/* Derecha: meta del mes (tarjeta oscura de acento, como en la web). */}
      <section className="rounded-lg border border-white/10 bg-[#0e1526] p-5 text-slate-100">
        <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300/80">
          {t("Meta del mes · Costes")}
        </p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="text-4xl font-semibold leading-none tabular-nums">64%</span>
          <span className="text-sm tabular-nums text-slate-400">128 € / 200 €</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
            style={{ width: "64%" }}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {t(
            "Esto cubre el servidor de descargas, el dominio y las horas de desarrollo. Cuando llegamos a la meta, todo lo demás va a mejorar la app.",
          )}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          {t("Cifras de ejemplo; publicaremos las reales en cuanto abramos donaciones.")}
        </p>
      </section>
    </div>
  );
}

export default DonatePanel;

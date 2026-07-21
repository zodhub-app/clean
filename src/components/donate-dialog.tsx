import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createDonationIntent } from "@/lib/api";

// Importes en unidades menores (céntimos): 3 €, 5 €, 10 €, 25 €.
const AMOUNTS = [300, 500, 1000, 2500] as const;

// loadStripe cachea por publishable key: no recargamos el script en cada apertura.
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
  return `${(minor / 100).toLocaleString("es-ES")} €`;
}

function PaymentStep({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    // redirect:"if_required" resuelve el reto 3DS en línea, dentro del WebView,
    // sin navegación externa. La tarjeta la maneja el iframe de Stripe.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "No se pudo completar el pago.");
      return;
    }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      toast.success("¡Gracias por tu apoyo! 💙");
      onDone();
    } else {
      toast.error("El pago no se completó.");
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <Button
        className="w-full bg-rose-500 text-white hover:bg-rose-600"
        disabled={busy || !stripe}
        onClick={pay}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
        {busy ? "Procesando…" : "Donar"}
      </Button>
    </div>
  );
}

export function DonateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pk, setPk] = useState<string | null>(null);
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);

  function close() {
    onOpenChange(false);
    setClientSecret(null);
    setPk(null);
    setLoadingAmount(null);
  }

  async function choose(amountMinor: number) {
    setLoadingAmount(amountMinor);
    try {
      const r = await createDonationIntent(amountMinor);
      setPk(r.publishableKey);
      setClientSecret(r.clientSecret);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg === "donations_closed"
          ? "Las donaciones aún no están abiertas."
          : "No se pudo iniciar la donación. Inténtalo de nuevo.",
      );
    } finally {
      setLoadingAmount(null);
    }
  }

  if (!open) return null;
  const ready = clientSecret && pk;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-1 flex items-center gap-2">
          <Heart className="size-4 text-rose-500" />
          <h3 className="text-base font-medium">Apoya ZodHub Pulse</h3>
        </header>
        <p className="mb-5 text-sm text-muted-foreground">
          Pago seguro con tarjeta, dentro de la app. Elige un importe:
        </p>

        {!ready ? (
          <div className="grid grid-cols-2 gap-2.5">
            {AMOUNTS.map((a) => (
              <Button
                key={a}
                variant="outline"
                disabled={loadingAmount !== null}
                onClick={() => choose(a)}
              >
                {loadingAmount === a ? <Loader2 className="size-4 animate-spin" /> : euros(a)}
              </Button>
            ))}
          </div>
        ) : (
          <Elements
            stripe={stripeFor(pk as string)}
            options={{ clientSecret: clientSecret as string, locale: "es" }}
          >
            <PaymentStep onDone={close} />
          </Elements>
        )}

        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          onClick={close}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

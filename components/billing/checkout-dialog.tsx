"use client";

// Checkout summary for one plan + period: what the user pays (with GST per
// admin Billing), when the new term starts and ends, and any credit from the
// current plan. With a payment gateway on, "Pay" runs the checkout; with none
// on, "Request this plan" opens a prefilled support ticket instead.
//
// "Pay": the server creates the order (it alone decides the amount), the
// Razorpay window takes the payment, and the server verifies the signature and
// the amount before the plan changes. Our dialog steps aside while Razorpay's
// window is open, then shows the result.

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContactSupport } from "@/components/support/contact-support";
import {
  PERIOD_LABELS,
  formatPaise,
  quote,
  type BillingPeriod,
  type CurrentPlanInfo,
  type OfferPlan,
  type TaxSettings,
} from "@/lib/billing-model";
import { closeCheckoutAction, startCheckoutAction, verifyCheckoutAction } from "@/actions/payments";
import { openRazorpay } from "@/lib/razorpay-checkout";

type Status = "idle" | "starting" | "external" | "verifying" | "paid" | "cancelled" | "failed" | "error";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function CheckoutDialog({
  open,
  onOpenChange,
  plan,
  period,
  current,
  tax,
  online,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: OfferPlan | null;
  period: BillingPeriod;
  current: CurrentPlanInfo;
  tax: TaxSettings;
  /** A payment gateway is on and Billing is complete. */
  online: boolean;
  onPaid: () => void;
}) {
  const { open: openSupport } = useContactSupport();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  // The server can switch this off (gateway turned off meanwhile).
  const [canPayOnline, setCanPayOnline] = useState(online);

  // Fresh state each time the dialog opens for a plan.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setMessage("");
      setPaidUntil(null);
      setCanPayOnline(online);
    }
  }, [open, plan?.id, period, online]);

  // Computed on open (client only), so dates use the viewer's clock.
  const q = useMemo(
    () => (open && plan ? quote({ plan, period, current, tax }) : null),
    [open, plan, period, current, tax],
  );
  if (!plan) return null;

  const title = q?.kind === "renew" ? `Renew ${plan.name}` : q?.kind === "upgrade" ? `Upgrade to ${plan.name}` : `Get ${plan.name}`;

  async function pay() {
    if (!plan) return;
    setStatus("starting");
    setMessage("");
    const start = await startCheckoutAction({ planId: plan.id, period });
    if (!start.ok) {
      // Online payment went off meanwhile: show the request flow instead.
      if (start.fallback) {
        setCanPayOnline(false);
        setStatus("idle");
      } else {
        setMessage(start.error);
        setStatus("error");
      }
      return;
    }
    const c = start.checkout;
    let failedReason: string | null = null;
    setStatus("external");
    const outcome = await openRazorpay({
      key: c.keyId,
      orderId: c.gatewayOrderId,
      amount: c.amount,
      currency: c.currency,
      name: c.merchantName,
      description: `${c.planName} plan, billed ${PERIOD_LABELS[c.period].toLowerCase()}`,
      prefill: c.prefill,
      // Razorpay lets the user retry in the same window; remember the reason.
      onFailedAttempt: (reason) => {
        failedReason = reason;
        void closeCheckoutAction({ orderId: c.orderId, outcome: "failed", reason });
      },
    });

    if (outcome.kind === "load-error") {
      void closeCheckoutAction({ orderId: c.orderId, outcome: "failed", reason: "The payment window didn't load" });
      setMessage("The payment window didn't load. Check your connection and try again.");
      setStatus("error");
      return;
    }
    if (outcome.kind === "dismissed") {
      void closeCheckoutAction({ orderId: c.orderId, outcome: "cancelled" });
      setStatus(failedReason ? "failed" : "cancelled");
      setMessage(failedReason ?? "");
      return;
    }

    setStatus("verifying");
    const res = await verifyCheckoutAction({
      orderId: c.orderId,
      razorpayOrderId: outcome.orderId,
      razorpayPaymentId: outcome.paymentId,
      razorpaySignature: outcome.signature,
    });
    if (res.ok) {
      setPaidUntil(res.expiresAt);
      setStatus("paid");
    } else {
      setMessage(res.error);
      setStatus("error");
    }
  }

  function request() {
    const verb = q?.kind === "renew" ? "renew" : "move to";
    openSupport({
      category: "billing",
      subject: `Plan request: ${plan!.name} (${PERIOD_LABELS[period].toLowerCase()})`,
      message: `<p>I'd like to ${verb} the ${plan!.name} plan, billed ${PERIOD_LABELS[period].toLowerCase()}. Please help me complete the payment.</p>`,
      source: "plan",
    });
    onOpenChange(false);
  }

  const busy = status === "starting" || status === "external" || status === "verifying";

  return (
    // Hidden (not closed) while Razorpay's own window is up, so it can take focus.
    <Dialog open={open && status !== "external"} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {status === "paid" && q && paidUntil ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-status-applied-foreground" aria-hidden />
            <DialogTitle className="mt-3 text-lg">
              {q.kind === "renew" ? `${plan.name} is renewed` : `You’re on ${plan.name}`}
            </DialogTitle>
            <DialogDescription className="mt-1.5">
              Your plan is active until {dateFmt(paidUntil)}. We&rsquo;ve emailed you a receipt.
            </DialogDescription>
            <Button className="mt-5 w-full" onClick={onPaid}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {plan.name}, billed {PERIOD_LABELS[period].toLowerCase()}
              </DialogDescription>
            </DialogHeader>

            {q && (
              <div className="space-y-3 text-sm">
                <dl className="space-y-1.5 rounded-xl bg-muted/50 p-3">
                  <Row label="Starts">{q.kind === "renew" ? dateFmt(q.startsAt) : "Today"}</Row>
                  <Row label="Active until">{dateFmt(q.expiresAt)}</Row>
                  {q.creditDays > 0 && (
                    <p className="pt-1 text-xs text-status-applied-foreground">
                      Includes {q.creditDays} extra {q.creditDays === 1 ? "day" : "days"} for the unused part of your{" "}
                      {current.name} plan.
                    </p>
                  )}
                  {q.kind === "renew" && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      The new term starts when your current one ends, so you don&rsquo;t lose any days.
                    </p>
                  )}
                </dl>

                <dl className="space-y-1.5 px-1">
                  {q.pricesIncludeTax || q.taxRate <= 0 ? (
                    <Row label="Price">{formatPaise(q.total, q.currency)}</Row>
                  ) : (
                    <>
                      <Row label="Price">{formatPaise(q.base, q.currency)}</Row>
                      <Row label={`GST (${q.taxRate}%)`}>{formatPaise(q.tax, q.currency)}</Row>
                    </>
                  )}
                  <div className="flex items-baseline justify-between border-t pt-2 font-semibold">
                    <dt>Total</dt>
                    <dd>{formatPaise(q.total, q.currency)}</dd>
                  </div>
                  {q.pricesIncludeTax && q.taxRate > 0 && (
                    <p className="text-right text-[11px] text-muted-foreground">
                      Includes {formatPaise(q.tax, q.currency)} GST
                    </p>
                  )}
                </dl>

                {status === "cancelled" && (
                  <p role="status" className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Payment cancelled. You haven&rsquo;t been charged.
                  </p>
                )}
                {status === "failed" && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
                    <span>
                      The payment didn&rsquo;t go through{message ? ` (${message.replace(/.$/, "")})` : ""}. You
                      haven&rsquo;t been charged. Try again, or pick another payment method in the payment window.
                    </span>
                  </p>
                )}
                {status === "error" && message && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
                    {message}
                  </p>
                )}

                {canPayOnline ? (
                  <>
                    <Button className="w-full" onClick={pay} disabled={busy}>
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          {status === "verifying" ? "Confirming your payment…" : "Opening secure payment…"}
                        </>
                      ) : (
                        <>
                          <Lock className="size-4" aria-hidden />
                          {status === "idle" ? "Pay" : "Try again"} {formatPaise(q.total, q.currency)}
                        </>
                      )}
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Payments are handled securely by Razorpay. We never see your card or UPI details.
                    </p>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Plans don&rsquo;t renew automatically and can&rsquo;t be refunded once they start.{" "}
                      <a href="/refunds" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">
                        Refund policy
                      </a>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      Online payment isn&rsquo;t available right now. Send us a request and our team will help you
                      complete the payment.
                    </p>
                    <Button className="w-full" onClick={request}>
                      <Send className="size-4" aria-hidden /> Request this plan
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

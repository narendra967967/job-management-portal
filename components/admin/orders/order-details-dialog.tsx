"use client";

// Admin → Orders & Payments → View details: everything about one order in a
// large modal. Header: receipt number, status, mode and the amount. Body:
// customer, plan and access, payment breakdown, gateway references and a
// timeline. Footer: the actions that apply to this order.

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CircleAlert,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Mail,
  Package,
  Receipt,
  User,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { toast } from "@/components/admin/ui/toast";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/admin/ui/dialog";
import {
  GATEWAY_LABELS,
  ORDER_STATUS_LABELS,
  PERIOD_LABELS,
  formatPaise,
  type AdminOrderRow,
  type GatewayId,
  type OrderStatus,
} from "@/lib/billing-model";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<OrderStatus, "success" | "danger" | "warning" | "neutral"> = {
  paid: "success",
  failed: "danger",
  created: "warning",
  cancelled: "neutral",
};

const KIND_LABELS = { new: "New purchase", renew: "Renewal", upgrade: "Upgrade" } as const;

const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Razorpay dashboard page for this payment (or the order, before payment). */
function gatewayDashboardUrl(o: AdminOrderRow): string | null {
  if (o.gateway !== "razorpay") return null;
  if (o.gatewayPaymentId) return `https://dashboard.razorpay.com/app/payments/${o.gatewayPaymentId}`;
  if (o.gatewayOrderId) return `https://dashboard.razorpay.com/app/orders/${o.gatewayOrderId}`;
  return null;
}

export function OrderDetailsDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AdminOrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [resending, setResending] = useState(false);

  async function copy(value: string | null, what: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}`);
    }
  }

  function resendReceipt() {
    // PHASE 1: sample data. Phase 3 re-sends the payment receipt email.
    setResending(true);
    setTimeout(() => {
      setResending(false);
      toast.success(`Receipt sent to ${order?.user?.email ?? "the user"}`);
    }, 700);
  }

  const o = order;
  const dash = o ? gatewayDashboardUrl(o) : null;
  const gatewayName = o ? (GATEWAY_LABELS[o.gateway as GatewayId] ?? o.gateway) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {o && (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border bg-muted/30 px-5 py-4 pr-12">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Receipt className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg">Order {o.receipt}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {o.planName} · {PERIOD_LABELS[o.period]} · {formatDateTime(o.createdAt)}
                </DialogDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={STATUS_VARIANT[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  <Badge variant={o.mode === "live" ? "warning" : "neutral"}>{o.mode === "live" ? "Live" : "Test mode"}</Badge>
                  <Badge variant="neutral">{KIND_LABELS[o.kind]}</Badge>
                </div>
              </div>
              <div className="w-full text-left sm:w-auto sm:text-right">
                <p className="text-2xl font-bold tabular-nums">{formatPaise(o.total, o.currency)}</p>
                <p className="text-xs text-muted-foreground">incl. {formatPaise(o.tax, o.currency)} GST</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {(o.status === "failed" || o.status === "cancelled") && o.failureReason && (
                <p
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
                    o.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                  )}
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {o.failureReason}
                </p>
              )}
              {o.status === "created" && (
                <p className="flex items-start gap-2 rounded-lg bg-status-shortlisted/60 px-3 py-2.5 text-sm text-status-shortlisted-foreground">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Waiting for payment. The user opened checkout but hasn&rsquo;t paid yet.
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Section icon={User} title="Customer">
                  <Row label="Name">{o.user?.name ?? "Deleted user"}</Row>
                  <Row label="Email">
                    <span className="break-all">{o.user?.email ?? "–"}</span>
                  </Row>
                </Section>

                <Section icon={Package} title="Plan and access">
                  <Row label="Plan">{o.planName}</Row>
                  <Row label="Billing">{PERIOD_LABELS[o.period]}</Row>
                  <Row label="Type">{KIND_LABELS[o.kind]}</Row>
                  <Row label="Access">
                    {o.status === "paid" ? `${dateOnly(o.startsAt)} to ${dateOnly(o.expiresAt)}` : "Not applied (unpaid)"}
                  </Row>
                  {o.creditDays > 0 && <Row label="Credit">{o.creditDays} extra days from the previous plan</Row>}
                </Section>

                <Section icon={CreditCard} title="Payment">
                  <Row label="Price">{formatPaise(o.base, o.currency)}</Row>
                  <Row label={`GST (${o.taxRate}%)`}>{formatPaise(o.tax, o.currency)}</Row>
                  <Row label="Total">
                    <span className="font-semibold">{formatPaise(o.total, o.currency)}</span>
                  </Row>
                  <Row label="Method">{o.method ?? "–"}</Row>
                </Section>

                <Section icon={Receipt} title="Gateway and references">
                  <Row label="Gateway">
                    {gatewayName} {o.mode === "test" && <span className="text-muted-foreground">(test)</span>}
                  </Row>
                  <Row label="Receipt">
                    <CopyValue value={o.receipt} onCopy={() => copy(o.receipt, "Receipt number")} />
                  </Row>
                  <Row label="Order ID">
                    <CopyValue value={o.gatewayOrderId} onCopy={() => copy(o.gatewayOrderId, "Order ID")} />
                  </Row>
                  <Row label="Payment ID">
                    <CopyValue value={o.gatewayPaymentId} onCopy={() => copy(o.gatewayPaymentId, "Payment ID")} />
                  </Row>
                </Section>
              </div>

              <Section icon={Clock} title="Timeline">
                <ol className="space-y-3">
                  <TimelineItem tone="neutral" label="Order created" at={o.createdAt} />
                  {o.status === "paid" && o.paidAt && <TimelineItem tone="success" label="Payment received" at={o.paidAt} />}
                  {o.status === "paid" && <TimelineItem tone="success" label={`Plan active until ${dateOnly(o.expiresAt)}`} />}
                  {o.status === "failed" && <TimelineItem tone="danger" label="Payment failed" />}
                  {o.status === "cancelled" && <TimelineItem tone="neutral" label="Checkout closed without paying" />}
                  {o.status === "created" && <TimelineItem tone="warning" label="Waiting for payment" />}
                </ol>
              </Section>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-5 py-3">
              {o.user?.email && (
                <Link
                  href={`/jmp-admin/users?q=${encodeURIComponent(o.user.email)}`}
                  className={buttonVariants({ variant: "outline", className: "min-h-9" })}
                >
                  <User className="size-4" aria-hidden /> View user
                </Link>
              )}
              {dash && (
                <a
                  href={dash}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", className: "min-h-9" })}
                >
                  <ExternalLink className="size-4" aria-hidden /> Open in {gatewayName}
                </a>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                {o.status === "paid" && o.user?.email && (
                  <Button variant="outline" className="min-h-9" onClick={resendReceipt} disabled={resending}>
                    <Mail className="size-4" aria-hidden /> {resending ? "Sending…" : "Resend receipt"}
                  </Button>
                )}
                <DialogClose className={buttonVariants({ className: "min-h-9" })}>Close</DialogClose>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-4" aria-hidden />
        {title}
      </h3>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function CopyValue({ value, onCopy }: { value: string | null; onCopy: () => void }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="min-w-0 font-mono text-xs break-all">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${value}`}
        className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-2 hover:bg-muted hover:text-foreground"
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

function TimelineItem({ tone, label, at }: { tone: "success" | "danger" | "warning" | "neutral"; label: string; at?: string }) {
  const Icon = tone === "success" ? Check : tone === "danger" ? XCircle : Clock;
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          tone === "success" && "bg-status-applied text-status-applied-foreground",
          tone === "danger" && "bg-destructive/10 text-destructive",
          tone === "warning" && "bg-status-shortlisted text-status-shortlisted-foreground",
          tone === "neutral" && "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {at && <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>}
      </div>
    </li>
  );
}

"use client";

// Orders & payments (/orders, docs/invoices/spec.md, section 7): every payment the user
// has made or tried, with its invoice. Billing details live on the Profile tab
// (components/billing/billing-details-card.tsx).
// Rows come from actions/my-payments.ts (the signed-in user's own orders);
// invoices from /api/invoices/[orderId], drawn on request.

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, LifeBuoy, Mail, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  BulkBar,
  DateRangeFields,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  StatBox,
  TableBox,
  TablePagination,
  dateRangeError,
  lastDays,
  tableSelectCls,
  usePagination,
  useRowSelection,
  ymd,
} from "@/components/ui/data-table";
import { useContactSupport } from "@/components/support/contact-support";
import { emailMyInvoicesAction, listMyPaymentsAction } from "@/actions/my-payments";
import { formatPaise } from "@/lib/invoices/model";
import {
  PAYMENTS_DEFAULT_DAYS,
  PAYMENT_STATUS_LABELS,
  SALE_KIND_LABELS,
  type PaymentRow,
  type PaymentStatus,
  type SaleKind,
} from "@/lib/invoices/payments-model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-800",
  cancelled: "bg-slate-100 text-slate-700",
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const shortTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const pdfHref = (r: PaymentRow, download: boolean) => `/api/invoices/${r.id}${download ? "?download=1" : ""}`;

export function PaymentsTab() {
  return <PaymentsCard />;
}


function PaymentsCard() {
  const mounted = useMounted();
  const { open: openSupport } = useContactSupport();
  // null while loading.
  const [loaded, setLoaded] = useState<PaymentRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    listMyPaymentsAction()
      .then(setLoaded)
      .catch(() => {
        setLoaded([]);
        setLoadError("Couldn't load your payments. Reload the page to try again.");
      });
  }, []);
  const all = useMemo(() => loaded ?? [], [loaded]);
  const initial = useMemo(() => lastDays(PAYMENTS_DEFAULT_DAYS), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [kind, setKind] = useState<"all" | SaleKind>("all");
  const [details, setDetails] = useState<PaymentRow | null>(null);

  const dateError = dateRangeError(from, to);
  // An invalid range keeps showing the last valid results.
  useEffect(() => {
    if (!dateError) setRange({ from, to });
  }, [from, to, dateError]);

  const inRange = useMemo(
    () =>
      all.filter((r) => {
        const d = ymd(new Date(r.at));
        return d >= range.from && d <= range.to;
      }),
    [all, range],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (kind === "all" || r.kind === kind) &&
        (!q || `${r.invoiceNumber ?? ""} ${r.orderNumber} ${r.item} ${r.detail ?? ""}`.toLowerCase().includes(q)),
    );
  }, [inRange, query, status, kind]);

  const paging = usePagination(rows, `${query}|${status}|${kind}|${range.from}|${range.to}`);
  const selection = useRowSelection(rows.map((r) => r.id));
  const count = (s: PaymentStatus) => inRange.filter((r) => r.status === s).length;
  const totalPaid = inRange.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);

  const [sending, setSending] = useState(false);
  const emailInvoices = async (list: PaymentRow[]) => {
    const paid = list.filter((r) => r.invoiceNumber);
    if (!paid.length) return toast.info("Nothing to send", "Only paid payments have invoices.");
    setSending(true);
    const r = await emailMyInvoicesAction(paid.map((p) => p.id)).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
    setSending(false);
    if (!r.ok) return toast.error("Not sent", r.error);
    toast.success(r.sent === 1 ? "Invoice on its way" : `${r.sent} invoices on their way`, "They're attached to one email to your account's address.");
    selection.clear();
  };
  const help = (r: PaymentRow) =>
    openSupport({
      category: "billing",
      subject: `Help with order ${r.orderNumber}`,
      message: `<p>I need help with order ${r.orderNumber} (${r.item}${r.detail ? `, ${r.detail}` : ""}).</p>`,
      source: "settings-payments",
    });

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="size-4 text-muted-foreground" aria-hidden />
          Payments
        </h2>
        <p className="text-xs text-muted-foreground">
          Paid in these dates: <span className="font-semibold text-foreground tabular-nums">₹{formatPaise(totalPaid)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["paid", "failed", "pending", "cancelled"] as PaymentStatus[]).map((s) => (
          <StatBox
            key={s}
            label={PAYMENT_STATUS_LABELS[s]}
            value={String(count(s))}
            active={status === s}
            onClick={() => setStatus(status === s ? "all" : s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search payments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice, order or item" className="h-11 pl-9 sm:h-9" />
        </label>
        <select aria-label="Status" className={cn(tableSelectCls, "h-11 sm:h-9")} value={status} onChange={(e) => setStatus(e.target.value as "all" | PaymentStatus)}>
          <option value="all">All statuses</option>
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select aria-label="What for" className={cn(tableSelectCls, "h-11 sm:h-9")} value={kind} onChange={(e) => setKind(e.target.value as "all" | SaleKind)}>
          <option value="all">Everything</option>
          {(Object.keys(SALE_KIND_LABELS) as SaleKind[]).map((k) => (
            <option key={k} value={k}>
              {SALE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <DateRangeFields from={from} to={to} onFrom={setFrom} onTo={setTo} error={dateError} />
        </div>
      </div>
      {dateError && (
        <p className="text-xs text-destructive" role="alert">
          {dateError}
        </p>
      )}

      <BulkBar selection={selection}>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 bg-white" disabled={sending} onClick={() => void emailInvoices(all.filter((r) => selection.isSelected(r.id)))}>
          <Mail className="size-4" aria-hidden />
          Email me the invoices
        </Button>
      </BulkBar>

      {loadError && (
        <p className="text-xs text-destructive" role="alert">
          {loadError}
        </p>
      )}
      {loaded === null ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" aria-busy />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Receipt className="mx-auto size-8 text-primary/60" aria-hidden />
          <p className="mt-2 text-sm font-medium">{all.length === 0 ? "No payments yet" : "No payments match these filters"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {all.length === 0 ? "When you buy a plan or an AI mock interview, it shows up here with its invoice." : "Try a wider date range, or clear the filters."}
          </p>
        </div>
      ) : (
        <TableBox minWidth={680}>
          <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <SelectAllCheckbox selection={selection} />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="min-w-48 px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-14 px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paging.paged.map((r) => (
              <tr key={r.id} className="align-middle">
                <td className="px-3 py-1">
                  <RowCheckbox selection={selection} id={r.id} label={r.invoiceNumber ?? r.orderNumber} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {mounted ? (
                    <>
                      <span className="block text-sm">{shortDay(r.at)}</span>
                      <span className="block text-xs text-muted-foreground">{shortTime(r.at)}</span>
                    </>
                  ) : (
                    " "
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.invoiceNumber ? (
                    <a href={pdfHref(r, false)} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 font-mono text-[13px] text-primary underline-offset-4 hover:underline sm:min-h-0">
                      <FileText className="size-3.5" aria-hidden />
                      {r.invoiceNumber}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No invoice</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{r.item}</p>
                  <p className="text-xs text-muted-foreground">{[r.detail, `Order ${r.orderNumber}`].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">₹{formatPaise(r.amount)}</td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATUS_TONE[r.status])}>
                    {PAYMENT_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-3 py-1 text-right">
                  <RowActions label={r.invoiceNumber ?? `order ${r.orderNumber}`}>
                    {r.invoiceNumber && (
                      <>
                        <DropdownMenuItem onClick={() => window.open(pdfHref(r, true), "_self")}>
                          <Download className="size-4" aria-hidden />
                          Download invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(pdfHref(r, false), "_blank", "noopener")}>
                          <Eye className="size-4" aria-hidden />
                          View invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void emailInvoices([r])}>
                          <Mail className="size-4" aria-hidden />
                          Email me the invoice
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setDetails(r)}>
                      <Receipt className="size-4" aria-hidden />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => help(r)}>
                      <LifeBuoy className="size-4" aria-hidden />
                      Get help with this payment
                    </DropdownMenuItem>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      <TablePagination paging={paging} />

      <PaymentDetailsDialog row={details} onClose={() => setDetails(null)} />
    </section>
  );
}

function PaymentDetailsDialog({ row, onClose }: { row: PaymentRow | null; onClose: () => void }) {
  const mounted = useMounted();
  const facts: [string, string][] = row
    ? [
        ["Status", PAYMENT_STATUS_LABELS[row.status]],
        ["Date", mounted ? dateTime(row.at) : ""],
        ["Item", [row.item, row.detail].filter(Boolean).join(", ")],
        ["Amount", `₹${formatPaise(row.amount)}`],
        ["Invoice number", row.invoiceNumber ?? "None (not paid)"],
        ["Order number", row.orderNumber],
        ["Method", row.method ?? "Not chosen"],
        ["Payment ID", row.paymentId ?? "None"],
        ...(row.failureReason ? ([["What went wrong", row.failureReason]] as [string, string][]) : []),
      ]
    : [];
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment details</DialogTitle>
        </DialogHeader>
        <dl className="divide-y rounded-xl border text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium break-all">{v}</dd>
            </div>
          ))}
        </dl>
        {row?.invoiceNumber && (
          <a href={pdfHref(row, true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:h-9">
            <Download className="size-4" aria-hidden />
            Download invoice
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}

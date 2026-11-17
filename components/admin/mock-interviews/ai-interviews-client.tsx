"use client";

// Admin → Mock interviews → AI interviews: usage and cost, every session with
// its event log, and credits (D13, D55). Follows the admin table rule: last 7
// days by default with required dates, stat boxes that filter, multi-select
// with CSV export, an Action column and pagination.

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Gift, Loader2, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { AreaChart, VizStyle, type Point } from "@/components/admin/ui/charts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/admin/ui/toast";
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
} from "@/components/admin/ui/data-table";
import { InfoTip } from "@/components/ui/info-tip";
import { creditAiInterviewAction, getAiInterviewEventsAction } from "@/actions/admin-mock-interviews";
import { clockLabel, type AdminSession, type AdminSessionStatus, type SessionEvent } from "@/lib/mock-interviews/admin-model";
import { DIFFICULTIES, rupees, type Difficulty } from "@/lib/mock-interviews/model";
import { cn, formatDateTime } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

const STATUS: Record<AdminSessionStatus, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  completed: { label: "Completed", variant: "success" },
  stopped: { label: "Stopped early", variant: "warning" },
  in_progress: { label: "In progress", variant: "neutral" },
  failed: { label: "Failed", variant: "danger" },
};
const STATUSES = Object.keys(STATUS) as AdminSessionStatus[];
type PayKind = AdminSession["payment"]["kind"];
const PAY_LABEL: Record<PayKind, string> = { paid: "Paid", plan: "Plan", free: "Free trial", credit: "Given back" };

const EVENT_DOT: Record<string, string> = {
  start: "bg-primary",
  question: "bg-sky-500",
  answer: "bg-emerald-500",
  followup: "bg-violet-500",
  disconnect: "bg-amber-500",
  resume: "bg-teal-500",
  wrapup: "bg-amber-400",
  end: "bg-foreground/60",
  evaluation: "bg-primary",
  error: "bg-destructive",
};

function payText(s: AdminSession) {
  return s.payment.kind === "paid" ? rupees(s.payment.paise) : PAY_LABEL[s.payment.kind];
}

function downloadCsv(name: string, header: string[], lines: string[][]) {
  const cell = (v: string) => {
    const s = v.replace(/^[=+\-@]/, "'$&");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...lines].map((l) => l.map(cell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function AiInterviewsClient({ rows: initialRows, capped }: { rows: AdminSession[]; capped?: boolean }) {
  const router = useRouter();
  const mounted = useMounted();
  const [rows, setRows] = useState<AdminSession[]>(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminSessionStatus>("all");
  const [level, setLevel] = useState<"all" | Difficulty>("all");
  const [pay, setPay] = useState<"all" | PayKind>("all");
  const initial = useMemo(() => lastDays(7), []);
  const [fromInput, setFromInput] = useState(initial.from);
  const [toInput, setToInput] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [chartBy, setChartBy] = useState<"sessions" | "cost">("sessions");
  const [details, setDetails] = useState<AdminSession | null>(null);
  const [crediting, setCrediting] = useState<AdminSession | null>(null);
  const rangeError = dateRangeError(fromInput, toInput);

  useEffect(() => {
    if (!rangeError) setRange({ from: fromInput, to: toInput });
  }, [fromInput, toInput, rangeError]);

  const inRange = useMemo(
    () =>
      rows.filter((r) => {
        const d = ymd(new Date(r.startedAt));
        return d >= range.from && d <= range.to;
      }),
    [rows, range],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inRange
      .filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (level !== "all" && r.difficulty !== level) return false;
        if (pay !== "all" && r.payment.kind !== pay) return false;
        if (!needle) return true;
        return [r.user.name, r.user.email, r.role, r.category, r.id].some((v) => v.toLowerCase().includes(needle));
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [inRange, query, status, level, pay]);

  const selection = useRowSelection(filtered.map((r) => r.id));
  const paging = usePagination(filtered, `${query}|${status}|${level}|${pay}|${range.from}|${range.to}`);
  const count = (f: (r: AdminSession) => boolean) => String(inRange.filter(f).length);

  const totals = useMemo(() => {
    const revenue = inRange.reduce((n, r) => n + (r.payment.kind === "paid" ? r.payment.paise : 0), 0);
    const cost = inRange.reduce((n, r) => n + r.costPaise, 0);
    const tokens = inRange.reduce((n, r) => n + r.tokensIn + r.tokensOut, 0);
    const minutes = inRange.reduce((n, r) => n + (r.status === "completed" ? r.durationMin : 0), 0);
    return { revenue, cost, tokens, minutes };
  }, [inRange]);

  // One point per day in the range, so quiet days show as zero.
  const chart: Point[] = useMemo(() => {
    const out: Point[] = [];
    if (!mounted) return out;
    const d = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);
    for (let i = 0; d <= end && i < 120; i++, d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      const day = inRange.filter((r) => ymd(new Date(r.startedAt)) === key);
      out.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: chartBy === "sessions" ? day.length : Math.round(day.reduce((n, r) => n + r.costPaise, 0) / 100),
      });
    }
    return out;
  }, [inRange, range, chartBy, mounted]);

  function exportSelected() {
    const chosen = rows.filter((r) => selection.isSelected(r.id));
    downloadCsv(
      `ai-interviews-${range.from}-to-${range.to}.csv`,
      ["Session", "Started", "Name", "Email", "Role", "Kind", "Level", "Minutes", "Status", "Questions", "Tokens in", "Tokens out", "AI cost (INR)", "Paid by", "Amount (INR)", "Credited"],
      chosen.map((r) => [
        r.id,
        r.startedAt,
        r.user.name,
        r.user.email,
        r.role,
        r.category,
        r.difficulty,
        String(r.durationMin),
        STATUS[r.status].label,
        String(r.questions),
        String(r.tokensIn),
        String(r.tokensOut),
        (r.costPaise / 100).toFixed(2),
        PAY_LABEL[r.payment.kind],
        r.payment.kind === "paid" ? (r.payment.paise / 100).toFixed(0) : "",
        r.credited ? r.credited.note : "",
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <VizStyle />
      {capped && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Showing the newest {rows.length.toLocaleString("en-IN")} interviews. Older ones are kept but not listed here.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, role or session" aria-label="Search sessions" className="h-9 pl-8" />
        </div>
        <select aria-label="Status" className={tableSelectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
        <select aria-label="Level" className={tableSelectCls} value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
          <option value="all">All levels</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select aria-label="Paid by" className={tableSelectCls} value={pay} onChange={(e) => setPay(e.target.value as typeof pay)}>
          <option value="all">Any payment</option>
          {(Object.keys(PAY_LABEL) as PayKind[]).map((k) => (
            <option key={k} value={k}>
              {PAY_LABEL[k]}
            </option>
          ))}
        </select>
        <DateRangeFields from={fromInput} to={toInput} onFrom={setFromInput} onTo={setToInput} error={rangeError} />
      </div>
      {rangeError && <p className="-mt-2 text-xs text-destructive">{rangeError}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="Sessions" value={String(inRange.length)} active={status === "all"} onClick={() => setStatus("all")} />
        {STATUSES.map((s) => (
          <StatBox key={s} label={STATUS[s].label} value={count((r) => r.status === s)} active={status === s} onClick={() => setStatus(status === s ? "all" : s)} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Money label="Paid by candidates" value={rupees(totals.revenue)} tone="text-emerald-700" />
        <Money label="AI cost" value={rupees(totals.cost)} tone="text-rose-700" note="What the AI service charged for these sessions, from the tokens used." />
        <Money label="Tokens used" value={totals.tokens.toLocaleString("en-IN")} />
        <Money label="Minutes completed" value={totals.minutes.toLocaleString("en-IN")} />
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{chartBy === "sessions" ? "Sessions per day" : "AI cost per day (₹)"}</h2>
          <div role="radiogroup" aria-label="Chart shows" className="inline-grid grid-cols-2 gap-1 rounded-lg bg-muted/70 p-1">
            {(
              [
                ["sessions", "Sessions"],
                ["cost", "AI cost"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={chartBy === v}
                onClick={() => setChartBy(v)}
                className={cn("min-h-11 rounded-md px-3 text-xs font-medium sm:min-h-8", chartBy === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {chart.length > 0 ? <AreaChart data={chart} unit={chartBy === "cost" ? "₹" : ""} /> : <div className="h-[260px]" />}
      </section>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" onClick={exportSelected}>
          <Download className="size-4" /> Export CSV
        </Button>
      </BulkBar>

      <TableBox minWidth={1040}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-4 py-2.5 font-medium">Started</th>
            <th className="px-4 py-2.5 font-medium">Candidate</th>
            <th className="px-4 py-2.5 font-medium">Interview</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Paid</th>
            <th className="px-4 py-2.5 text-right font-medium">AI cost</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {paging.paged.map((r) => (
            <tr key={r.id} className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selection.isSelected(r.id) && "bg-primary/5")}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={r.id} label={`${r.user.name}, ${r.id}`} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{mounted ? formatDateTime(r.startedAt) : ""}</td>
              <td className="max-w-[14rem] px-4 py-2.5">
                <span className="block truncate">{r.user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.user.email}</span>
              </td>
              <td className="max-w-[16rem] px-4 py-2.5">
                <span className="block truncate">{r.role}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.category} · {r.difficulty} · {r.durationMin} min
                </span>
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                {r.credited && <span className="mt-1 block text-xs text-emerald-700">Interview given back</span>}
              </td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{payText(r)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{rupees(r.costPaise)}</td>
              <td className="px-4 py-2 text-right">
                <RowActions label={`${r.user.name}, ${r.id}`}>
                  <DropdownMenuItem onClick={() => setDetails(r)}>
                    <Eye /> View event log
                  </DropdownMenuItem>
                  {!r.credited && r.status !== "completed" && r.status !== "in_progress" && (
                    <DropdownMenuItem onClick={() => setCrediting(r)}>
                      <Gift /> Give interview back
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push(`/jmp-admin/users?q=${encodeURIComponent(r.user.email)}`)}>
                    <User /> View user
                  </DropdownMenuItem>
                </RowActions>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No sessions match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>
      <TablePagination paging={paging} />

      <SessionDialog
        session={details}
        mounted={mounted}
        onClose={() => setDetails(null)}
        onCredit={(s) => {
          setDetails(null);
          setCrediting(s);
        }}
      />
      <CreditDialog
        session={crediting}
        onClose={() => setCrediting(null)}
        onDone={(s, note) => {
          setRows((cur) => cur.map((r) => (r.id === s.id ? { ...r, credited: { note } } : r)));
          setCrediting(null);
          toast.success("Interview given back", `${s.user.name} has a new ${s.durationMin}-minute ${s.difficulty} booking at no charge.`);
          router.refresh();
        }}
      />
    </div>
  );
}

function Money({ label, value, tone, note }: { label: string; value: string; tone?: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {label}
        {note && <InfoTip label={`About ${label}`}>{note}</InfoTip>}
      </p>
      <p className={cn("mt-0.5 text-base font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function SessionDialog({
  session: s,
  mounted,
  onClose,
  onCredit,
}: {
  session: AdminSession | null;
  mounted: boolean;
  onClose: () => void;
  onCredit: (s: AdminSession) => void;
}) {
  const canCredit = s && !s.credited && (s.status === "stopped" || s.status === "failed");
  // The event log loads when a session opens.
  const [events, setEvents] = useState<SessionEvent[] | null>(null);
  const [eventsError, setEventsError] = useState("");
  useEffect(() => {
    if (!s) return;
    let live = true;
    setEvents(null);
    setEventsError("");
    getAiInterviewEventsAction(s.id)
      .then((r) => {
        if (!live) return;
        if (r.ok) setEvents(r.events);
        else setEventsError(r.error);
      })
      .catch(() => live && setEventsError("Couldn't load the event log."));
    return () => {
      live = false;
    };
  }, [s]);
  return (
    <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{s ? `${s.user.name}: ${s.role}` : ""}</DialogTitle>
        </DialogHeader>
        {s && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Session</dt>
              <dd className="font-mono text-xs leading-5">{s.id}</dd>
              <dt className="text-muted-foreground">Started</dt>
              <dd>{mounted ? formatDateTime(s.startedAt) : ""}</dd>
              <dt className="text-muted-foreground">Interview</dt>
              <dd>
                {s.category}, {s.difficulty}, {s.durationMin} min
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
              </dd>
              <dt className="text-muted-foreground">Questions</dt>
              <dd>{s.questions}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd>{payText(s)}</dd>
              <dt className="text-muted-foreground">Tokens</dt>
              <dd className="tabular-nums">
                {s.tokensIn.toLocaleString("en-IN")} in, {s.tokensOut.toLocaleString("en-IN")} out
              </dd>
              <dt className="text-muted-foreground">AI cost</dt>
              <dd>{rupees(s.costPaise)}</dd>
              {s.credited && (
                <>
                  <dt className="text-muted-foreground">Given back</dt>
                  <dd>{s.credited.note}</dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Event log</h3>
              {eventsError ? (
                <p className="text-sm text-destructive">{eventsError}</p>
              ) : events === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading…
                </p>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <ol className="relative space-y-2.5 border-l border-border pl-4">
                  {events.map((e, i) => (
                    <li key={i} className="relative text-sm">
                      <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-card", EVENT_DOT[e.kind] ?? "bg-muted-foreground")} aria-hidden />
                      <span className="mr-2 inline-block w-11 font-mono text-xs text-muted-foreground tabular-nums">{clockLabel(e.clockSeconds)}</span>
                      <span className={cn(e.kind === "error" && "text-destructive", e.kind === "disconnect" && "text-amber-800")}>{e.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
        {canCredit && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onCredit(s)}>
              <Gift className="size-4" aria-hidden /> Give interview back
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreditDialog({ session: s, onClose, onDone }: { session: AdminSession | null; onClose: () => void; onDone: (s: AdminSession, note: string) => void }) {
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNote("");
    setTried(false);
  }, [s?.id]);
  async function giveBack() {
    setTried(true);
    if (error || !s) return;
    setBusy(true);
    try {
      const r = await creditAiInterviewAction({ id: s.id, note: note.trim() });
      if (!r.ok) return toast.error("Not given back", r.error);
      onDone(s, note.trim());
    } catch {
      toast.error("Not given back", "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const error = note.trim().length < 10 ? "Write at least 10 characters on why." : "";
  return (
    <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give this interview back?</DialogTitle>
        </DialogHeader>
        {s && (
          <div className="space-y-3 text-sm">
            <p>
              {s.user.name} gets a new {s.durationMin}-minute {s.difficulty} booking at no charge. No money is refunded.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Reason (kept in the audit log)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                aria-invalid={tried && !!error}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {tried && error && <span className="block text-xs text-destructive">{error}</span>}
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={giveBack} disabled={busy}>
            {busy ? "Giving back…" : "Give it back"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

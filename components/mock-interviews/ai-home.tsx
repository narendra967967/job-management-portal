"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Pencil,
  PlayCircle,
  LifeBuoy,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { RowActions, TableBox, TablePagination, tableSelectCls, usePagination } from "@/components/ui/data-table";
import {
  DIFFICULTIES,
  aiInterviewQuote,
  allowanceLeft,
  longDate,
  lowestRatePerMinute,
  rupees,
  shortDate,
  type AllowanceState,
  type BookingRow,
  type BookingStatus,
  type Difficulty,
  type PricingByDifficulty,
} from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { GetReady } from "@/components/mock-interviews/get-ready";
import type { Readiness } from "@/lib/mock-interviews/data";
import { emailAiInterviewReceiptAction } from "@/actions/mock-interviews";
import { LEVEL_TAG } from "@/components/mock-interviews/visual-kit";
import { cn } from "@/lib/utils";

// AI mock interviews: the candidate's booked AI interviews (spec D13a to D13d).
// Booking comes first, starting comes later: the New interview form books, then
// redirects here with the new booking highlighted.

const DAY = 86_400_000;
const EXPIRING_DAYS = 7;

const STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  ready: { label: "Ready to start", cls: "bg-primary/10 text-primary" },
  in_progress: { label: "In progress", cls: "bg-sky-50 text-sky-800" },
  interrupted: { label: "Stopped early", cls: "bg-amber-50 text-amber-800" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-800" },
  no_answers: { label: "Ended before answering", cls: "bg-slate-100 text-slate-700" },
  failed: { label: "Stopped by a problem", cls: "bg-amber-50 text-amber-800" },
  expired: { label: "Expired", cls: "bg-slate-100 text-slate-600" },
};

const LEVEL = LEVEL_TAG;

type View = "todo" | "all" | "expiring" | "month" | BookingStatus;
type PayFilter = "all" | "paid" | "plan" | "free" | "credit";

const VIEW_LABEL: Record<View, string> = {
  todo: "To do",
  all: "All bookings",
  ready: "Ready to start",
  in_progress: "In progress",
  interrupted: "Stopped early",
  completed: "Completed",
  no_answers: "Ended before answering",
  failed: "Stopped by a problem",
  expired: "Expired",
  expiring: "Expiring soon",
  month: "Completed this month",
};

const todo = (s: BookingStatus) => s === "ready" || s === "in_progress" || s === "interrupted";
const daysLeft = (b: BookingRow, now: number) => Math.ceil((new Date(b.validUntil).getTime() - now) / DAY);
const expiring = (b: BookingRow, now: number) => b.status === "ready" && daysLeft(b, now) <= EXPIRING_DAYS;
const thisMonth = (b: BookingRow, now: number) => b.status === "completed" && b.bookedAt.slice(0, 7) === new Date(now).toISOString().slice(0, 7);

export function AiHome({
  allowance,
  bookings,
  pricing,
  bookedId,
  readiness,
}: {
  allowance: AllowanceState;
  bookings: BookingRow[];
  pricing: PricingByDifficulty;
  bookedId?: string;
  readiness: Readiness;
}) {
  const mounted = useMounted();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  // Everything by default, so a booking that just ended is still in the list.
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [pay, setPay] = useState<PayFilter>("all");
  const [level, setLevel] = useState<"all" | Difficulty>("all");

  const booked = bookedId ? bookings.find((b) => b.id === bookedId) : undefined;
  const counts = {
    ready: bookings.filter((b) => b.status === "ready").length,
    progress: bookings.filter((b) => b.status === "in_progress" || b.status === "interrupted").length,
    expiring: bookings.filter((b) => expiring(b, now)).length,
    month: bookings.filter((b) => thisMonth(b, now)).length,
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      const inView =
        view === "all"
          ? true
          : view === "todo"
            ? todo(b.status)
            : view === "expiring"
              ? expiring(b, now)
              : view === "month"
                ? thisMonth(b, now)
                : view === "in_progress"
                  ? b.status === "in_progress" || b.status === "interrupted"
                  : b.status === view;
      return (
        inView &&
        (pay === "all" || b.payment.kind === pay) &&
        (level === "all" || b.difficulty === level) &&
        (!q || `${b.role} ${b.category} ${b.industry} ${b.topics.join(" ")}`.toLowerCase().includes(q))
      );
    });
  }, [bookings, view, pay, level, query, now]);
  const paging = usePagination(rows, `${view}|${pay}|${level}|${query}`);
  const toggle = (v: View) => setView((cur) => (cur === v ? "all" : v));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Hero allowance={allowance} pricing={pricing} mounted={mounted} />

      <GetReady readiness={readiness} allowance={allowance} pricing={pricing} hasBookings={bookings.length > 0} />

      {booked && (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-card shadow-sm" aria-label="Your new booking">
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/15 to-transparent px-4 py-2.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="size-4" aria-hidden />
            Booked. Start whenever you&apos;re ready.
          </div>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{booked.role}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">{booked.category}</span>
                <span className={cn("rounded-md border px-1.5 py-0.5 font-medium", LEVEL[booked.difficulty])}>{booked.difficulty}</span>
                <span className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">{booked.durationMin} min</span>
                <PaidChip b={booked} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Valid until {mounted ? longDate(booked.validUntil) : "…"}. You can change the setup before you start; difficulty
                and length stay as booked.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href={`/mock-interviews/ai/new?edit=${booked.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <Pencil className="size-4" aria-hidden />
                Edit setup
              </Link>
              <Link
                href={`/mock-interviews/ai/prepare/${booked.id}`}
                className={cn(buttonVariants({ size: "lg" }), "bg-gradient-to-r from-primary to-violet-600 text-white hover:opacity-90")}
              >
                <PlayCircle className="size-4" aria-hidden />
                Start interview
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stat tiles: each one filters the list; click again to go back to "To do". */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={PlayCircle} tone="indigo" label="Ready to start" value={counts.ready} active={view === "ready"} onClick={() => toggle("ready")} />
        <Tile icon={Timer} tone="sky" label="In progress" value={counts.progress} active={view === "in_progress"} onClick={() => toggle("in_progress")} />
        <Tile icon={AlarmClock} tone="amber" label="Expiring soon" value={counts.expiring} active={view === "expiring"} onClick={() => toggle("expiring")} />
        <Tile icon={CheckCircle2} tone="emerald" label="Completed this month" value={counts.month} active={view === "month"} onClick={() => toggle("month")} />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your booked interviews</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{VIEW_LABEL[view]}</span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">Search bookings</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search role, kind or topic" className="h-11 pl-9 sm:h-9" />
          </label>
          <select aria-label="Status" className={cn(tableSelectCls, "h-11 sm:h-9")} value={view} onChange={(e) => setView(e.target.value as View)}>
            {(["all", "todo", "ready", "in_progress", "completed", "no_answers", "failed", "expired", "expiring"] as View[]).map((v) => (
              <option key={v} value={v}>
                {VIEW_LABEL[v]}
              </option>
            ))}
          </select>
          <select aria-label="Payment" className={cn(tableSelectCls, "h-11 sm:h-9")} value={pay} onChange={(e) => setPay(e.target.value as PayFilter)}>
            <option value="all">Any payment</option>
            <option value="paid">Paid</option>
            <option value="plan">Included in plan</option>
            <option value="free">Free interview</option>
            <option value="credit">Given back</option>
          </select>
          <select aria-label="Difficulty" className={cn(tableSelectCls, "h-11 sm:h-9")} value={level} onChange={(e) => setLevel(e.target.value as "all" | Difficulty)}>
            <option value="all">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {bookings.length === 0 ? (
          <EmptyState />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {view === "todo" ? "Nothing waiting. Book a new interview to keep practicing." : "No bookings match these filters."}
          </p>
        ) : (
          <TableBox minWidth={940}>
            <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
              <tr>
                {/* Action first (agreed exception): phones see Start without scrolling sideways. */}
                <th className="w-40 px-3 py-2 font-medium">Action</th>
                <th className="min-w-56 px-3 py-2 font-medium">Interview</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Paid</th>
                <th className="px-3 py-2 font-medium">Booked</th>
                <th className="px-3 py-2 font-medium">Valid until</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-14 px-3 py-2 text-right font-medium">More</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paging.paged.map((b) => (
                <tr key={b.id} className={cn("align-middle", b.id === bookedId && "bg-emerald-50/70")}>
                  <td className="px-3 py-2">
                    <PrimaryAction b={b} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{b.role}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.category} · {b.topics.length} {b.topics.length === 1 ? "topic" : "topics"}
                    </p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium", LEVEL[b.difficulty])}>{b.difficulty}</span>
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="size-3" aria-hidden />
                      {b.durationMin} min
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <PaidChip b={b} />
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{mounted ? shortDate(b.bookedAt) : ""}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <ValidUntil b={b} mounted={mounted} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATUS[b.status].cls)}>
                      {STATUS[b.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-right">
                    <RowActions label={b.role}>
                      {b.status === "ready" && (
                        <DropdownMenuItem onClick={() => router.push(`/mock-interviews/ai/new?edit=${b.id}`)}>
                          <Pencil className="size-4" aria-hidden />
                          Edit setup
                        </DropdownMenuItem>
                      )}
                      {b.reportId && (
                        <DropdownMenuItem onClick={() => router.push(`/mock-interviews/report/${b.reportId}`)}>
                          <FileText className="size-4" aria-hidden />
                          View report
                        </DropdownMenuItem>
                      )}
                      {b.payment.kind === "paid" && (
                        <DropdownMenuItem
                          onClick={() =>
                            void emailAiInterviewReceiptAction(b.id)
                              .then((r) => (r.ok ? toast.success("Receipt sent", "Check your inbox for the payment receipt.") : toast.error("Not sent", r.error)))
                              .catch(() => toast.error("Not sent", "Check your connection and try again."))
                          }
                        >
                          <Receipt className="size-4" aria-hidden />
                          Email my receipt
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => router.push("/mock-interviews/ai/new")}>
                        <RotateCcw className="size-4" aria-hidden />
                        Book a similar one
                      </DropdownMenuItem>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        )}
        <TablePagination paging={paging} />
      </section>

      <HowItWorks />
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Hero({ allowance, pricing, mounted }: { allowance: AllowanceState; pricing: PricingByDifficulty; mounted: boolean }) {
  const rate = rupees(lowestRatePerMinute(pricing));
  const example = aiInterviewQuote(30, pricing.Medium).final;
  const left = allowanceLeft(allowance);
  let headline: string;
  let note: string;
  if (allowance.kind === "plan") {
    headline = `${left} of ${allowance.included} included on ${allowance.planName}`;
    note = `Renews with your plan${mounted ? ` on ${longDate(allowance.periodEnds)}` : ""}; unused ones don't carry over. After that, from ${rate} a minute.`;
  } else if (allowance.kind === "free") {
    headline = left > 0 ? "1 free interview ready" : "Free interview used";
    note = left > 0 ? "The Free plan includes one AI interview, once, at any length." : `From ${rate} a minute; a 30-minute Medium interview is ${rupees(example)}.`;
  } else {
    headline = `From ${rate} a minute`;
    note = `Depends on difficulty; a 30-minute Medium interview is ${rupees(example)}. Paid plans include some interviews.`;
  }
  const pct = allowance.kind === "plan" ? (left / Math.max(1, allowance.included)) * 100 : left > 0 ? 100 : 0;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 md:flex-row md:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
            <Bot className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">AI mock interviews</h1>
            <p className="text-sm text-muted-foreground">Book an interview, start it when you&apos;re ready, and get a scored report.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 rounded-xl border bg-white/70 px-3 py-2 sm:w-64">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              {headline}
            </p>
            {allowance.kind !== "none" && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>
          </div>
          <Link
            href="/mock-interviews/ai/new"
            className={cn(buttonVariants({ size: "lg" }), "shrink-0 bg-gradient-to-r from-primary to-violet-600 text-white shadow-sm hover:opacity-90")}
          >
            <Plus className="size-4" aria-hidden />
            New interview
          </Link>
        </div>
      </div>
    </section>
  );
}

const TILE_TONE = {
  indigo: { icon: "bg-primary/10 text-primary", ring: "border-primary ring-2 ring-primary/20" },
  sky: { icon: "bg-sky-100 text-sky-700", ring: "border-sky-400 ring-2 ring-sky-200" },
  amber: { icon: "bg-amber-100 text-amber-700", ring: "border-amber-400 ring-2 ring-amber-200" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", ring: "border-emerald-400 ring-2 ring-emerald-200" },
} as const;

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  active,
  onClick,
}: {
  icon: LucideIcon;
  tone: keyof typeof TILE_TONE;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const t = TILE_TONE[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0",
        active && t.ring,
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-semibold tabular-nums">{value}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function PrimaryAction({ b }: { b: BookingRow }) {
  if (b.status === "ready")
    return (
      <Link
        href={`/mock-interviews/ai/prepare/${b.id}`}
        className={cn(buttonVariants(), "w-full bg-gradient-to-r from-primary to-violet-600 text-white hover:opacity-90")}
      >
        <PlayCircle className="size-4" aria-hidden />
        Start
      </Link>
    );
  if (b.status === "in_progress" || b.status === "interrupted")
    return (
      <div>
        <Link href={`/mock-interviews/ai/prepare/${b.id}`} className={cn(buttonVariants(), "w-full bg-amber-500 text-white hover:bg-amber-600")}>
          <Timer className="size-4" aria-hidden />
          Resume
        </Link>
        {b.resumeMinutesLeft !== undefined && (
          <p className="mt-0.5 text-center text-[10px] text-amber-700">{b.resumeMinutesLeft} min left to resume</p>
        )}
      </div>
    );
  if (b.status === "completed" && b.reportId)
    return (
      <Link href={`/mock-interviews/report/${b.reportId}`} className={cn(buttonVariants({ variant: "outline" }), "w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50")}>
        <FileText className="size-4" aria-hidden />
        View report
      </Link>
    );
  if (b.status === "no_answers")
    return (
      <Link href="/mock-interviews/ai/new" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
        <Plus className="size-4" aria-hidden />
        Book again
      </Link>
    );
  if (b.status === "failed")
    return (
      <Link href="/support" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
        <LifeBuoy className="size-4" aria-hidden />
        Get help
      </Link>
    );
  return <span className="block text-center text-xs text-muted-foreground">{b.status === "completed" ? "Report on its way" : "Expired"}</span>;
}

function PaidChip({ b }: { b: BookingRow }) {
  const p = b.payment;
  if (p.kind === "plan")
    return <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Included · {p.planName}</span>;
  if (p.kind === "free") return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Free interview</span>;
  if (p.kind === "credit") return <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Given back</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      {rupees(p.final)}
      {p.percent > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">{p.percent}% off</span>}
    </span>
  );
}

function ValidUntil({ b, mounted }: { b: BookingRow; mounted: boolean }) {
  if (!mounted) return null;
  if (b.status === "expired") return <span className="text-muted-foreground">Expired {shortDate(b.validUntil)}</span>;
  if (b.status === "completed" || b.status === "failed" || b.status === "no_answers") return <span className="text-muted-foreground">-</span>;
  const d = daysLeft(b, Date.now());
  return (
    <span className="inline-flex flex-col">
      <span>{shortDate(b.validUntil)}</span>
      {b.status === "ready" && d <= EXPIRING_DAYS && (
        <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
          <CalendarClock className="size-3" aria-hidden />
          {d <= 1 ? "Expires tomorrow" : `Expires in ${d} days`}
        </span>
      )}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <Bot className="mx-auto size-10 text-primary/60" aria-hidden />
      <p className="mt-2 font-medium">No interviews booked yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Book your first one and it&apos;ll wait here until you&apos;re ready.</p>
      <Link href="/mock-interviews/ai/new" className={cn(buttonVariants({ size: "lg" }), "mt-4")}>
        <Plus className="size-4" aria-hidden />
        New interview
      </Link>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Plus, title: "Book", text: "Pick the role, kind of interview, difficulty and length. Included or paid, it's booked right away." },
    { icon: PlayCircle, title: "Start when ready", text: "Your booking waits here. Change the setup until you start; difficulty and length stay as booked." },
    { icon: FileText, title: "Read your report", text: "Scores for five skills, what went well, what to fix and better ways to answer." },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold">How it works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-3 rounded-xl bg-muted/40 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon className="size-3.5 text-primary" aria-hidden />
                {title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

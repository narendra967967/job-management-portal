"use client";

import { useEffect, useMemo, useState } from "react";
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
  Download,
  Receipt,
  RotateCcw,
  Search,
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
  cheapestInterview,
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
import { InterviewsComingUp } from "@/components/leads/lead-practice";
import type { Readiness } from "@/lib/mock-interviews/data";
import { emailMyInvoicesAction } from "@/actions/my-payments";
import { LEVEL_TAG } from "@/components/mock-interviews/visual-kit";
import { useCountdown } from "@/components/mock-interviews/use-countdown";
import { CtaGlow, ctaClass } from "@/components/mock-interviews/cta";
import { cn } from "@/lib/utils";

// AI mock interviews: the candidate's booked AI interviews (spec D13a to D13d).
// Booking comes first, starting comes later: the New interview form books, then
// redirects here with the new booking highlighted.

const DAY = 86_400_000;
const EXPIRING_DAYS = 7;

const STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  ready: { label: "Ready to start", cls: "bg-primary/10 text-primary" },
  in_progress: { label: "In progress", cls: "bg-sky-50 text-sky-800" },
  interrupted: { label: "Paused", cls: "bg-amber-50 text-amber-800" },
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
  interrupted: "Paused",
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
  plansInclude = false,
  durations = [15, 30, 45, 60],
}: {
  allowance: AllowanceState;
  bookings: BookingRow[];
  pricing: PricingByDifficulty;
  /** Lengths admin offers, for the cheapest-interview example. */
  durations?: number[];
  bookedId?: string;
  readiness: Readiness;
  /** A paid plan on the pricing page includes AI interviews. */
  plansInclude?: boolean;
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
      {/* Get ready comes first: a thin "all set" bar once everything's done, the list while
          there's something to do. */}
      <GetReady readiness={readiness} allowance={allowance} pricing={pricing} hasBookings={bookings.length > 0} />

      {/* Wide screens (1280px+): the title on the left and the counts as a 2 × 2 grid on the
          right, the same height. Narrower: title, then the counts (four across from 1024px). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0">
          <Hero allowance={allowance} pricing={pricing} durations={durations} mounted={mounted} plansInclude={plansInclude} />
        </div>

        {/* Stat tiles: each one filters the list; click again to go back to "To do". */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2 xl:grid-rows-2">
          <Tile icon={PlayCircle} tone="indigo" label="Ready to start" value={counts.ready} active={view === "ready"} onClick={() => toggle("ready")} />
          <Tile icon={Timer} tone="sky" label="In progress" value={counts.progress} active={view === "in_progress"} onClick={() => toggle("in_progress")} />
          <Tile icon={AlarmClock} tone="amber" label="Expiring soon" value={counts.expiring} active={view === "expiring"} onClick={() => toggle("expiring")} />
          <Tile icon={CheckCircle2} tone="emerald" label="Completed this month" value={counts.month} active={view === "month"} onClick={() => toggle("month")} />
        </div>
      </div>

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

      {/* Interview-stage leads and where their practice stands (hidden when there are none). */}
      <InterviewsComingUp />

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
                      {b.category} · {b.topics.length === 0 ? "Whole role" : `${b.topics.length} ${b.topics.length === 1 ? "topic" : "topics"}`}
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
                      {b.payment.kind === "paid" && b.payment.orderId && (
                        <>
                          {/* The booking's invoice (also in Orders & payments). */}
                          <DropdownMenuItem onClick={() => window.open(`/api/invoices/${(b.payment as { orderId: string }).orderId}?download=1`, "_self")}>
                            <Download className="size-4" aria-hidden />
                            Download invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              void emailMyInvoicesAction([(b.payment as { orderId: string }).orderId])
                                .then((r) => (r.ok ? toast.success("Invoice on its way", "Check your inbox in a minute.") : toast.error("Not sent", r.error)))
                                .catch(() => toast.error("Not sent", "Check your connection and try again."))
                            }
                          >
                            <Receipt className="size-4" aria-hidden />
                            Email me the invoice
                          </DropdownMenuItem>
                        </>
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

function Hero({
  allowance,
  pricing,
  durations,
  mounted,
  plansInclude,
}: {
  allowance: AllowanceState;
  pricing: PricingByDifficulty;
  durations: number[];
  mounted: boolean;
  plansInclude: boolean;
}) {
  const rate = rupees(lowestRatePerMinute(pricing));
  // The cheapest booking possible, so the example never names a level.
  const cheapest = cheapestInterview(durations, pricing);
  const left = allowanceLeft(allowance);
  const from = <strong className="font-semibold text-foreground">from {rate} a minute</strong>;
  // The subtitle says what booking costs this user right now (it used to be a box beside the title).
  let line: React.ReactNode;
  if (allowance.kind === "plan") {
    const until = mounted ? ` until ${longDate(allowance.periodEnds)}` : "";
    line =
      left > 0 ? (
        <>
          <strong className="font-semibold text-foreground">
            {left} of {allowance.included} included {allowance.included === 1 ? "interview" : "interviews"} left
          </strong>{" "}
          on {allowance.planName}{until}. Unused ones don&apos;t carry over; after that, it&apos;s {from}.
        </>
      ) : (
        <>
          You&apos;ve used the interviews included on {allowance.planName}; more come with your plan{mounted ? ` on ${longDate(allowance.periodEnds)}` : ""}. Until
          then, it&apos;s {from}.
        </>
      );
  } else if (allowance.kind === "free" && left > 0) {
    line = (
      <>
        <strong className="font-semibold text-foreground">{left === 1 ? "Your free interview is ready" : `${left} free interviews are ready`}</strong>, at any
        length. Start it whenever you like and get a scored report.
      </>
    );
  } else {
    line = (
      <>
        {allowance.kind === "free" ? "Your free interview is used. Book another " : "Book an interview "}
        {from} (a {cheapest.durationMin}-minute one starts at {rupees(cheapest.pricePaise)}), start it when you&apos;re ready, and get a scored report.
        {plansInclude ? " Some paid plans include interviews." : ""}
      </>
    );
  }

  return (
    <section className="h-full overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex h-full flex-col justify-center gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 md:flex-row md:items-center md:p-5 xl:flex-col xl:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
            <Bot className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">AI mock interviews</h1>
            <p className="text-sm text-muted-foreground">{line}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaGlow className="w-full shrink-0 sm:w-auto">
            <Link href="/mock-interviews/ai/new" className={cn(ctaClass({ size: "md" }), "w-full sm:w-auto")}>
              <Plus aria-hidden />
              New interview
            </Link>
          </CtaGlow>
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
        {/* Phones see the Action column first, so the countdown sits here too; wider screens have it under Valid until. */}
        {b.resumeSecondsLeft !== undefined && (
          <p className="mt-0.5 text-center sm:hidden">
            <ResumeCountdown seconds={b.resumeSecondsLeft} compact />
          </p>
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

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/**
 * A paused interview's time left to resume, ticking down (D13f). The first
 * render uses the server's figure so it matches; the clock time ("by 4:32 PM")
 * fills in once the browser's clock is running. At zero the list refreshes and
 * the server closes the interview.
 */
function ResumeCountdown({ seconds, compact = false, refreshAtZero = false }: { seconds: number; compact?: boolean; refreshAtZero?: boolean }) {
  const router = useRouter();
  const { left, end } = useCountdown(seconds);
  const by = end === null ? null : new Date(end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const done = left === 0;
  useEffect(() => {
    if (!done || !refreshAtZero) return;
    const t = setTimeout(() => router.refresh(), 3000);
    return () => clearTimeout(t);
  }, [done, refreshAtZero, router]);

  if (compact)
    return <span className="text-[11px] font-semibold text-amber-700 tabular-nums">{done ? "Closing…" : `${mmss(left)} left`}</span>;
  return (
    <span className="inline-flex flex-col" role="timer" aria-live="off">
      <span className="inline-flex items-center gap-1 font-semibold text-amber-800 tabular-nums">
        <Timer className="size-3.5" aria-hidden />
        {done ? "Closing…" : `${mmss(left)} left to resume`}
      </span>
      {!done && by && <span className="mt-0.5 text-[11px] text-muted-foreground">Come back by {by}</span>}
    </span>
  );
}

function ValidUntil({ b, mounted }: { b: BookingRow; mounted: boolean }) {
  if (!mounted) return null;
  if (b.status === "expired") return <span className="text-muted-foreground">Expired {shortDate(b.validUntil)}</span>;
  if (b.status === "completed" || b.status === "failed" || b.status === "no_answers") return <span className="text-muted-foreground">-</span>;
  // Paused: what matters now is the time left to come back, not the booking date.
  if (b.status === "interrupted" && b.resumeSecondsLeft !== undefined) return <ResumeCountdown seconds={b.resumeSecondsLeft} refreshAtZero />;
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
      {/* The header has the pulsing one; this one holds still. */}
      <CtaGlow pulse={false} className="mt-4">
        <Link href="/mock-interviews/ai/new" className={ctaClass({ size: "md" })}>
          <Plus aria-hidden />
          New interview
        </Link>
      </CtaGlow>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Plus, title: "Book", text: "Pick the role, kind of interview, difficulty and length. Included or paid, it's booked right away." },
    { icon: PlayCircle, title: "Start when ready", text: "Your booking waits here. Change the setup until you start; difficulty and length stay as booked." },
    { icon: FileText, title: "Read your report", text: "Scores for five skills, what went well, what to fix and better ways to answer." },
  ];
  // A timeline: across from 1024px wide (a line joins the three circles), down
  // the left on phones and tablets. The last step, the report, is the payoff, so it's green.
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold">How it works</h2>
      <ol className="mt-4 grid gap-5 lg:grid-cols-3 lg:gap-4">
        {steps.map(({ icon: Icon, title, text }, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={title} className="relative flex gap-3 lg:flex-col lg:items-center lg:gap-2 lg:text-center">
              {!last && (
                <span
                  aria-hidden
                  className="absolute top-5 -bottom-5 left-5 w-0.5 -translate-x-1/2 bg-gradient-to-b from-primary/60 to-violet-500/40 lg:bottom-auto lg:left-1/2 lg:h-0.5 lg:w-[calc(100%+1rem)] lg:translate-x-0 lg:-translate-y-1/2 lg:bg-gradient-to-r"
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md ring-4 ring-card",
                  last ? "from-emerald-500 to-teal-600" : "from-primary to-violet-600",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5 lg:max-w-xs lg:pt-1">
                <p className={cn("text-[11px] font-semibold tracking-wide uppercase", last ? "text-emerald-700" : "text-primary")}>Step {i + 1}</p>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Briefcase, ChevronDown, CircleDashed, FileText, Ticket, UserRound, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { allowanceLeft, lowestRatePerMinute, rupees, type AllowanceState, type PricingByDifficulty } from "@/lib/mock-interviews/model";
import type { Readiness } from "@/lib/mock-interviews/data";
import { cn } from "@/lib/utils";

// "Get ready" on AI mock interviews: what's still missing before a good first
// interview, each with one tap to fix it. Shown while something is missing, or
// before the first booking; it folds away once everything's in place.

type State = "done" | "todo" | "optional";
interface Item {
  key: string;
  icon: LucideIcon;
  state: State;
  title: string;
  text: string;
  action?: { label: string; href: string };
  /** Needed to book at all (the others make the interview better). */
  required?: boolean;
}

export function GetReady({
  readiness: r,
  allowance,
  pricing,
  hasBookings,
}: {
  readiness: Readiness;
  allowance: AllowanceState;
  pricing: PricingByDifficulty;
  hasBookings: boolean;
}) {
  const left = allowanceLeft(allowance);
  const canBook = left > 0 || r.paymentAvailable;

  const items: Item[] = [
    {
      key: "booking",
      icon: Ticket,
      required: true,
      state: canBook ? "done" : "todo",
      title: left > 0 ? `${left} included interview${left === 1 ? "" : "s"} ready` : r.paymentAvailable ? "Pay per interview" : "No interviews available right now",
      text:
        left > 0
          ? "Book one whenever you like. It waits in your list until you start it."
          : r.paymentAvailable
            ? `Your plan has none left, so each one is paid for when you book: from ${rupees(lowestRatePerMinute(pricing))} a minute, depending on the difficulty.`
            : "Your plan doesn't include AI interviews, and paying for one online isn't available at the moment. A plan with interviews included gets you started.",
      ...(canBook ? {} : { action: { label: "See plans", href: "/settings?tab=plan" } }),
    },
    {
      key: "resume",
      icon: FileText,
      state: r.readableResumes > 0 ? "done" : "todo",
      title: r.readableResumes > 0 ? "Resume ready" : r.resumes > 0 ? "Your saved resume can't be read" : "Add your resume",
      text:
        r.readableResumes > 0
          ? `${r.readableResumes} saved resume${r.readableResumes === 1 ? "" : "s"} the interviewer can read. Pick one when you book.`
          : r.resumes > 0
            ? "We couldn't get text out of it, so the interviewer wouldn't see your experience. Upload it again as a PDF or Word (.docx) file, or paste the text when you book."
            : "The questions are built around your experience. Save your resume once and pick it in one tap; you can also paste it while booking.",
      ...(r.readableResumes > 0 ? {} : { action: { label: r.resumes > 0 ? "Fix my resume" : "Add a resume", href: "/settings?tab=resumes" } }),
    },
    {
      key: "career",
      icon: UserRound,
      state: r.career.complete ? "done" : "todo",
      title: r.career.complete ? "Career profile complete" : `Finish your career profile (${r.career.percent}% done)`,
      text: r.career.complete
        ? "Your target roles, skills and experience help pitch the questions at your level."
        : "Your target roles, skills and experience help the interviewer pitch questions at the right level, and the report judge you against them.",
      ...(r.career.complete ? {} : { action: { label: "Finish my profile", href: "/settings?tab=career" } }),
    },
    {
      key: "lead",
      icon: Briefcase,
      state: r.interviewLeads.count > 0 ? "done" : "optional",
      title: r.interviewLeads.first ? `Practice for ${r.interviewLeads.first.label}` : "Got a real interview coming up?",
      text:
        r.interviewLeads.count > 0
          ? `${r.interviewLeads.count === 1 ? "This lead is" : `${r.interviewLeads.count} leads are`} at the Interview stage. Practicing for it uses its job description, so the questions match that job.`
          : "Move its lead to the Interview stage and you can practice for that exact job. Or paste a job description when you book.",
      action: r.interviewLeads.first
        ? { label: "Prepare for it", href: `/mock-interviews/ai/new?lead=${encodeURIComponent(r.interviewLeads.first.id)}` }
        : { label: "Open my leads", href: "/leads" },
    },
  ];

  const counted = items.filter((i) => i.state !== "optional");
  const done = counted.filter((i) => i.state === "done").length;
  const allDone = done === counted.length;
  // Folded once everything's ready and there are bookings; open otherwise.
  const [open, setOpen] = useState(!(allDone && hasBookings));
  if (allDone && hasBookings && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl border bg-card px-4 text-left text-sm shadow-sm hover:bg-muted/40"
      >
        <BadgeCheck className="size-4 text-emerald-600" aria-hidden />
        <span className="font-medium">You&apos;re all set for your interviews</span>
        <ChevronDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </button>
    );
  }

  const pct = Math.round((done / counted.length) * 100);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="get-ready-title">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="get-ready-title" className="text-base font-semibold">
            {allDone ? "You're all set" : canBook ? "Get ready for a better interview" : "Before you can book"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {done} of {counted.length} ready
          </p>
        </div>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Ready">
          <div className={cn("h-full rounded-full transition-[width]", allDone ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        {allDone && hasBookings && (
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground sm:min-h-8">
            Hide
          </button>
        )}
      </div>
      <ul className="divide-y">
        {items.map((it) => (
          <li key={it.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                  it.state === "done" ? "bg-emerald-50 text-emerald-700" : it.state === "todo" ? (it.required ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700") : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {it.state === "done" ? <BadgeCheck className="size-5" /> : it.state === "optional" ? <CircleDashed className="size-5" /> : <it.icon className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="[overflow-wrap:anywhere]">{it.title}</span>
                  {it.state === "todo" && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", it.required ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>
                      {it.required ? "Needed to book" : "Recommended"}
                    </span>
                  )}
                  {it.state === "optional" && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Optional</span>}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{it.text}</p>
              </div>
            </div>
            {it.action && (
              <Link
                href={it.action.href}
                className={cn(buttonVariants({ variant: it.state === "todo" ? "default" : "outline" }), "min-h-11 shrink-0 sm:min-h-9")}
              >
                {it.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

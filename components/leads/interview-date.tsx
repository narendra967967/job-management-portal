"use client";

// The real interview's date on a lead (docs/lead-interview-link/roadmap.md,
// item 7): the row on the lead page, the dialog that sets it, and the prompt
// when a lead moves to Interview, which asks for the date and, while AI
// interviews are open, offers a practice.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MessagesSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionDialog, Field } from "@/components/leads/action-dialog";
import { setInterviewDate, setInterviewPromptHost, usePractice } from "@/lib/mock-store";
import { newPracticeHref } from "@/lib/lead-practice";
import { useMounted } from "@/lib/use-mounted";
import { interviewAhead, isJobOpen, type JobLead, type LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Thu, Nov 28, 10:00 AM" in the viewer's time zone. */
export function interviewWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "today", "tomorrow", "in 3 days", or "" once it has passed. */
export function interviewIn(iso: string, now = new Date()): string {
  const day = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  const at = new Date(iso);
  if (at.getTime() <= now.getTime()) return "";
  const days = day(at) - day(now);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

/** An ISO instant as a datetime-local value (the viewer's local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A datetime-local value checked for saving: an ISO instant, or an error. */
function checkLocal(value: string): { at: string } | { error: string } {
  if (!value) return { error: "Pick the date and time of the interview." };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: "Pick the date and time of the interview." };
  if (d.getTime() < Date.now() - 5 * 60_000) return { error: "That time has passed. Pick when the interview is." };
  return { at: d.toISOString() };
}

const HINT = "A day before, you get a reminder. Until then the lead won't go stale or be cleaned up.";

/** Set, change or remove the interview date. */
export function InterviewDateDialog({ lead, open, onOpenChange }: { lead: JobLead; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setValue(toLocalInput(lead.interviewAt));
      setError("");
    }
  }, [open, lead.interviewAt]);

  async function save(at: string | null) {
    setBusy(true);
    const ok = await setInterviewDate(lead.id, at);
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarClock className="size-4" aria-hidden />}
      title={lead.interviewAt ? "Change the interview date" : "When is the interview?"}
      description={`${lead.title} at ${lead.company}`}
      footer={
        <>
          {lead.interviewAt && (
            <Button variant="outline" disabled={busy} onClick={() => void save(null)} className="sm:mr-auto">
              Remove date
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              const c = checkLocal(value);
              if ("error" in c) setError(c.error);
              else void save(c.at);
            }}
          >
            Save date
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Field label="Date and time">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} className="h-11 sm:h-10" />
        </Field>
        {error ? <p className="text-xs text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">{HINT}</p>}
      </div>
    </ActionDialog>
  );
}

/** On the lead page: the interview date, or a way to add one at the Interview stage. */
export function InterviewDateRow({ lead, status, className }: { lead: JobLead; status: LeadStatus; className?: string }) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  if (!isJobOpen(status) || (status !== "interview" && !lead.interviewAt)) return null;
  const ahead = interviewAhead(lead);
  return (
    <>
      <div className={cn("flex items-start gap-2 text-sm", className)}>
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-status-interview-foreground sm:mt-1.5" aria-hidden />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        {lead.interviewAt ? (
          <span>
            <span className="text-muted-foreground">{ahead ? "Interview" : "Interview was"}</span>{" "}
            <span className="font-medium">{mounted ? interviewWhen(lead.interviewAt) : " "}</span>
            {mounted && ahead && <span className="text-muted-foreground"> ({interviewIn(lead.interviewAt)})</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">No interview date yet</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="-ml-2.5 min-h-11 text-primary sm:ml-0 sm:min-h-8">
          {lead.interviewAt ? <Pencil className="size-3.5" aria-hidden /> : null}
          {lead.interviewAt ? "Change" : "Add the date"}
        </Button>
        </div>
      </div>
      <InterviewDateDialog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Mounted once in the dashboard layout. When the user moves a lead to
 * Interview, asks when it is (optional) and, while AI interviews are open,
 * offers a practice. Every time, owner decision (November 24, 2026).
 */
export function InterviewPromptHost() {
  const router = useRouter();
  const { open: practiceOpen } = usePractice();
  const [lead, setLead] = useState<JobLead | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInterviewPromptHost((l) => {
      setLead(l);
      setValue(toLocalInput(l.interviewAt));
      setError("");
    });
    return () => setInterviewPromptHost(null);
  }, []);

  const close = () => setLead(null);
  /** Save the date if one was entered; false if it was entered wrong. */
  async function saveIfGiven(): Promise<boolean> {
    if (!lead || !value || value === toLocalInput(lead.interviewAt)) return true;
    const c = checkLocal(value);
    if ("error" in c) {
      setError(c.error);
      return false;
    }
    setBusy(true);
    const ok = await setInterviewDate(lead.id, c.at);
    setBusy(false);
    return ok;
  }

  return (
    <ActionDialog
      open={!!lead}
      onOpenChange={(o) => !o && close()}
      icon={<CalendarClock className="size-4" aria-hidden />}
      title="Moved to Interview"
      description={lead ? `${lead.title} at ${lead.company}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Not now
          </Button>
          {value && (
            <Button
              variant={practiceOpen ? "outline" : "default"}
              disabled={busy}
              onClick={async () => {
                if (await saveIfGiven()) close();
              }}
            >
              Save date
            </Button>
          )}
          {practiceOpen && lead && (
            <Button
              disabled={busy}
              onClick={async () => {
                const id = lead.id;
                if (!(await saveIfGiven())) return;
                close();
                router.push(newPracticeHref(id));
              }}
            >
              <MessagesSquare className="size-4" aria-hidden />
              Practice now
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-1.5">
        <Field label="When is the interview? (optional)">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} className="h-11 sm:h-10" />
        </Field>
        {error ? <p className="text-xs text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">{HINT}</p>}
        {practiceOpen && (
          <p className="pt-2 text-sm">
            Want to get ready? <span className="text-muted-foreground">Practice with a mock interview built from this job&apos;s description.</span>
          </p>
        )}
      </div>
    </ActionDialog>
  );
}

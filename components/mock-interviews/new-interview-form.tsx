"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  Bot,
  Briefcase,
  Building2,
  ChartColumn,
  Check,
  CheckCircle2,
  Circle,
  ClipboardPaste,
  Clock3,
  CodeXml,
  Cpu,
  Crown,
  FileText,
  FileUp,
  HeartHandshake,
  Kanban,
  Loader2,
  Lock,
  MessagesSquare,
  Network,
  Package,
  Rocket,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ChipInput } from "@/components/ui/chip-input";
import { InfoTip } from "@/components/ui/info-tip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useLeadDetail, useLeads, useResumes } from "@/lib/mock-store";
import { bookAiInterviewAction, updateAiBookingAction } from "@/actions/mock-interviews";
import type { BookingSetup } from "@/lib/mock-interviews/data";
import {
  DIFFICULTIES,
  DISCUSSION_CATEGORIES,
  INDUSTRIES,
  aiInterviewQuote,
  allowanceLeft,
  plannedQuestions,
  rupees,
  type AllowanceState,
  type Difficulty,
  type PricingByDifficulty,
} from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";
import { scrollIntoMain } from "@/components/mock-interviews/scroll-into-main";
import { LeadPicker } from "@/components/mock-interviews/lead-picker";

// New AI interview (spec D10, D11). R1.2: the form validates on the client and
// "starts" a sample session; R1.5 wires the allowance, payment and the AI.

const LIMITS = { role: 100, paste: 20_000, minJd: 100, minResume: 300, topics: 10, fileMb: 5 };

const TOPIC_SUGGESTIONS: Partial<Record<string, string[]>> = {
  "Project management": ["Risk management", "Stakeholder management", "Estimation", "Agile and Scrum", "Budget tracking"],
  "Product management": ["Prioritization", "Roadmaps", "Metrics", "User research", "Go-to-market"],
  "Behavioral interview": ["Conflict", "Failure and learning", "Leadership", "Teamwork", "Pressure and deadlines"],
  "Technical interview": ["Architecture", "Debugging", "Performance", "Testing", "Code review"],
  "System design": ["Scalability", "Caching", "Databases", "APIs", "Trade-offs"],
  Coding: ["Data structures", "Algorithms", "Complexity", "Problem breakdown"],
  "Data analytics": ["SQL", "Metrics", "A/B testing", "Dashboards", "Data cleaning"],
};
const DEFAULT_TOPICS = ["Past projects", "Strengths and weaknesses", "Why this role", "Teamwork", "Problem-solving"];

type ResumeMode = "saved" | "upload" | "paste";
type JdMode = "lead" | "paste" | "general";

export interface FormOptions {
  categories: string[];
  durations: number[];
  minutesPerQuestion: number;
  wrapUpMinutes: number;
  pricing: PricingByDifficulty;
}

export function NewInterviewForm({
  allowance,
  options,
  leadId: leadParam,
  editing,
}: {
  allowance: AllowanceState;
  options: FormOptions;
  leadId?: string;
  /** Editing a booking before it starts: difficulty and length stay as booked (D13c). */
  editing?: BookingSetup;
}) {
  const router = useRouter();
  const leads = useLeads();
  const resumes = useResumes();
  const leadId = leadParam ?? editing?.leadId ?? undefined;
  const fromLead = leadId ? leads.find((l) => l.id === leadId) : undefined;

  const [role, setRole] = useState(editing?.role ?? fromLead?.title ?? "");
  const [industry, setIndustry] = useState(editing?.industry ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(editing?.difficulty ?? "Medium");
  const [duration, setDuration] = useState<number>(editing?.durationMin ?? (options.durations.includes(30) ? 30 : options.durations[0]));
  // An uploaded file isn't kept, only its text, so editing shows that text.
  const [resumeMode, setResumeMode] = useState<ResumeMode>(
    editing ? (editing.resumeSource === "saved" ? "saved" : "paste") : resumes.length ? "saved" : "upload",
  );
  const [resumeId, setResumeId] = useState(editing?.resumeId ?? resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState(editing?.resumeText ?? "");
  const [jdMode, setJdMode] = useState<JdMode>(
    editing ? (editing.jobDescriptionSource === "none" ? "general" : editing.jobDescriptionSource) : fromLead ? "lead" : "paste",
  );
  const [jdLeadId, setJdLeadId] = useState(editing?.jobDescriptionSource === "lead" ? (editing.leadId ?? "") : (fromLead?.id ?? ""));
  const [jdText, setJdText] = useState(editing?.jobDescription ?? "");
  const [topics, setTopics] = useState<string[]>(editing?.topics ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Select shows the chosen item's label only when it knows the labels.
  const resumeLabels = useMemo(
    () => Object.fromEntries(resumes.map((r) => [r.id, r.isDefault ? `${r.label} (default)` : r.label])),
    [resumes],
  );
  const jdLead = useLeadDetail(jdLeadId);
  const jdLeadHasText = !!jdLead?.jdText?.trim();
  // Interview-stage leads first; every open lead is still pickable.
  const leadOptions = useMemo(
    () =>
      [...leads]
        .filter((l) => !["closed", "discarded"].includes(l.status))
        .sort((a, b) => Number(b.status === "interview") - Number(a.status === "interview")),
    [leads],
  );

  const questions = plannedQuestions(duration, options.minutesPerQuestion);
  const left = allowanceLeft(allowance);
  const pricing = options.pricing;
  const quote = aiInterviewQuote(duration, pricing[difficulty]);
  const price = quote.final;
  const included = left > 0;
  // Prices only matter for a new booking that isn't included.
  const showPrices = !included && !editing;

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!role.trim()) e.role = "Enter the role you're interviewing for.";
    else if (role.length > LIMITS.role) e.role = `Keep it under ${LIMITS.role} characters.`;
    if (!industry) e.industry = "Pick an industry.";
    if (!category) e.category = "Pick the kind of interview.";
    if (resumeMode === "saved" && !resumeId) e.resume = "Pick a saved resume, or upload or paste one.";
    if (resumeMode === "upload") {
      if (!file) e.resume = "Choose a PDF or Word (.docx) file.";
      else if (file.size > LIMITS.fileMb * 1024 * 1024) e.resume = `The file is over ${LIMITS.fileMb} MB.`;
    }
    if (resumeMode === "paste" && resumeText.trim().length < LIMITS.minResume)
      e.resume = `Paste your full resume (at least ${LIMITS.minResume} characters).`;
    if (jdMode === "lead") {
      if (!jdLeadId) e.jd = "Pick a lead.";
      else if (!jdLeadHasText) e.jd = "This lead has no job description saved. Paste one instead, or open the lead and add it.";
    }
    if (jdMode === "paste" && jdText.trim().length < LIMITS.minJd)
      e.jd = `Paste the job description (at least ${LIMITS.minJd} characters), or choose General preparation.`;
    if (topics.length === 0) e.topics = "Add at least one topic you want covered.";
    return e;
  }

  function start() {
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      scrollIntoMain(document.getElementById(`field-${first}`));
      return;
    }
    void submit();
  }

  // Books (spending the allowance) or saves the edit, then lands on the
  // bookings list with the booking highlighted (D13a). Paying for one outside
  // the allowance arrives with R1.5.
  async function submit() {
    setStarting(true);
    const form = new FormData();
    form.set(
      "setup",
      JSON.stringify({
        role: role.trim(),
        industry,
        category,
        difficulty,
        durationMin: duration,
        topics,
        leadId: leadId && fromLead ? leadId : null,
        resumeMode,
        resumeId: resumeMode === "saved" ? resumeId || null : null,
        resumeText: resumeMode === "paste" ? resumeText : "",
        jdMode,
        jdLeadId: jdMode === "lead" ? jdLeadId || null : null,
        jdText: jdMode === "paste" ? jdText : "",
      }),
    );
    if (resumeMode === "upload" && file) form.set("file", file);
    try {
      const r = editing ? await updateAiBookingAction(editing.id, form) : await bookAiInterviewAction(form);
      if (!r.ok) {
        if (r.field) {
          setErrors({ [r.field]: r.error });
          scrollIntoMain(document.getElementById(`field-${r.field}`));
        } else toast.error(editing ? "Not saved" : "Not booked", r.error);
        setStarting(false);
        return;
      }
      if (editing) {
        toast.success("Changes saved", "Your booking keeps its difficulty and length.");
        router.push("/mock-interviews/ai");
      } else router.push(`/mock-interviews/ai?booked=${r.id}`);
    } catch {
      toast.error("Something went wrong", "Check your connection and try again.");
      setStarting(false);
    }
  }

  // After the first Start, errors update as fields are fixed.
  const shownErrors = Object.keys(errors).length > 0;
  useEffect(() => {
    if (shownErrors) setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, industry, category, resumeMode, resumeId, file, resumeText, jdMode, jdLeadId, jdText, topics, jdLeadHasText]);

  const err = (k: string) =>
    errors[k] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[k]}
      </p>
    ) : null;

  // What's still missing, without showing errors before the first Start.
  const problems = validate();
  const checklist = [
    { key: "role", label: "Role" },
    { key: "industry", label: "Industry" },
    { key: "category", label: "Kind of interview" },
    { key: "resume", label: "Resume" },
    { key: "jd", label: "Job description" },
    { key: "topics", label: "Topics" },
  ].map((c) => ({ ...c, done: !problems[c.key] }));
  const readyCount = checklist.filter((c) => c.done).length;
  const stepDone = {
    interview: !problems.role && !problems.industry && !problems.category,
    job: !problems.resume && !problems.jd,
    topics: !problems.topics,
  };
  const startLabel = editing ? "Save changes" : included ? "Book interview" : `Pay ${rupees(price)} and book`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-20 lg:pb-0">
      <Link
        href="/mock-interviews/ai"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:min-h-0"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        AI mock interviews
      </Link>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 sm:flex-row sm:items-center md:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
            <Bot className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{editing ? "Edit your booking" : "Set up your interview"}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tell the interviewer what you&apos;re preparing for. It plans its questions around your answers here.
            </p>
          </div>
          <div className="w-full shrink-0 sm:w-44">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">Ready</span>
              <span className="tabular-nums text-muted-foreground">
                {readyCount} of {checklist.length}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  readyCount === checklist.length ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-violet-500",
                )}
                style={{ width: `${(readyCount / checklist.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
        {fromLead && (
          <p className="flex items-start gap-2 border-t bg-primary/5 px-4 py-2.5 text-sm md:px-5">
            <Briefcase className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Filled in from your lead <span className="font-medium">{fromLead.title}</span> at {fromLead.company}. Change
              anything you like.
            </span>
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {/* ---- Step 1: the interview ---- */}
          <Step n={1} title="The interview" done={stepDone.interview}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div id="field-role" className="space-y-1.5">
                <label htmlFor="mi-role" className="text-sm font-medium">
                  Role you&apos;re interviewing for
                </label>
                <div className="relative">
                  <Briefcase className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="mi-role"
                    value={role}
                    maxLength={LIMITS.role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Technical Project Manager"
                    aria-invalid={!!errors.role}
                    className="h-11 pl-9 sm:h-10"
                  />
                </div>
                {err("role")}
              </div>
              <div id="field-industry" className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">Industry</span>
                <Select value={industry} onValueChange={(v) => setIndustry(String(v ?? ""))}>
                  <SelectTrigger aria-label="Industry" aria-invalid={!!errors.industry} className="h-11 w-full sm:h-10">
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <SelectValue placeholder="Pick one" />
                    </span>
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-(--anchor-width)">
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("industry")}
              </div>
            </div>

            <fieldset id="field-category" className="space-y-2">
              <legend className="mb-2 flex items-center gap-1 text-sm font-medium">
                Kind of interview
                <InfoTip label="About Coding and System design">
                  Coding and System design are discussion interviews: you explain your approach in words. There&apos;s no code
                  editor.
                </InfoTip>
              </legend>
              <div
                className={cn(
                  "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4",
                  errors.category && "rounded-xl ring-2 ring-destructive/40 ring-offset-2",
                )}
              >
                {options.categories.map((c) => {
                  const Icon = CATEGORY_ICON[c] ?? MessagesSquare;
                  const on = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        on
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                          : "bg-white/60 hover:-translate-y-px hover:border-primary/40 hover:shadow-sm motion-reduce:hover:translate-y-0",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          on ? "bg-gradient-to-br from-primary to-violet-600 text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block leading-tight", on && "font-semibold text-primary")}>{c}</span>
                        {(DISCUSSION_CATEGORIES as readonly string[]).includes(c) && <span className="text-[10px] text-muted-foreground">Discussion</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {err("category")}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
                Difficulty
                {editing && <LockedNote />}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => {
                  const p = pricing[d];
                  const t = DIFFICULTY_TONE[d];
                  const on = difficulty === d;
                  const Icon = t.icon;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDifficulty(d)}
                      disabled={!!editing && !on}
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        on ? cn(t.on, "shadow-sm") : "bg-white/60 hover:border-slate-300",
                      )}
                    >
                      <Icon className={cn("size-5", on ? t.icon_on : "text-muted-foreground")} aria-hidden />
                      <span className={cn("font-semibold", on && t.text)}>{d}</span>
                      {/* Price per minute only matters when the interview isn't included. */}
                      {showPrices && (
                        <span className="flex flex-wrap items-center justify-center gap-1 text-[11px] text-muted-foreground">
                          {rupees(p.ratePerMinutePaise)}/min
                          {p.discountOn && p.discountPercent > 0 && (
                            <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">
                              {p.discountPercent}% off
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 flex items-center gap-1 text-sm font-medium">
                Length
                {editing && <LockedNote />}
                <InfoTip label="About the length">
                  The interviewer plans its questions to fit the time you pick. If time runs out mid-answer, it takes up to{" "}
                  {options.wrapUpMinutes} more minutes to wrap up.
                </InfoTip>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {options.durations.map((m) => {
                  const on = duration === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDuration(m)}
                      disabled={!!editing && !on}
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-2 transition-all disabled:cursor-not-allowed disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        on ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30" : "bg-white/60 hover:border-primary/40",
                      )}
                    >
                      <span className={cn("flex items-center gap-1 text-base font-semibold", on && "text-primary")}>
                        <Clock3 className="size-4" aria-hidden />
                        {m} min
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        about {plannedQuestions(m, options.minutesPerQuestion)} questions
                      </span>
                      {showPrices && (
                        <span className="text-[11px] font-semibold">{rupees(aiInterviewQuote(m, pricing[difficulty]).final)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Step>

          {/* ---- Step 2: you and the job ---- */}
          <Step n={2} title="You and the job" done={stepDone.job}>
            <fieldset id="field-resume" className="space-y-2">
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
                <FileText className="size-4 text-primary" aria-hidden />
                Your resume
              </legend>
              <Segmented
                value={resumeMode}
                onChange={(v) => setResumeMode(v as ResumeMode)}
                options={[
                  { value: "saved", label: "Saved", icon: FileText },
                  { value: "upload", label: "Upload", icon: FileUp },
                  { value: "paste", label: "Paste text", icon: ClipboardPaste },
                ]}
              />
              {resumeMode === "saved" &&
                (resumes.length ? (
                  <Select items={resumeLabels} value={resumeId} onValueChange={(v) => setResumeId(String(v ?? ""))}>
                    <SelectTrigger aria-label="Saved resume" className="h-11 w-full sm:h-10">
                      <SelectValue placeholder="Pick a resume" />
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-(--anchor-width)">
                      {resumes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                          {r.isDefault ? " (default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You haven&apos;t saved a resume yet. Upload one here, or add it in{" "}
                    <Link href="/settings?tab=resumes" className="text-primary hover:underline">
                      Settings → Resumes
                    </Link>
                    .
                  </p>
                ))}
              {resumeMode === "upload" && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      file ? "border-emerald-300 bg-emerald-50/60" : "border-primary/25 bg-primary/5 hover:border-primary/50",
                    )}
                  >
                    {file ? (
                      <>
                        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">Tap to choose another file</span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-6 text-primary" aria-hidden />
                        <span className="font-medium">Choose your resume</span>
                        <span className="text-xs text-muted-foreground">
                          PDF or Word, up to {LIMITS.fileMb} MB. Used for this interview only.
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
              {resumeMode === "paste" && (
                <MarkdownEditor
                  value={resumeText}
                  onChange={(v) => setResumeText(v.slice(0, LIMITS.paste))}
                  placeholder="Paste the text of your resume"
                  className="min-h-36"
                  ariaLabel="Resume text"
                />
              )}
              {err("resume")}
            </fieldset>

            <fieldset id="field-jd" className="space-y-2">
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Target className="size-4 text-primary" aria-hidden />
                Job description
              </legend>
              <Segmented
                value={jdMode}
                onChange={(v) => setJdMode(v as JdMode)}
                options={[
                  { value: "lead", label: "From a lead", icon: Briefcase },
                  { value: "paste", label: "Paste it", icon: ClipboardPaste },
                  { value: "general", label: "General preparation", icon: Sparkles },
                ]}
              />
              {jdMode === "lead" &&
                (leadOptions.length ? (
                  <>
                    <LeadPicker leads={leadOptions} value={jdLeadId} onChange={setJdLeadId} invalid={!!errors.jd} />
                    {jdLeadId && (
                      <p className={cn("text-xs", jdLeadHasText ? "text-muted-foreground" : "text-amber-700")}>
                        {jdLeadHasText ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                            The job description saved on this lead will be used.
                          </span>
                        ) : (
                          "No job description is saved on this lead."
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">You don&apos;t have any open leads. Paste the job description instead.</p>
                ))}
              {jdMode === "paste" && (
                <MarkdownEditor
                  value={jdText}
                  onChange={(v) => setJdText(v.slice(0, LIMITS.paste))}
                  placeholder="Paste the job description"
                  className="min-h-36"
                  ariaLabel="Job description"
                />
              )}
              {jdMode === "general" && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  No specific job: the questions follow the role, industry and kind of interview you picked.
                </p>
              )}
              {err("jd")}
            </fieldset>
          </Step>

          {/* ---- Step 3: topics ---- */}
          <Step n={3} title="Topics to cover" done={stepDone.topics}>
            <div id="field-topics" className="space-y-1.5">
              <ChipInput
                value={topics}
                onChange={setTopics}
                max={LIMITS.topics}
                suggestions={TOPIC_SUGGESTIONS[category] ?? DEFAULT_TOPICS}
                placeholder="Type a topic and press Enter"
                ariaLabel="Topics to cover"
                invalid={!!errors.topics}
              />
              <p className="text-xs text-muted-foreground">Up to {LIMITS.topics}. The interviewer makes sure these come up.</p>
              {err("topics")}
            </div>
          </Step>
        </div>

        {/* ---- Summary ---- */}
        <aside className="lg:sticky lg:top-0" aria-label="Your interview">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="bg-gradient-to-br from-primary to-violet-600 p-4 text-white">
              <p className="text-[11px] font-semibold tracking-wide text-white/75 uppercase">Your interview</p>
              <p className="mt-1 line-clamp-2 text-base font-semibold">{role.trim() || "Role not set yet"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {[category || "Kind not set", difficulty, `${duration} min`].map((t) => (
                  <span key={t} className="rounded-md bg-white/15 px-1.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <dl className="grid grid-cols-2 divide-x border-b text-center">
              <div className="p-3">
                <dt className="text-[11px] text-muted-foreground">Questions</dt>
                <dd className="text-lg font-semibold tabular-nums">~{questions}</dd>
              </div>
              <div className="p-3">
                <dt className="text-[11px] text-muted-foreground">Cost</dt>
                <dd className="text-lg font-semibold">
                  {editing ? (
                    <span className="text-emerald-700">Booked</span>
                  ) : included ? (
                    <span className="text-emerald-700">Included</span>
                  ) : (
                    <span className="inline-flex flex-wrap items-baseline justify-center gap-1.5">
                      {quote.percent > 0 && <s className="text-xs font-normal text-muted-foreground">{rupees(quote.full)}</s>}
                      {rupees(price)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                {editing ? (
                  "Already booked. Saving changes costs nothing."
                ) : included ? (
                  allowance.kind === "free" ? (
                    "Uses your one free AI interview."
                  ) : (
                    `Uses 1 of the ${left} interviews left on your plan.`
                  )
                ) : (
                  <>
                    {duration} minutes at {rupees(pricing[difficulty].ratePerMinutePaise)} a minute
                    {quote.percent > 0 && (
                      <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        {quote.percent}% off
                      </span>
                    )}
                  </>
                )}
              </p>

              <ul className="space-y-1.5" aria-label="What's ready">
                {checklist.map((c) => (
                  <li key={c.key} className="flex items-center gap-2 text-sm">
                    {c.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                    )}
                    <span className={cn(!c.done && "text-muted-foreground")}>{c.label}</span>
                    <span className="sr-only">{c.done ? "ready" : "not ready yet"}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="hidden w-full bg-gradient-to-r from-primary to-violet-600 text-white shadow-sm hover:opacity-90 lg:inline-flex"
                size="lg"
                onClick={start}
                disabled={starting}
              >
                {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
                {startLabel}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Your answers are processed by an AI service to produce your feedback.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Phones and tablets: the start button stays in reach (right padding keeps it clear of the help bubble). */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 rounded-2xl border bg-card/95 p-3 pr-[4.75rem] shadow-md backdrop-blur sm:pr-[5.25rem] lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">
            {readyCount} of {checklist.length} ready · ~{questions} questions
          </p>
          <p className="truncate text-sm font-semibold">{editing ? "Already booked" : included ? "Included in your plan" : rupees(price)}</p>
        </div>
        <Button
          className="shrink-0 bg-gradient-to-r from-primary to-violet-600 text-white shadow-sm hover:opacity-90"
          size="lg"
          onClick={start}
          disabled={starting}
        >
          {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
          {startLabel}
        </Button>
      </div>
    </div>
  );
}

// Admin can add kinds of interview; those without an icon here get a speech bubble.
const CATEGORY_ICON: Partial<Record<string, LucideIcon>> = {
  "HR interview": Users,
  "Technical interview": Cpu,
  "Behavioral interview": HeartHandshake,
  "Managerial interview": Briefcase,
  "Product management": Package,
  "Project management": Kanban,
  "System design": Network,
  Coding: CodeXml,
  "Data analytics": ChartColumn,
  Leadership: Crown,
  "Case study": BookOpenCheck,
  "Final round": Trophy,
};

/** Difficulty colors: green, amber, red, always with the word and a signal icon. */
const DIFFICULTY_TONE: Record<Difficulty, { on: string; text: string; icon: LucideIcon; icon_on: string }> = {
  Easy: { on: "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300", text: "text-emerald-800", icon: SignalLow, icon_on: "text-emerald-600" },
  Medium: { on: "border-amber-400 bg-amber-50 ring-1 ring-amber-300", text: "text-amber-800", icon: SignalMedium, icon_on: "text-amber-600" },
  Hard: { on: "border-rose-400 bg-rose-50 ring-1 ring-rose-300", text: "text-rose-800", icon: SignalHigh, icon_on: "text-rose-600" },
};

function LockedNote() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Lock className="size-3" aria-hidden />
      Set when you booked
    </span>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white transition-colors",
            done ? "bg-emerald-500" : "bg-gradient-to-br from-primary to-violet-600",
          )}
          aria-hidden
        >
          {done ? <Check className="size-4" /> : n}
        </span>
        {title}
        {done && <span className="text-xs font-medium text-emerald-700">Done</span>}
      </h2>
      {children}
    </section>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-xl bg-muted/60 p-1 sm:inline-grid"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors sm:min-h-9 sm:px-3",
            value === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

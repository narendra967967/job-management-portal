"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ChipInput } from "@/components/ui/chip-input";
import { InfoTip } from "@/components/ui/info-tip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { useLeadDetail, useLeads, useResumes } from "@/lib/mock-store";
import { SAMPLE_SETTINGS } from "@/lib/mock-interviews/sample-data";
import {
  AI_DURATIONS,
  DIFFICULTIES,
  DISCUSSION_CATEGORIES,
  INDUSTRIES,
  INTERVIEW_CATEGORIES,
  aiInterviewPrice,
  allowanceLeft,
  plannedQuestions,
  rupees,
  type AllowanceState,
} from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";
import { scrollIntoMain } from "@/components/mock-interviews/scroll-into-main";

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

export function NewInterviewForm({
  allowance,
  allowanceKey,
  leadId,
}: {
  allowance: AllowanceState;
  allowanceKey: string;
  leadId?: string;
}) {
  const router = useRouter();
  const leads = useLeads();
  const resumes = useResumes();
  const fromLead = leadId ? leads.find((l) => l.id === leadId) : undefined;

  const [role, setRole] = useState(fromLead?.title ?? "");
  const [industry, setIndustry] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [duration, setDuration] = useState<number>(30);
  const [resumeMode, setResumeMode] = useState<ResumeMode>(resumes.length ? "saved" : "upload");
  const [resumeId, setResumeId] = useState(resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>(fromLead ? "lead" : "paste");
  const [jdLeadId, setJdLeadId] = useState(fromLead?.id ?? "");
  const [jdText, setJdText] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const questions = plannedQuestions(duration, SAMPLE_SETTINGS.minutesPerQuestion);
  const left = allowanceLeft(allowance);
  const price = aiInterviewPrice(duration, SAMPLE_SETTINGS.ratePerMinutePaise);
  const included = left > 0;

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!role.trim()) e.role = "Enter the role you're interviewing for.";
    else if (role.length > LIMITS.role) e.role = `Keep it under ${LIMITS.role} characters.`;
    if (!industry) e.industry = "Pick an industry.";
    if (!category) e.category = "Pick the kind of interview.";
    if (resumeMode === "saved" && !resumeId) e.resume = "Pick a saved resume, or upload or paste one.";
    if (resumeMode === "upload") {
      if (!file) e.resume = "Choose a PDF or Word file.";
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
    setStarting(true);
    // SAMPLE: R1.5 spends the allowance or opens Razorpay checkout, then creates the session.
    if (!included) toast.info("Sample: payment happens here", `Razorpay checkout for ${rupees(price)} opens in the real version.`);
    setTimeout(() => router.push("/mock-interviews/ai/session/sample"), 600);
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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SampleBanner
        previews={[
          { label: "Plan allowance", href: `/mock-interviews/ai/new?allowance=plan${leadId ? `&lead=${leadId}` : ""}`, active: allowanceKey === "plan" },
          { label: "Free plan", href: `/mock-interviews/ai/new?allowance=free${leadId ? `&lead=${leadId}` : ""}`, active: allowanceKey === "free" },
          { label: "Nothing included", href: `/mock-interviews/ai/new?allowance=none${leadId ? `&lead=${leadId}` : ""}`, active: allowanceKey === "none" },
        ]}
      />
      <div>
        <Link href={`/mock-interviews/ai?allowance=${allowanceKey}`} className="text-xs text-muted-foreground hover:text-foreground">
          ← AI mock interviews
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">New interview</h1>
      </div>

      {fromLead && (
        <div className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <Briefcase className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>
            Filled in from your lead <span className="font-medium">{fromLead.title}</span> at {fromLead.company}. Change anything you like.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="space-y-4">
          {/* ---- The interview ---- */}
          <section className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
            <h2 className="text-sm font-medium">The interview</h2>

            <div id="field-role" className="space-y-1.5">
              <label htmlFor="mi-role" className="text-sm font-medium">
                Role you&apos;re interviewing for
              </label>
              <Input
                id="mi-role"
                value={role}
                maxLength={LIMITS.role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Technical Project Manager"
                aria-invalid={!!errors.role}
                className="h-11 sm:h-9"
              />
              {err("role")}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div id="field-industry" className="space-y-1.5">
                <span className="text-sm font-medium">Industry</span>
                <Select value={industry} onValueChange={(v) => setIndustry(String(v ?? ""))}>
                  <SelectTrigger aria-label="Industry" aria-invalid={!!errors.industry} className="h-11 w-full sm:h-9">
                    <SelectValue placeholder="Pick one" />
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
              <div id="field-category" className="space-y-1.5">
                <span className="flex items-center gap-1 text-sm font-medium">
                  Kind of interview
                  <InfoTip label="About Coding and System design">
                    Coding and System design are discussion interviews: you explain your approach in words. There&apos;s no code editor.
                  </InfoTip>
                </span>
                <Select value={category} onValueChange={(v) => setCategory(String(v ?? ""))}>
                  <SelectTrigger aria-label="Kind of interview" aria-invalid={!!errors.category} className="h-11 w-full sm:h-9">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                  <SelectContent className="w-auto min-w-(--anchor-width)">
                    {INTERVIEW_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                        {DISCUSSION_CATEGORIES.includes(c) ? " (discussion)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("category")}
              </div>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 text-sm font-medium">Difficulty</legend>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <ChoiceButton key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                    {d}
                  </ChoiceButton>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 flex items-center gap-1 text-sm font-medium">
                Length
                <InfoTip label="About the length">
                  The interviewer plans its questions to fit the time you pick. If time runs out mid-answer, it takes up to{" "}
                  {SAMPLE_SETTINGS.wrapUpMinutes} more minutes to wrap up.
                </InfoTip>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AI_DURATIONS.map((m) => (
                  <ChoiceButton key={m} selected={duration === m} onClick={() => setDuration(m)} className="flex-col py-2">
                    <span className="font-semibold">{m} min</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      about {plannedQuestions(m, SAMPLE_SETTINGS.minutesPerQuestion)} questions
                    </span>
                  </ChoiceButton>
                ))}
              </div>
            </fieldset>
          </section>

          {/* ---- You and the job ---- */}
          <section className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
            <h2 className="text-sm font-medium">You and the job</h2>

            <fieldset id="field-resume" className="space-y-2">
              <legend className="mb-1.5 text-sm font-medium">Your resume</legend>
              <Segmented
                value={resumeMode}
                onChange={(v) => setResumeMode(v as ResumeMode)}
                options={[
                  { value: "saved", label: "Saved" },
                  { value: "upload", label: "Upload" },
                  { value: "paste", label: "Paste text" },
                ]}
              />
              {resumeMode === "saved" &&
                (resumes.length ? (
                  <Select value={resumeId} onValueChange={(v) => setResumeId(String(v ?? ""))}>
                    <SelectTrigger aria-label="Saved resume" className="h-11 w-full sm:h-9">
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
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" aria-hidden />
                    {file ? "Choose another file" : "Choose a file"}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {file ? (
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <FileText className="size-3.5" aria-hidden />
                        {file.name}
                      </span>
                    ) : (
                      `PDF or Word, up to ${LIMITS.fileMb} MB. It's used for this interview only.`
                    )}
                  </p>
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
              <legend className="mb-1.5 text-sm font-medium">Job description</legend>
              <Segmented
                value={jdMode}
                onChange={(v) => setJdMode(v as JdMode)}
                options={[
                  { value: "lead", label: "From a lead" },
                  { value: "paste", label: "Paste it" },
                  { value: "general", label: "General preparation" },
                ]}
              />
              {jdMode === "lead" &&
                (leadOptions.length ? (
                  <>
                    <Select value={jdLeadId} onValueChange={(v) => setJdLeadId(String(v ?? ""))}>
                      <SelectTrigger aria-label="Lead" className="h-11 w-full sm:h-9">
                        <SelectValue placeholder="Pick a lead" />
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-(--anchor-width)">
                        {leadOptions.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.title} · {l.company}
                            {l.status === "interview" ? " (Interview)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <p className="text-xs text-muted-foreground">
                  No specific job: the questions follow the role, industry and kind of interview you picked.
                </p>
              )}
              {err("jd")}
            </fieldset>

            <div id="field-topics" className="space-y-1.5">
              <span className="text-sm font-medium">Topics to cover</span>
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
          </section>
        </div>

        {/* ---- Summary ---- */}
        <aside className="space-y-3 rounded-xl border bg-card p-4 lg:sticky lg:top-0">
          <h2 className="text-sm font-medium">Summary</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Length" value={`${duration} min`} />
            <Row label="Questions" value={`about ${questions}, plus follow-ups`} />
            <Row label="Difficulty" value={difficulty} />
            <Row label="Cost" value={included ? "Included" : rupees(price)} strong />
          </dl>
          <p className="text-xs text-muted-foreground">
            {included
              ? allowance.kind === "free"
                ? "Uses your one free AI interview."
                : `Uses 1 of the ${left} interviews left on your plan.`
              : `${duration} minutes at ${rupees(SAMPLE_SETTINGS.ratePerMinutePaise)} a minute.`}
          </p>
          <Button className="w-full" size="lg" onClick={start} disabled={starting}>
            {starting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {included ? "Start interview" : `Pay ${rupees(price)} and start`}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Your answers are processed by an AI service to produce your feedback.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30" : "bg-white/50 hover:border-primary/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" className="grid gap-1 rounded-lg bg-muted/60 p-1 sm:inline-grid" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-md px-2 text-xs font-medium transition-colors sm:min-h-8 sm:px-3",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

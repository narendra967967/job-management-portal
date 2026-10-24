"use client";

// Settings → Career profile. Nine section cards that each save on their own
// (actions/career.ts), plus a completion card at the top: the six items the
// résumé ATS check needs. Shape, options and validation: lib/career-profile-model.ts.

import { cloneElement, isValidElement, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { z } from "zod";
import { cn } from "@/lib/utils";
import { COUNTRY_OPTIONS } from "@/lib/geo";
import { useProfile } from "@/lib/mock-store";
import { getCareerProfileAction, saveCareerSectionAction } from "@/actions/career";
import {
  CURRENCY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  EMPTY_CERTIFICATION,
  EMPTY_EDUCATION,
  EMPTY_EXPERIENCE,
  GENDER_OPTIONS,
  INDUSTRY_SUGGESTIONS,
  LANGUAGE_SUGGESTIONS,
  LIMITS,
  MIN_SKILLS,
  MONTHS,
  NOTICE_PERIOD_OPTIONS,
  PAY_PERIOD_OPTIONS,
  ROLE_SUGGESTIONS,
  SECTION_SCHEMAS,
  SENIORITY_OPTIONS,
  SKILL_SUGGESTIONS,
  SUMMARY_MIN,
  SUMMARY_TIP,
  TOOL_SUGGESTIONS,
  WORK_MODE_OPTIONS,
  YEAR_MAX,
  YEAR_MIN,
  YES_NO_PREFER_OPTIONS,
  careerCompletion,
  plainLength,
  type CareerProfile,
  type Pay,
  type SectionKey,
  type SectionValues,
} from "@/lib/career-profile-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipInput } from "@/components/ui/chip-input";
import { InfoTip } from "@/components/ui/info-tip";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { toast } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Options = readonly (readonly [string, string])[];

const FIELD_CLS = "h-11 bg-white/50 sm:h-9";

/* ---------------- tab ---------------- */

export function CareerProfileTab() {
  const router = useRouter();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getCareerProfileAction()
      .then(setProfile)
      .catch(() => setLoadError(true));
  }, []);

  if (loadError) {
    return (
      <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Couldn&apos;t load your career profile. Refresh the page to try again.
      </section>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border bg-card" />
        ))}
      </div>
    );
  }

  const onSaved = (p: CareerProfile) => {
    setProfile(p);
    router.refresh(); // header completion notice
  };
  const props = { profile, onSaved };

  return (
    <div className="space-y-4">
      <CompletionCard profile={profile} />
      <BasicsSection {...props} />
      <SummarySection {...props} />
      <SkillsSection {...props} />
      <ExperienceSection {...props} />
      <EducationSection {...props} />
      <CertificationsSection {...props} />
      <EligibilitySection {...props} />
      <PreferencesSection {...props} />
      <OptionalSection {...props} />
    </div>
  );
}

interface SectionProps {
  profile: CareerProfile;
  onSaved: (p: CareerProfile) => void;
}

/* ---------------- completion ---------------- */

function scrollToSection(key: SectionKey) {
  document.getElementById(`career-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CompletionCard({ profile }: { profile: CareerProfile }) {
  const { items, percent, complete } = careerCompletion(profile);
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{complete ? "Career profile complete" : "Complete your career profile"}</h2>
        <span className={cn("text-sm font-semibold tabular-nums", complete ? "text-status-applied-foreground" : "text-primary")}>
          {percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Career profile completion">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", complete ? "bg-status-applied-foreground" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!complete && (
        <ul className="mt-3 grid gap-x-4 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key}>
              <button
                type="button"
                onClick={() => scrollToSection(i.section)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 text-left text-xs sm:min-h-8",
                  i.done ? "text-muted-foreground" : "font-medium text-foreground hover:text-primary",
                )}
              >
                {i.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-status-applied-foreground" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cn(i.done && "line-through decoration-muted-foreground/40")}>{i.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- section plumbing ---------------- */

/** Zod issue → one readable line ("Experience 2: Add the company."). */
function describeIssue(err: z.ZodError, itemLabel?: string): { message: string; index: number | null } {
  const issue = err.issues[0];
  if (!issue) return { message: "Check the highlighted fields.", index: null };
  const idx = issue.path.find((p) => typeof p === "number") as number | undefined;
  return {
    message: idx != null && itemLabel ? `${itemLabel} ${idx + 1}: ${issue.message}` : issue.message,
    index: idx ?? null,
  };
}

function useSection<K extends SectionKey>(
  key: K,
  saved: SectionValues<K>,
  onSaved: (p: CareerProfile) => void,
  itemLabel?: string,
) {
  const snap = JSON.stringify(saved);
  const [v, setV] = useState<SectionValues<K>>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [badIndex, setBadIndex] = useState<number | null>(null);

  // Re-sync only when THIS section's saved values change (other sections saving
  // must not wipe unsaved edits here).
  useEffect(() => {
    setV(JSON.parse(snap));
    setError("");
  }, [snap]);

  const dirty = JSON.stringify(v) !== snap;

  async function save() {
    const parsed = (SECTION_SCHEMAS[key] as z.ZodType).safeParse(v);
    if (!parsed.success) {
      const d = describeIssue(parsed.error, itemLabel);
      setError(d.message);
      setBadIndex(d.index);
      return;
    }
    setError("");
    setBadIndex(null);
    setBusy(true);
    const res = await saveCareerSectionAction(key, v);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Saved");
    onSaved(res.profile);
  }

  const patch = (p: Partial<SectionValues<K>>) => setV((prev) => ({ ...prev, ...p }));
  return { v, setV, patch, dirty, busy, error, badIndex, save };
}

function SectionCard({
  id,
  title,
  tip,
  required,
  dirty,
  busy,
  error,
  onSave,
  children,
}: {
  id: SectionKey;
  title: string;
  tip?: React.ReactNode;
  required?: boolean;
  dirty: boolean;
  busy: boolean;
  error: string;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={`career-${id}`} className="scroll-mt-4 rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {required && <span className="text-xs text-destructive" aria-label="has required fields">*</span>}
        {tip && <InfoTip label={`About ${title}`}>{tip}</InfoTip>}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={onSave} disabled={!dirty || busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save"}
        </Button>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : (
          dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  tip,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  tip?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  // Plain text inputs get linked to the visible label; other controls (selects,
  // chips, editors) carry their own aria-label.
  const id = useId();
  const linked = isValidElement(children) && children.type === Input;
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {linked ? <label htmlFor={id}>{label}</label> : label}
        {required && <span className="text-destructive">*</span>}
        {tip && <InfoTip label={`About ${label}`}>{tip}</InfoTip>}
      </span>
      {linked ? cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
    </div>
  );
}

const NONE = "__none";

function Choice({
  value,
  onChange,
  options,
  placeholder = "Select",
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Options;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const items: Record<string, string> = { [NONE]: placeholder, ...Object.fromEntries(options) };
  return (
    <Select items={items} value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : String(v))}>
      <SelectTrigger aria-label={ariaLabel} className={cn("h-11 w-full min-w-0 bg-white/50 sm:h-9", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Multi-select as toggle pills (small fixed sets: work mode, employment type). */
function TogglePills({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: Options;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(([v, l]) => {
        const on = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors sm:min-h-9",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "border-input bg-white/50 hover:bg-white/80",
            )}
          >
            {on && <CheckCircle2 className="size-3.5" aria-hidden />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** Yes / No; tapping the selected answer again clears it. */
function YesNo({ value, onChange, ariaLabel }: { value: boolean | null; onChange: (v: boolean | null) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid max-w-xs grid-cols-2 gap-2">
      {([true, false] as const).map((b) => {
        const on = value === b;
        return (
          <button
            key={String(b)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : b)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm transition-colors sm:min-h-9",
              on ? "border-primary bg-primary/10 font-medium text-primary" : "border-input bg-white/50 hover:bg-white/80",
            )}
          >
            <span className={cn("size-3.5 rounded-full border-2", on ? "border-primary bg-primary shadow-[inset_0_0_0_2px_white]" : "border-muted-foreground/50")} />
            {b ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

const YEAR_OPTIONS: Options = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => {
  const y = String(YEAR_MAX - i);
  return [y, y] as const;
});
const MONTH_OPTIONS: Options = MONTHS.map((m, i) => [String(i + 1), m] as const);

function MonthYear({
  month,
  year,
  onChange,
  label,
}: {
  month: number | null;
  year: number | null;
  onChange: (m: number | null, y: number | null) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Choice
        ariaLabel={`${label} month`}
        placeholder="Month"
        options={MONTH_OPTIONS}
        value={month ? String(month) : ""}
        onChange={(v) => onChange(v ? Number(v) : null, year)}
      />
      <Choice
        ariaLabel={`${label} year`}
        placeholder="Year"
        options={YEAR_OPTIONS}
        value={year ? String(year) : ""}
        onChange={(v) => onChange(month, v ? Number(v) : null)}
      />
    </div>
  );
}

/** Up / down / remove controls for a repeatable entry (touch-friendly reorder). */
function EntryControls({
  index,
  count,
  onMove,
  onRemove,
  what,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  what: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" aria-label={`Move ${what} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Move ${what} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Remove ${what}`} onClick={onRemove} className="text-destructive hover:text-destructive">
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A collapsible row for one repeatable entry. */
function EntryRow({
  title,
  subtitle,
  open,
  onToggle,
  invalid,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  invalid?: boolean;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white/45", invalid && "border-destructive/60")}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{title}</span>
            {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
          </span>
        </button>
        {controls}
      </div>
      {open && <div className="space-y-3 border-t px-3 pt-3 pb-4">{children}</div>}
    </div>
  );
}

function AddButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} className="bg-white/50">
      <Plus className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

/* ---------------- A. Basic info ---------------- */

const YEARS_OPTIONS: Options = Array.from({ length: 51 }, (_, i) => [
  String(i),
  i === 0 ? "Less than 1 year" : i === 1 ? "1 year" : i === 50 ? "50+ years" : `${i} years`,
] as const);

function BasicsSection({ profile, onSaved }: SectionProps) {
  const me = useProfile();
  const s = useSection(
    "basics",
    {
      currentTitle: profile.currentTitle,
      city: profile.city,
      yearsExperience: profile.yearsExperience,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
    },
    onSaved,
  );
  return (
    <SectionCard id="basics" title="Basic info" required dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      <div className="rounded-xl border bg-white/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">From your profile</span>
          <Link href="/settings?tab=profile" className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline sm:min-h-0">
            Edit
          </Link>
        </div>
        <dl className="mt-1 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Name", me.name],
            ["Email", me.email],
            ["Phone", me.mobile],
            ["Country", me.country],
          ].map(([k, val]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="truncate">{val || <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current or last job title" required>
          <Input className={FIELD_CLS} value={s.v.currentTitle} maxLength={LIMITS.text} placeholder="e.g. Technical Project Manager" onChange={(e) => s.patch({ currentTitle: e.target.value })} />
        </Field>
        <Field label="Total years of experience" required>
          <Choice
            ariaLabel="Total years of experience"
            options={YEARS_OPTIONS}
            value={s.v.yearsExperience == null ? "" : String(s.v.yearsExperience)}
            onChange={(v) => s.patch({ yearsExperience: v === "" ? null : Number(v) })}
          />
        </Field>
        <Field label="Current city">
          <Input className={FIELD_CLS} value={s.v.city} maxLength={LIMITS.text} placeholder="e.g. Gurugram" onChange={(e) => s.patch({ city: e.target.value })} />
        </Field>
        <Field label="LinkedIn profile">
          <Input className={FIELD_CLS} type="url" inputMode="url" value={s.v.linkedinUrl} maxLength={LIMITS.url} placeholder="https://www.linkedin.com/in/…" onChange={(e) => s.patch({ linkedinUrl: e.target.value })} />
        </Field>
        <Field label="Portfolio, GitHub or website" className="sm:col-span-2">
          <Input className={FIELD_CLS} type="url" inputMode="url" value={s.v.portfolioUrl} maxLength={LIMITS.url} placeholder="https://…" onChange={(e) => s.patch({ portfolioUrl: e.target.value })} />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ---------------- B. Summary ---------------- */

function SummarySection({ profile, onSaved }: SectionProps) {
  const s = useSection("summary", { summary: profile.summary }, onSaved);
  const n = plainLength(s.v.summary);
  return (
    <SectionCard
      id="summary"
      title="Professional summary"
      required
      tip={<>A few lines on who you are, what you deliver and your strongest results. Recruiters skim this first — aim for {SUMMARY_TIP}+ characters.</>}
      dirty={s.dirty}
      busy={s.busy}
      error={s.error}
      onSave={s.save}
    >
      <MarkdownEditor
        value={s.v.summary}
        onChange={(v) => s.patch({ summary: v.slice(0, LIMITS.summary) })}
        placeholder="e.g. Technical Delivery Manager with 6+ years delivering B2B SaaS platforms…"
        className="min-h-40"
        ariaLabel="Professional summary"
      />
      <p className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {n < SUMMARY_MIN ? `At least ${SUMMARY_MIN} characters needed` : n < SUMMARY_TIP ? `Good — ${SUMMARY_TIP}+ is even better` : "Great length"}
        </span>
        <span className={cn("font-medium tabular-nums", n >= SUMMARY_TIP ? "text-status-applied-foreground" : n >= SUMMARY_MIN ? "text-foreground" : "text-muted-foreground")}>
          {n}
        </span>
      </p>
    </SectionCard>
  );
}

/* ---------------- C. Skills ---------------- */

function SkillsSection({ profile, onSaved }: SectionProps) {
  const s = useSection("skills", { skills: profile.skills, tools: profile.tools }, onSaved);
  return (
    <SectionCard id="skills" title="Skills & tools" required dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      <Field label={`Key skills (at least ${MIN_SKILLS})`} required tip="The skills you'd want a recruiter to search you by. The ATS check matches these against your résumé.">
        <ChipInput ariaLabel="Key skills" value={s.v.skills} onChange={(v) => s.patch({ skills: v })} suggestions={SKILL_SUGGESTIONS} max={LIMITS.skills} />
      </Field>
      <Field label="Tools & technologies">
        <ChipInput ariaLabel="Tools and technologies" value={s.v.tools} onChange={(v) => s.patch({ tools: v })} suggestions={TOOL_SUGGESTIONS} max={LIMITS.tools} />
      </Field>
    </SectionCard>
  );
}

/* ---------------- D. Work experience ---------------- */

function span(e: { startMonth: number | null; startYear: number | null; endMonth: number | null; endYear: number | null; isCurrent?: boolean }) {
  const d = (m: number | null, y: number | null) => (y ? `${m ? MONTHS[m - 1] + " " : ""}${y}` : "");
  const start = d(e.startMonth, e.startYear);
  const end = e.isCurrent ? "Present" : d(e.endMonth, e.endYear);
  return start || end ? `${start || "?"} – ${end || "?"}` : "";
}

function useOpenSet(initialOpen: number[] = []) {
  const [open, setOpen] = useState<Set<number>>(new Set(initialOpen));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return { open, setOpen, toggle };
}

function ExperienceSection({ profile, onSaved }: SectionProps) {
  const s = useSection("experience", { experiences: profile.experiences }, onSaved, "Experience");
  const list = s.v.experiences;
  const { open, setOpen, toggle } = useOpenSet();
  useEffect(() => {
    if (s.badIndex != null) setOpen((p) => new Set(p).add(s.badIndex!));
  }, [s.badIndex, setOpen]);
  const set = (i: number, p: Partial<(typeof list)[number]>) =>
    s.patch({ experiences: list.map((e, j) => (j === i ? { ...e, ...p } : e)) });

  return (
    <SectionCard
      id="experience"
      title="Work experience"
      required
      tip="Your relevant roles from the last 10 years, most recent first. Note achievements as bullets — “Achieved X by doing Y”. It doesn't need to be perfect."
      dirty={s.dirty}
      busy={s.busy}
      error={s.error}
      onSave={s.save}
    >
      {list.length === 0 && <p className="text-sm text-muted-foreground">No roles added yet.</p>}
      <div className="space-y-2">
        {list.map((e, i) => (
          <EntryRow
            key={i}
            title={e.title || e.company ? `${e.title || "Untitled role"}${e.company ? ` at ${e.company}` : ""}` : "New role"}
            subtitle={span(e)}
            open={open.has(i)}
            onToggle={() => toggle(i)}
            invalid={s.badIndex === i && !!s.error}
            controls={
              <EntryControls
                index={i}
                count={list.length}
                what="role"
                onMove={(from, to) => {
                  s.patch({ experiences: moved(list, from, to) });
                  setOpen(new Set());
                }}
                onRemove={() => {
                  s.patch({ experiences: list.filter((_, j) => j !== i) });
                  setOpen(new Set());
                }}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job title" required>
                <Input className={FIELD_CLS} value={e.title} maxLength={LIMITS.text} onChange={(ev) => set(i, { title: ev.target.value })} />
              </Field>
              <Field label="Company" required>
                <Input className={FIELD_CLS} value={e.company} maxLength={LIMITS.text} onChange={(ev) => set(i, { company: ev.target.value })} />
              </Field>
              <Field label="Location">
                <Input className={FIELD_CLS} value={e.location} maxLength={LIMITS.text} placeholder="City, or Remote" onChange={(ev) => set(i, { location: ev.target.value })} />
              </Field>
              <Field label="Employment type">
                <Choice ariaLabel="Employment type" options={EMPLOYMENT_TYPE_OPTIONS} value={e.employmentType} onChange={(v) => set(i, { employmentType: v })} />
              </Field>
              <Field label="Start date" required>
                <MonthYear label="Start" month={e.startMonth} year={e.startYear} onChange={(m, y) => set(i, { startMonth: m, startYear: y })} />
              </Field>
              <Field label="End date" required={!e.isCurrent}>
                {e.isCurrent ? (
                  <p className="flex h-11 items-center text-sm text-muted-foreground sm:h-9">Present</p>
                ) : (
                  <MonthYear label="End" month={e.endMonth} year={e.endYear} onChange={(m, y) => set(i, { endMonth: m, endYear: y })} />
                )}
              </Field>
            </div>
            <label className="flex min-h-11 w-fit items-center gap-2 text-sm sm:min-h-8">
              <input
                type="checkbox"
                checked={e.isCurrent}
                onChange={(ev) => set(i, { isCurrent: ev.target.checked })}
                className="size-4 rounded border-input accent-primary"
              />
              I currently work here
            </label>
            <Field label="Achievements" tip="One per line, starting with “- ”. Lead with the result: “- Cut release time 30% by automating QA sign-off”.">
              <MarkdownEditor
                value={e.description}
                onChange={(v) => set(i, { description: v.slice(0, LIMITS.description) })}
                placeholder={"- Delivered …\n- Led …"}
                className="min-h-28"
                ariaLabel="Achievements"
              />
            </Field>
          </EntryRow>
        ))}
      </div>
      <AddButton
        disabled={list.length >= LIMITS.experiences}
        onClick={() => {
          s.patch({ experiences: [...list, { ...EMPTY_EXPERIENCE }] });
          setOpen(new Set([list.length]));
        }}
      >
        Add employment
      </AddButton>
    </SectionCard>
  );
}

/* ---------------- E. Education ---------------- */

function EducationSection({ profile, onSaved }: SectionProps) {
  const s = useSection("education", { educations: profile.educations }, onSaved, "Education");
  const list = s.v.educations;
  const { open, setOpen, toggle } = useOpenSet();
  useEffect(() => {
    if (s.badIndex != null) setOpen((p) => new Set(p).add(s.badIndex!));
  }, [s.badIndex, setOpen]);
  const set = (i: number, p: Partial<(typeof list)[number]>) =>
    s.patch({ educations: list.map((e, j) => (j === i ? { ...e, ...p } : e)) });

  return (
    <SectionCard id="education" title="Education" dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No education added yet.</p>}
      <div className="space-y-2">
        {list.map((e, i) => (
          <EntryRow
            key={i}
            title={e.degree || e.institution ? `${e.degree || "Degree"}${e.institution ? `, ${e.institution}` : ""}` : "New education"}
            subtitle={e.startYear || e.endYear ? `${e.startYear ?? "?"} – ${e.endYear ?? "?"}` : undefined}
            open={open.has(i)}
            onToggle={() => toggle(i)}
            invalid={s.badIndex === i && !!s.error}
            controls={
              <EntryControls
                index={i}
                count={list.length}
                what="education"
                onMove={(from, to) => {
                  s.patch({ educations: moved(list, from, to) });
                  setOpen(new Set());
                }}
                onRemove={() => {
                  s.patch({ educations: list.filter((_, j) => j !== i) });
                  setOpen(new Set());
                }}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Degree" required>
                <Input className={FIELD_CLS} value={e.degree} maxLength={LIMITS.text} placeholder="e.g. B.Tech, MBA" onChange={(ev) => set(i, { degree: ev.target.value })} />
              </Field>
              <Field label="Field of study">
                <Input className={FIELD_CLS} value={e.field} maxLength={LIMITS.text} placeholder="e.g. Computer Science" onChange={(ev) => set(i, { field: ev.target.value })} />
              </Field>
              <Field label="Institution" required className="sm:col-span-2">
                <Input className={FIELD_CLS} value={e.institution} maxLength={LIMITS.text} onChange={(ev) => set(i, { institution: ev.target.value })} />
              </Field>
              <Field label="Start year">
                <Choice ariaLabel="Start year" placeholder="Year" options={YEAR_OPTIONS} value={e.startYear ? String(e.startYear) : ""} onChange={(v) => set(i, { startYear: v ? Number(v) : null })} />
              </Field>
              <Field label="End year (or expected)">
                <Choice ariaLabel="End year" placeholder="Year" options={YEAR_OPTIONS} value={e.endYear ? String(e.endYear) : ""} onChange={(v) => set(i, { endYear: v ? Number(v) : null })} />
              </Field>
              <Field label="Grade" tip="Optional — e.g. 8.2 CGPA, 72%, First class.">
                <Input className={FIELD_CLS} value={e.grade} maxLength={40} onChange={(ev) => set(i, { grade: ev.target.value })} />
              </Field>
            </div>
          </EntryRow>
        ))}
      </div>
      <AddButton
        disabled={list.length >= LIMITS.educations}
        onClick={() => {
          s.patch({ educations: [...list, { ...EMPTY_EDUCATION }] });
          setOpen(new Set([list.length]));
        }}
      >
        Add education
      </AddButton>
    </SectionCard>
  );
}

/* ---------------- F. Certifications ---------------- */

function CertificationsSection({ profile, onSaved }: SectionProps) {
  const s = useSection("certifications", { certifications: profile.certifications }, onSaved, "Certification");
  const list = s.v.certifications;
  const { open, setOpen, toggle } = useOpenSet();
  useEffect(() => {
    if (s.badIndex != null) setOpen((p) => new Set(p).add(s.badIndex!));
  }, [s.badIndex, setOpen]);
  const set = (i: number, p: Partial<(typeof list)[number]>) =>
    s.patch({ certifications: list.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  return (
    <SectionCard id="certifications" title="Certifications" dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
      <div className="space-y-2">
        {list.map((c, i) => (
          <EntryRow
            key={i}
            title={c.name || "New certification"}
            subtitle={[c.issuer, c.year].filter(Boolean).join(" · ") || undefined}
            open={open.has(i)}
            onToggle={() => toggle(i)}
            invalid={s.badIndex === i && !!s.error}
            controls={
              <EntryControls
                index={i}
                count={list.length}
                what="certification"
                onMove={(from, to) => {
                  s.patch({ certifications: moved(list, from, to) });
                  setOpen(new Set());
                }}
                onRemove={() => {
                  s.patch({ certifications: list.filter((_, j) => j !== i) });
                  setOpen(new Set());
                }}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required>
                <Input className={FIELD_CLS} value={c.name} maxLength={LIMITS.text} placeholder="e.g. PMP" onChange={(ev) => set(i, { name: ev.target.value })} />
              </Field>
              <Field label="Issued by">
                <Input className={FIELD_CLS} value={c.issuer} maxLength={LIMITS.text} placeholder="e.g. PMI" onChange={(ev) => set(i, { issuer: ev.target.value })} />
              </Field>
              <Field label="Year">
                <Choice ariaLabel="Year" placeholder="Year" options={YEAR_OPTIONS} value={c.year ? String(c.year) : ""} onChange={(v) => set(i, { year: v ? Number(v) : null })} />
              </Field>
              <Field label="Credential link">
                <Input className={FIELD_CLS} type="url" inputMode="url" value={c.url} maxLength={LIMITS.url} placeholder="https://…" onChange={(ev) => set(i, { url: ev.target.value })} />
              </Field>
            </div>
          </EntryRow>
        ))}
      </div>
      <AddButton
        disabled={list.length >= LIMITS.certifications}
        onClick={() => {
          s.patch({ certifications: [...list, { ...EMPTY_CERTIFICATION }] });
          setOpen(new Set([list.length]));
        }}
      >
        Add certification
      </AddButton>
    </SectionCard>
  );
}

/* ---------------- G. Work eligibility ---------------- */

function EligibilitySection({ profile, onSaved }: SectionProps) {
  const s = useSection(
    "eligibility",
    {
      languages: profile.languages,
      workCountries: profile.workCountries,
      needsSponsorship: profile.needsSponsorship,
      sponsorshipCountries: profile.sponsorshipCountries,
    },
    onSaved,
  );
  return (
    <SectionCard id="eligibility" title="Work eligibility" dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      <Field label={`Languages you speak fluently (up to ${LIMITS.languages})`}>
        <ChipInput ariaLabel="Languages" value={s.v.languages} onChange={(v) => s.patch({ languages: v })} suggestions={LANGUAGE_SUGGESTIONS} max={LIMITS.languages} />
      </Field>
      <Field label="Countries you're eligible to work in" tip="Where you already have the legal right to work.">
        <ChipInput ariaLabel="Countries you're eligible to work in" value={s.v.workCountries} onChange={(v) => s.patch({ workCountries: v })} suggestions={COUNTRY_OPTIONS} suggestWhileTypingOnly max={LIMITS.countries} placeholder="Type a country" />
      </Field>
      <Field label="Will you now or in the future need visa sponsorship?" tip="A common screening question on job applications — answer it the way you would there.">
        <YesNo ariaLabel="Needs visa sponsorship" value={s.v.needsSponsorship} onChange={(v) => s.patch({ needsSponsorship: v })} />
      </Field>
      {s.v.needsSponsorship === true && (
        <Field label="Countries where you'd need sponsorship">
          <ChipInput ariaLabel="Countries where you'd need sponsorship" value={s.v.sponsorshipCountries} onChange={(v) => s.patch({ sponsorshipCountries: v })} suggestions={COUNTRY_OPTIONS} suggestWhileTypingOnly max={LIMITS.countries} placeholder="Type a country" />
        </Field>
      )}
    </SectionCard>
  );
}

/* ---------------- H. Job preferences ---------------- */

const CURRENCY_ITEMS: Options = CURRENCY_OPTIONS.map((c) => [c, c] as const);

function PayInput({ value, onChange, label }: { value: Pay | null; onChange: (p: Pay | null) => void; label: string }) {
  // Keep currency / period choices even while the amount is empty.
  const [currency, setCurrency] = useState<Pay["currency"]>(value?.currency ?? "INR");
  const [period, setPeriod] = useState<Pay["period"]>(value?.period ?? "year");
  const amount = value?.amount;
  const emit = (a: number | undefined, c = currency, p = period) => onChange(a == null ? null : { amount: a, currency: c, period: p });
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_9rem]">
      <Choice
        ariaLabel={`${label} currency`}
        options={CURRENCY_ITEMS}
        placeholder="Currency"
        value={currency}
        onChange={(c) => {
          const next = (c || "INR") as Pay["currency"];
          setCurrency(next);
          emit(amount, next);
        }}
      />
      <Input
        className={FIELD_CLS}
        inputMode="numeric"
        aria-label={`${label} amount`}
        placeholder="Amount"
        value={amount != null ? amount.toLocaleString("en-IN") : ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          emit(digits ? Number(digits) : undefined);
        }}
      />
      <Choice
        ariaLabel={`${label} period`}
        options={PAY_PERIOD_OPTIONS}
        placeholder="Period"
        className="col-span-2 sm:col-span-1"
        value={period}
        onChange={(v) => {
          const next = (v || "year") as Pay["period"];
          setPeriod(next);
          emit(amount, currency, next);
        }}
      />
    </div>
  );
}

function PreferencesSection({ profile, onSaved }: SectionProps) {
  const s = useSection(
    "preferences",
    {
      targetRoles: profile.targetRoles,
      seniority: profile.seniority,
      workModes: profile.workModes,
      preferredLocations: profile.preferredLocations,
      employmentTypes: profile.employmentTypes,
      industries: profile.industries,
      openToRelocate: profile.openToRelocate,
      noticePeriod: profile.noticePeriod,
      currentPay: profile.currentPay,
      expectedPay: profile.expectedPay,
    },
    onSaved,
  );
  return (
    <SectionCard id="preferences" title="Job preferences" required dirty={s.dirty} busy={s.busy} error={s.error} onSave={s.save}>
      <Field label="Target roles" required tip="The job titles you're aiming for. The ATS check and fit score use these.">
        <ChipInput ariaLabel="Target roles" value={s.v.targetRoles} onChange={(v) => s.patch({ targetRoles: v })} suggestions={ROLE_SUGGESTIONS} max={LIMITS.roles} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seniority level">
          <Choice ariaLabel="Seniority level" options={SENIORITY_OPTIONS} value={s.v.seniority ?? ""} onChange={(v) => s.patch({ seniority: v })} />
        </Field>
        <Field label="Notice period">
          <Choice ariaLabel="Notice period" options={NOTICE_PERIOD_OPTIONS} value={s.v.noticePeriod ?? ""} onChange={(v) => s.patch({ noticePeriod: v })} />
        </Field>
      </div>
      <Field label="Work mode">
        <TogglePills ariaLabel="Work mode" options={WORK_MODE_OPTIONS} value={s.v.workModes ?? []} onChange={(v) => s.patch({ workModes: v as typeof s.v.workModes })} />
      </Field>
      <Field label="Employment type">
        <TogglePills ariaLabel="Employment type" options={EMPLOYMENT_TYPE_OPTIONS} value={s.v.employmentTypes ?? []} onChange={(v) => s.patch({ employmentTypes: v as typeof s.v.employmentTypes })} />
      </Field>
      <Field label="Preferred locations" tip="Cities or regions you'd work in.">
        <ChipInput ariaLabel="Preferred locations" value={s.v.preferredLocations} onChange={(v) => s.patch({ preferredLocations: v })} max={LIMITS.locations} placeholder="e.g. Bengaluru, then Enter" />
      </Field>
      <Field label="Industries you prefer">
        <ChipInput ariaLabel="Industries" value={s.v.industries} onChange={(v) => s.patch({ industries: v })} suggestions={INDUSTRY_SUGGESTIONS} max={LIMITS.industries} />
      </Field>
      <Field label="Open to relocating?">
        <YesNo ariaLabel="Open to relocating" value={s.v.openToRelocate ?? null} onChange={(v) => s.patch({ openToRelocate: v })} />
      </Field>
      <div className="grid gap-4">
        <Field label="Current pay" tip="Optional. Fixed pay before tax.">
          <PayInput label="Current pay" value={s.v.currentPay ?? null} onChange={(p) => s.patch({ currentPay: p })} />
        </Field>
        <Field label="Expected pay">
          <PayInput label="Expected pay" value={s.v.expectedPay ?? null} onChange={(p) => s.patch({ expectedPay: p })} />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ---------------- I. Optional questions ---------------- */

function OptionalSection({ profile, onSaved }: SectionProps) {
  const s = useSection("optional", { gender: profile.gender, disability: profile.disability, veteran: profile.veteran }, onSaved);
  return (
    <SectionCard
      id="optional"
      title="Optional questions"
      tip="Some applications ask these for equal-opportunity reporting. Answering is optional — they're kept private, never sent to AI and never used to score you."
      dirty={s.dirty}
      busy={s.busy}
      error={s.error}
      onSave={s.save}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Gender">
          <Choice ariaLabel="Gender" placeholder="Not answered" options={GENDER_OPTIONS} value={s.v.gender ?? ""} onChange={(v) => s.patch({ gender: v })} />
        </Field>
        <Field label="Do you have a disability?">
          <Choice ariaLabel="Disability" placeholder="Not answered" options={YES_NO_PREFER_OPTIONS} value={s.v.disability ?? ""} onChange={(v) => s.patch({ disability: v })} />
        </Field>
        <Field label="Are you a veteran?">
          <Choice ariaLabel="Veteran status" placeholder="Not answered" options={YES_NO_PREFER_OPTIONS} value={s.v.veteran ?? ""} onChange={(v) => s.patch({ veteran: v })} />
        </Field>
      </div>
    </SectionCard>
  );
}


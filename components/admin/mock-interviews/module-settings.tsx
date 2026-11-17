"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarClock,
  IndianRupee,
  KeyRound,
  ListChecks,
  MessageSquareText,
  Plus,
  Power,
  Scale,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { Field, SubHead, Toggle, selectCls } from "@/components/admin/settings/form-bits";
import { InfoTip } from "@/components/ui/info-tip";
import { saveModuleSettingsAction, testModuleAiAction } from "@/actions/admin-mock-interviews";
import {
  AI_DURATIONS,
  DEFAULT_PROMPTS,
  DIFFICULTIES,
  METRICS,
  PROMPT_PLACEHOLDERS,
  aiInterviewQuote,
  overallScore,
  plannedQuestions,
  rupees,
  type Difficulty,
  type MetricKey,
  type ModuleSettings,
  type PartState,
} from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";

// Admin → Mock interviews → Module settings (docs/interview-prep/spec.md section
// 4). Each section saves on its own; every booking keeps a copy of the settings
// it was made under (D36), so a change here never alters past bookings.

type SectionId = "availability" | "ai" | "rules" | "pricing" | "bookings" | "scoring" | "prompts";
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "availability", label: "Availability", icon: Power },
  { id: "ai", label: "AI service", icon: Bot },
  { id: "rules", label: "Interview rules", icon: ListChecks },
  { id: "pricing", label: "Pricing", icon: IndianRupee },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
  { id: "scoring", label: "Scoring", icon: Scale },
  { id: "prompts", label: "Prompts", icon: MessageSquareText },
];

const cardCls = "rounded-2xl border bg-card p-4 md:p-5";
const textareaCls =
  "min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ModuleSettingsClient({ initial, section }: { initial: ModuleSettings; section?: string }) {
  const router = useRouter();
  const fromUrl = (section ?? null) as SectionId | null;
  const [active, setActive] = useState<SectionId>(SECTIONS.some((s) => s.id === fromUrl) ? (fromUrl as SectionId) : "availability");
  const [s, setS] = useState<ModuleSettings>(initial);
  const set = <K extends keyof ModuleSettings>(k: K, v: ModuleSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  function pick(id: SectionId) {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("section", id);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="lg:flex lg:gap-6">
        <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:w-52 lg:shrink-0 lg:space-y-1 lg:px-0">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              aria-current={active === id ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors lg:min-h-9 lg:w-full",
                active === id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-4 min-w-0 flex-1 lg:mt-0">
          {active === "availability" && <Availability s={s} set={set} />}
          {active === "ai" && <AiService s={s} set={set} />}
          {active === "rules" && <Rules s={s} set={set} />}
          {active === "pricing" && <Pricing s={s} set={set} />}
          {active === "bookings" && <Bookings s={s} set={set} />}
          {active === "scoring" && <Scoring s={s} set={set} />}
          {active === "prompts" && <Prompts s={s} set={set} />}
        </div>
      </div>
    </div>
  );
}

type SectionProps = { s: ModuleSettings; set: <K extends keyof ModuleSettings>(k: K, v: ModuleSettings[K]) => void };

/** Saves one section; the action validates again and keeps the other sections. */
function Save({ error, payload, onSaved }: { error?: string; payload: () => Record<string, unknown> & { section: SectionId }; onSaved?: (r: { keyLast4?: string | null }) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const r = await saveModuleSettingsAction(payload());
      if (!r.ok) return toast.error("Not saved", r.error);
      toast.success("Settings saved");
      onSaved?.(r);
      router.refresh();
    } catch {
      toast.error("Not saved", "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button onClick={save} disabled={!!error || busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------- Availability ---------------- */

function PartSwitch({ label, value, onChange, note }: { label: string; value: PartState; onChange: (v: PartState) => void; note?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/50 px-3 py-3">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {label}
        {note && <InfoTip label={`About ${label}`}>{note}</InfoTip>}
      </span>
      <div role="radiogroup" aria-label={label} className="inline-grid grid-cols-2 gap-1 rounded-lg bg-muted/70 p-1">
        {(
          [
            ["open", "Open"],
            ["coming_soon", "Coming soon"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "min-h-11 rounded-md px-3 text-xs font-medium sm:min-h-8",
              value === v ? (v === "open" ? "bg-emerald-600 text-white" : "bg-card text-foreground shadow-sm") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Availability({ s, set }: SectionProps) {
  const [confirm, setConfirm] = useState<PartState | null>(null);
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold">Availability</h2>
      <div className="mt-4 space-y-2">
        <PartSwitch
          label="AI interviews"
          value={s.aiState}
          onChange={(v) => v !== s.aiState && setConfirm(v)}
          note="Coming soon keeps the menu visible with a coming-soon page. Open lets candidates book and start AI interviews."
        />
        <PartSwitch
          label="Human interviews"
          value={s.humanState}
          onChange={(v) => set("humanState", v)}
          note="For Release 2. Keep it on Coming soon until interviewers are set up."
        />
      </div>
      <SubHead>Release 2</SubHead>
      <div className="space-y-3">
        <Toggle checked={s.applicationsOpen} onChange={(v) => set("applicationsOpen", v)} label="Accept new interviewer applications" />
        <Toggle checked={s.pauseBookings} onChange={(v) => set("pauseBookings", v)} label="Pause new bookings" />
      </div>
      <Save payload={() => ({ section: "availability", aiState: s.aiState, humanState: s.humanState, applicationsOpen: s.applicationsOpen, pauseBookings: s.pauseBookings })} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "open" ? "Open AI interviews to candidates?" : "Switch AI interviews to Coming soon?"}
        description={
          confirm === "open"
            ? "Candidates can book and start AI interviews right away."
            : "Candidates can't book new AI interviews. Existing bookings stay, and can still be started."
        }
        confirmLabel={confirm === "open" ? "Open" : "Switch to Coming soon"}
        onConfirm={() => {
          if (confirm) set("aiState", confirm);
          setConfirm(null);
        }}
      />
    </section>
  );
}

/* ---------------- AI service ---------------- */

/** ₹ per million tokens, edited in rupees and stored in paise. */
function TokenPrice({ label, paise, onChange }: { label: string; paise: number; onChange: (paise: number) => void }) {
  const bad = !Number.isFinite(paise) || paise < 0 || paise > 10_000_000;
  return (
    <Field label={label} hint={bad ? "Between ₹0 and ₹1,00,000" : "₹ per million tokens"}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">₹</span>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={Number.isFinite(paise) ? paise / 100 : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Math.round(Number(e.target.value) * 100))}
          aria-invalid={bad}
          className="h-11 w-32 sm:h-9"
        />
      </div>
    </Field>
  );
}

function AiService({ s, set }: SectionProps) {
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const priceBad = [s.inputCostPerMTokPaise, s.outputCostPerMTokPaise].some((p) => !Number.isFinite(p) || p < 0 || p > 10_000_000);
  const keyError = key && key.trim().length < 20 ? "That doesn't look like a full API key." : priceBad ? "Fix the token prices marked in red." : "";
  async function test() {
    setTesting(true);
    try {
      const r = await testModuleAiAction();
      if (r.ok) toast.success("Connected", `The saved key works with ${r.model}.`);
      else toast.error("Couldn't connect", r.error);
    } catch {
      toast.error("Couldn't connect", "Something went wrong. Try again.");
    } finally {
      setTesting(false);
    }
  }
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold">AI service</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Provider">
          <select className={cn(selectCls, "h-11 sm:h-9")} value={s.provider} onChange={(e) => set("provider", e.target.value as ModuleSettings["provider"])}>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </Field>
        <Field label="Model" hint="Blank uses the provider's default">
          <Input value={s.model} onChange={(e) => set("model", e.target.value)} maxLength={120} className="h-11 sm:h-9" />
        </Field>
        <Field label="API key" className="sm:col-span-2" hint={s.keyLast4 ? `Saved key ends in ${s.keyLast4}. Type a new one to replace it.` : undefined}>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={s.keyLast4 ? "••••••••••••" : "Paste the key for this module"}
              aria-invalid={!!keyError}
              className="h-11 pl-8 sm:h-9"
            />
          </div>
        </Field>
        <TokenPrice label="Input tokens" paise={s.inputCostPerMTokPaise} onChange={(v) => set("inputCostPerMTokPaise", v)} />
        <TokenPrice label="Output tokens" paise={s.outputCostPerMTokPaise} onChange={(v) => set("outputCostPerMTokPaise", v)} />
      </div>
      {keyError && <p className="mt-2 text-xs text-destructive">{keyError}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={test} disabled={testing || !s.keyLast4}>
          <Wand2 className="size-4" aria-hidden />
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <InfoTip label="About token prices">
          Copy them from your provider&apos;s price list, in rupees. Admin → AI interviews works out each interview&apos;s AI cost from the tokens it used and these prices. Leave them at 0 and the cost shows as ₹0.
        </InfoTip>
        <InfoTip label="About this key">
          Used only for mock interviews, separate from users&apos; own keys and the knowledge base key, so its usage and cost are tracked on their own. Stored encrypted and never shown again.
        </InfoTip>
      </div>
      <Save
        error={keyError}
        payload={() => ({
          section: "ai",
          provider: s.provider,
          model: s.model,
          key,
          inputCostPerMTokPaise: s.inputCostPerMTokPaise,
          outputCostPerMTokPaise: s.outputCostPerMTokPaise,
        })}
        onSaved={(r) => {
          setKey("");
          if (r.keyLast4 !== undefined) set("keyLast4", r.keyLast4);
        }}
      />
    </section>
  );
}

/* ---------------- Interview rules ---------------- */

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint?: string;
}) {
  const bad = !Number.isFinite(value) || value < min || value > max;
  return (
    <Field label={label} hint={bad ? `Between ${min} and ${max}` : hint}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          aria-invalid={bad}
          className="h-11 w-24 sm:h-9"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </Field>
  );
}

function Rules({ s, set }: SectionProps) {
  const [newCat, setNewCat] = useState("");
  const ranges: [number, number, number][] = [
    [s.minutesPerQuestion, 1, 5],
    [s.wrapUpMinutes, 0, 20],
    [s.resumeWindowMinutes, 5, 60],
    [s.paceGraceMinutes, 0, 15],
  ];
  const outOfRange = ranges.some(([v, lo, hi]) => !Number.isFinite(v) || v < lo || v > hi);
  const error = s.categories.length === 0 ? "Keep at least one kind of interview." : s.durations.length === 0 ? "Allow at least one length." : outOfRange ? "Fix the numbers marked in red." : "";
  function addCat() {
    const c = newCat.trim();
    if (!c || c.length > 40 || s.categories.some((x) => x.toLowerCase() === c.toLowerCase())) return;
    set("categories", [...s.categories, c]);
    setNewCat("");
  }
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold">Interview rules</h2>

      <SubHead>Kinds of interview</SubHead>
      <ul className="flex flex-wrap gap-2">
        {s.categories.map((c) => (
          <li key={c} className="inline-flex items-center gap-1 rounded-full border bg-white/60 py-1 pr-1 pl-3 text-sm">
            {c}
            <button
              type="button"
              aria-label={`Remove ${c}`}
              onClick={() => set("categories", s.categories.filter((x) => x !== c))}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-6"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCat())}
          placeholder="Add a kind of interview"
          maxLength={40}
          className="h-11 max-w-xs sm:h-9"
        />
        <Button variant="outline" onClick={addCat} disabled={!newCat.trim()}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>

      <SubHead>Lengths candidates can pick</SubHead>
      <div className="flex flex-wrap gap-2">
        {AI_DURATIONS.map((m) => {
          const on = s.durations.includes(m);
          return (
            <label
              key={m}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm sm:min-h-9",
                on ? "border-primary bg-primary/5 text-primary" : "bg-white/60",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => set("durations", on ? s.durations.filter((d) => d !== m) : [...s.durations, m].sort((a, b) => a - b))}
                className="size-4 accent-primary"
              />
              {m} min
              <span className="text-xs text-muted-foreground">~{plannedQuestions(m, s.minutesPerQuestion || 2)} questions</span>
            </label>
          );
        })}
      </div>

      <SubHead>Timing</SubHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Minutes per question" value={s.minutesPerQuestion} onChange={(v) => set("minutesPerQuestion", v)} min={1} max={5} step={0.5} suffix="min" hint="Sets how many questions are planned" />
        <NumberField label="Wrap-up extension" value={s.wrapUpMinutes} onChange={(v) => set("wrapUpMinutes", v)} min={0} max={20} suffix="min" />
        <NumberField label="Resume window" value={s.resumeWindowMinutes} onChange={(v) => set("resumeWindowMinutes", v)} min={5} max={60} suffix="min" hint="After a disconnection" />
        <NumberField label="Pace grace period" value={s.paceGraceMinutes} onChange={(v) => set("paceGraceMinutes", v)} min={0} max={15} suffix="min" hint="Before the pace meter judges" />
      </div>
      <Save
        error={error}
        payload={() => ({
          section: "rules",
          categories: s.categories,
          durations: s.durations,
          minutesPerQuestion: s.minutesPerQuestion,
          wrapUpMinutes: s.wrapUpMinutes,
          resumeWindowMinutes: s.resumeWindowMinutes,
          paceGraceMinutes: s.paceGraceMinutes,
        })}
      />
    </section>
  );
}

/* ---------------- Pricing ---------------- */

function Pricing({ s, set }: SectionProps) {
  const update = (d: Difficulty, patch: Partial<ModuleSettings["pricing"][Difficulty]>) => set("pricing", { ...s.pricing, [d]: { ...s.pricing[d], ...patch } });
  const errors = DIFFICULTIES.flatMap((d) => {
    const p = s.pricing[d];
    const out: string[] = [];
    if (!Number.isFinite(p.ratePerMinutePaise) || p.ratePerMinutePaise < 100 || p.ratePerMinutePaise > 100_000) out.push(`${d}: rate between ₹1 and ₹1,000 a minute`);
    if (p.discountOn && (!Number.isFinite(p.discountPercent) || p.discountPercent < 1 || p.discountPercent > 90)) out.push(`${d}: discount between 1% and 90%`);
    return out;
  });
  const TONE: Record<Difficulty, string> = { Easy: "text-emerald-700", Medium: "text-amber-700", Hard: "text-rose-700" };
  return (
    <section className={cardCls}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Pricing</h2>
        <InfoTip label="About pricing">
          For AI interviews not included in a plan. Price = minutes × the level&apos;s rate, less its discount when on, rounded to the nearest rupee. Prices include GST.
        </InfoTip>
      </div>
      <div className="mt-4 space-y-3">
        {DIFFICULTIES.map((d) => {
          const p = s.pricing[d];
          return (
            <div key={d} className="rounded-xl border bg-white/50 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <p className={cn("w-full text-sm font-semibold sm:w-20 sm:pb-2.5", TONE[d])}>{d}</p>
                <Field label="Rate per minute">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      step={0.5}
                      value={Number.isFinite(p.ratePerMinutePaise) ? p.ratePerMinutePaise / 100 : ""}
                      onChange={(e) => update(d, { ratePerMinutePaise: e.target.value === "" ? NaN : Math.round(Number(e.target.value) * 100) })}
                      className="h-11 w-24 sm:h-9"
                    />
                  </div>
                </Field>
                <div className="sm:pb-2">
                  <Toggle checked={p.discountOn} onChange={(v) => update(d, { discountOn: v })} label="Discount" />
                </div>
                <Field label="Percent off">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={Number.isFinite(p.discountPercent) ? p.discountPercent : ""}
                      onChange={(e) => update(d, { discountPercent: e.target.value === "" ? NaN : Number(e.target.value) })}
                      disabled={!p.discountOn}
                      className="h-11 w-20 sm:h-9"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </Field>
              </div>
              {/* What candidates will pay at each allowed length. */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {s.durations.map((m) => {
                  const q = Number.isFinite(p.ratePerMinutePaise) ? aiInterviewQuote(m, { ...p, discountPercent: p.discountPercent || 0 }) : null;
                  return (
                    <div key={m} className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-center">
                      <p className="text-[11px] text-muted-foreground">{m} min</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {q ? (
                          <>
                            {q.percent > 0 && <s className="mr-1 text-xs font-normal text-muted-foreground">{rupees(q.full)}</s>}
                            {rupees(q.final)}
                          </>
                        ) : (
                          "-"
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Save error={errors[0]} payload={() => ({ section: "pricing", pricing: s.pricing })} />
    </section>
  );
}

/* ---------------- Bookings ---------------- */

function Bookings({ s, set }: SectionProps) {
  const error =
    !Number.isFinite(s.bookingValidDays) || s.bookingValidDays < 1 || s.bookingValidDays > 365
      ? "Valid for: between 1 and 365 days."
      : !Number.isFinite(s.expiryReminderDays) || s.expiryReminderDays < 0 || s.expiryReminderDays >= s.bookingValidDays
        ? "The reminder must come before the booking expires."
        : "";
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold">Bookings</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField label="A booking is valid for" value={s.bookingValidDays} onChange={(v) => set("bookingValidDays", v)} min={1} max={365} suffix="days" />
        <NumberField label="Expiry reminder" value={s.expiryReminderDays} onChange={(v) => set("expiryReminderDays", v)} min={0} max={30} suffix="days before" hint="0 sends no reminder" />
      </div>
      <Save error={error} payload={() => ({ section: "bookings", bookingValidDays: s.bookingValidDays, expiryReminderDays: s.expiryReminderDays })} />
    </section>
  );
}

/* ---------------- Scoring ---------------- */

function Scoring({ s, set }: SectionProps) {
  const total = METRICS.reduce((n, m) => n + (Number.isFinite(s.weights[m.key]) ? s.weights[m.key] : 0), 0);
  const example = { communication: 8, technical: 6, confidence: 7, problemSolving: 6, relevance: 8 };
  const error = total !== 100 ? `The weights add up to ${total}%. Make them add up to 100%.` : "";
  return (
    <section className={cardCls}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Scoring</h2>
        <InfoTip label="About scoring">
          The overall score out of 100 is a weighted average of the five skills (each 1 to 10). The same weights apply to AI and interviewer reports.
        </InfoTip>
      </div>
      <ul className="mt-4 space-y-3">
        {METRICS.map((m) => {
          const v = s.weights[m.key];
          return (
            <li key={m.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_6rem]">
              <span className="text-sm">{m.label}</span>
              <div className="flex items-center gap-1.5 sm:order-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Number.isFinite(v) ? v : ""}
                  onChange={(e) => set("weights", { ...s.weights, [m.key as MetricKey]: e.target.value === "" ? NaN : Number(e.target.value) })}
                  aria-label={`${m.label} weight`}
                  className="h-11 w-20 sm:h-9"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:order-2 sm:col-span-1" aria-hidden>
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${Math.min(100, Math.max(0, v || 0))}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
        <span>
          Total: <span className={cn("font-semibold", total === 100 ? "text-emerald-700" : "text-destructive")}>{total}%</span>
        </span>
        {total === 100 && (
          <span className="text-muted-foreground">
            Example: scores 8, 6, 7, 6, 8 give an overall of <span className="font-semibold text-foreground">{overallScore(example, s.weights)}</span>
          </span>
        )}
      </div>
      <Save error={error} payload={() => ({ section: "scoring", weights: s.weights })} />
    </section>
  );
}

/* ---------------- Prompts ---------------- */

function Prompts({ s, set }: SectionProps) {
  const items: { key: keyof ModuleSettings["prompts"]; label: string }[] = [
    { key: "questionPlan", label: "Question plan" },
    { key: "interviewer", label: "Interviewer" },
    { key: "evaluation", label: "Evaluation" },
  ];
  const error = items.find((i) => s.prompts[i.key].trim().length < 20) ? "Each prompt needs at least 20 characters." : "";
  return (
    <section className={cardCls}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Prompts</h2>
        <InfoTip label="Placeholders you can use">{PROMPT_PLACEHOLDERS.join(", ")}</InfoTip>
      </div>
      <div className="mt-4 space-y-4">
        {items.map(({ key, label }) => (
          <Field key={key} label={label}>
            <textarea
              value={s.prompts[key]}
              maxLength={4000}
              onChange={(e) => set("prompts", { ...s.prompts, [key]: e.target.value })}
              className={textareaCls}
            />
            <span className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{s.prompts[key].length}/4000</span>
              <button
                type="button"
                onClick={() => set("prompts", { ...s.prompts, [key]: DEFAULT_PROMPTS[key] })}
                className="min-h-11 text-primary hover:underline sm:min-h-0"
              >
                Reset to default
              </button>
            </span>
          </Field>
        ))}
      </div>
      <Save error={error} payload={() => ({ section: "prompts", ...s.prompts })} />
    </section>
  );
}

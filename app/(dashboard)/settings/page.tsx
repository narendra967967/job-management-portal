"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Pencil,
  Check,
  X,
  Star,
  ShieldCheck,
  KeyRound,
  LogOut,
  Filter,
  User,
  Mail,
  Forward,
  RefreshCw,
  AlertTriangle,
  LifeBuoy,
  Sparkles,
  Wand2,
  Bell,
  ScrollText,
  Download,
  Crown,
  ArrowUpRight,
  type LucideIcon,
  Pause,
  Play,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn, formatDateTime } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { COUNTRY_OPTIONS } from "@/lib/geo";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useProfile,
  updateProfile,
  useResumes,
  useDefaultResumeId,
  uploadResume,
  renameResume,
  deleteResume,
  getResumeText,
  updateResumeText,
  getResumeFile,
  useAppSettings,
  useGmailSettings,
  useGoogle,
  disconnectGoogle,
  syncGmail,
  setSyncPaused,
  useSyncInterval,
  useGmailSync,
  useIngestErrors,
  clearIngestErrors,
  useAiSettings,
  updateAiSettings,
  saveAiKey,
  removeAiKey,
  useAiPrompts,
  updateAiPrompts,
  useIntake,
} from "@/lib/mock-store";
import { buildGmailQuery } from "@/lib/use-gmail-settings";
import { EmailForwardingCard } from "@/components/forwarding/email-forwarding-card";
import {
  COUNTRY_CODES,
  isValidEmail,
  joinMobile,
  splitMobile,
  validateMobile,
  MIN_PASSWORD_LENGTH,
} from "@/lib/validation";
import {
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_DRAFT_PROMPT,
  DEFAULT_SCORE_PROMPT,
} from "@/lib/ai-prompts";
import { signOutToHome, connectGoogle, changePassword } from "@/lib/auth-client";
import { previewPromptAction } from "@/actions/ai";
import { getMyPlanAction, type MyPlanDetails } from "@/actions/plan";
import { planGradientClass } from "@/lib/plan-accent";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { PlanBadge } from "@/components/ui/plan-badge";
import { toast } from "@/components/ui/toast";
import { MarkdownLite, looksLikeMarkdown } from "@/components/ui/markdown-lite";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_PROVIDER_DEFAULT_MODEL,
  AI_PROVIDER_KEY_PREFIX,
  AI_PROVIDER_LABELS,
  RESUME_ACCEPT,
  RESUME_ALLOWED_EXT,
  RESUME_MAX_BYTES,
  type AiProvider,
  type Resume,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useContactSupport } from "@/components/support/contact-support";
import { TicketStatusPill } from "@/components/support/ticket-status-pill";
import { listMyTicketsAction } from "@/actions/support";
import {
  TICKET_CATEGORY_LABELS,
  ticketRef,
  type UserTicketSummary,
  type TicketStatus,
  type TicketCategory,
} from "@/lib/tickets-model";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  render: () => React.ReactNode;
}

const SECTION = {
  profile: { id: "profile", label: "Profile", icon: User, render: () => <ProfileCard /> },
  plan: { id: "plan", label: "Plan", icon: Crown, render: () => <PlanDetailsCard /> },
  forwarding: { id: "forwarding", label: "Email forwarding", icon: Forward, render: () => <EmailForwardingCard /> },
  google: { id: "google", label: "Gmail connection", icon: Mail, render: () => <GoogleCard /> },
  schedule: { id: "schedule", label: "Sync schedule", icon: RefreshCw, render: () => <SyncScheduleCard /> },
  issues: { id: "issues", label: "Ingestion issues", icon: AlertTriangle, render: () => <IngestionIssuesCard /> },
  ai: { id: "ai", label: "AI provider", icon: Sparkles, render: () => <AiProviderCard /> },
  prompts: { id: "prompts", label: "AI prompts", icon: Wand2, render: () => <AiPromptsCard /> },
  followups: { id: "followups", label: "Follow-ups", icon: Bell, render: () => <FollowUpsCard /> },
  resumes: { id: "resumes", label: "Resumes", icon: FileText, render: () => <ResumesCard /> },
  help: { id: "help", label: "Help & support", icon: LifeBuoy, render: () => <HelpSupportCard /> },
  account: { id: "account", label: "Account", icon: ShieldCheck, render: () => <AccountCard /> },
} satisfies Record<string, SettingsSection>;

// Grouped and ordered by how central each area is to capturing and acting on
// leads: identity first, then the email pipeline that feeds everything, then
// AI enrichment, then outreach. Account (log out) sits on its own at the end.
// "Gmail connection" and "Sync schedule" exist only while the admin's Connect
// Gmail switch is on (docs/email-forwarding.md §4a); forwarding is always listed.
function settingsGroups(gmailEnabled: boolean): { label: string; items: SettingsSection[] }[] {
  return [
    { label: "General", items: [SECTION.profile, SECTION.plan] },
    {
      label: "Email & sync",
      items: gmailEnabled
        ? [SECTION.forwarding, SECTION.google, SECTION.schedule, SECTION.issues]
        : [SECTION.forwarding, SECTION.issues],
    },
    { label: "AI", items: [SECTION.ai, SECTION.prompts] },
    { label: "Outreach", items: [SECTION.followups, SECTION.resumes] },
  ];
}
const FOOTER: SettingsSection[] = [SECTION.help, SECTION.account];

function TabButton({
  section,
  active,
  onSelect,
}: {
  section: SettingsSection;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors lg:w-full",
        active
          ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/10"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground/70",
        )}
      />
      {section.label}
    </button>
  );
}

export default function SettingsPage() {
  // The active tab lives in the URL (?tab=…) so it survives a refresh and
  // back-navigation (e.g. back from a ticket returns to Help & support).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const gmailEnabled = useIntake().gmailOAuthEnabled;
  const GROUPS = settingsGroups(gmailEnabled);
  const SECTIONS: SettingsSection[] = [...GROUPS.flatMap((g) => g.items), ...FOOTER];
  const active = SECTIONS.some((s) => s.id === tabParam) ? (tabParam as string) : SECTIONS[0].id;
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  function setActive(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Manage your profile, resumes, and Google connection.
        </p>
      </div>

      <div className="mt-5 lg:flex lg:gap-6">
        {/* Mobile / tablet: flat horizontal strip. The app's own left rail
            already appears at md, so a second sidebar there would squeeze the
            panel into a horizontal scroll — the grouped sidebar waits for lg. */}
        <nav
          aria-label="Settings sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden"
        >
          {SECTIONS.map((s) => (
            <TabButton
              key={s.id}
              section={s}
              active={s.id === active}
              onSelect={setActive}
            />
          ))}
        </nav>

        {/* Desktop: grouped vertical sidebar. */}
        <nav
          aria-label="Settings sections"
          className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-5"
        >
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {g.label}
              </p>
              {g.items.map((s) => (
                <TabButton
                  key={s.id}
                  section={s}
                  active={s.id === active}
                  onSelect={setActive}
                />
              ))}
            </div>
          ))}
          <div className="space-y-1 border-t pt-4">
            {FOOTER.map((s) => (
              <TabButton
                key={s.id}
                section={s}
                active={s.id === active}
                onSelect={setActive}
              />
            ))}
          </div>
        </nav>

        <div className="mt-4 min-w-0 flex-1 lg:mt-0">{current.render()}</div>
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */

const DIAL_ITEMS: Record<string, string> = Object.fromEntries(
  COUNTRY_CODES.map((c) => [c.dial, `${c.flag} ${c.dial}`]),
);

interface ProfileErrors {
  name?: string;
  mobile?: string;
}

const NO_COUNTRY = "__none";
const COUNTRY_ITEMS: Record<string, string> = {
  [NO_COUNTRY]: "Not set",
  ...Object.fromEntries(COUNTRY_OPTIONS.map((c) => [c, c])),
};

function ProfileCard() {
  const profile = useProfile();
  const initialMobile = splitMobile(profile.mobile);
  const [name, setName] = useState(profile.name);
  const [dial, setDial] = useState(initialMobile.dial);
  const [national, setNational] = useState(initialMobile.national);
  const [country, setCountry] = useState(profile.country);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const m = splitMobile(profile.mobile);
    setName(profile.name);
    setDial(m.dial);
    setNational(m.national);
    setCountry(profile.country);
    setErrors({});
  }, [profile]);

  // Email is the login identifier — read-only here (change it via an admin).
  function validate(): ProfileErrors {
    const next: ProfileErrors = {};
    if (!name.trim()) next.name = "Name is required.";
    const mobileError = validateMobile(dial, national);
    if (mobileError) next.mobile = mobileError;
    return next;
  }

  function save() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateProfile({
      name: name.trim(),
      mobile: joinMobile(dial, national),
      country,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Profile</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used to identify you and sign in.
          </p>
        </div>
        {profile.plan && (
          <PlanBadge name={profile.plan.name} accent={profile.plan.accent} className="shrink-0" />
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            aria-invalid={!!errors.name}
            required
          />
          {errors.name && (
            <span className="text-[11px] text-destructive">{errors.name}</span>
          )}
        </Field>
        <Field label="Mobile number">
          <div className="flex gap-2">
            <Select
              items={DIAL_ITEMS}
              value={dial}
              onValueChange={(v) => setDial(v ?? dial)}
            >
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.iso} value={c.dial}>
                    {c.flag} {c.dial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={national}
              onChange={(e) => {
                setNational(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (errors.mobile) setErrors((p) => ({ ...p, mobile: undefined }));
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              aria-invalid={!!errors.mobile}
              className="flex-1"
            />
          </div>
          {errors.mobile && (
            <span className="text-[11px] text-destructive">{errors.mobile}</span>
          )}
        </Field>
        <Field label="Country you live in">
          <Select
            items={COUNTRY_ITEMS}
            value={country || NO_COUNTRY}
            onValueChange={(v) => setCountry(!v || v === NO_COUNTRY ? "" : v)}
          >
            <SelectTrigger aria-label="Country you live in" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COUNTRY}>Not set</SelectItem>
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            Used for salary estimates on remote jobs whose location doesn&apos;t
            say where they hire.
          </span>
        </Field>
        <Field label="Email (login ID)">
          <Input
            type="email"
            value={profile.email}
            readOnly
            disabled
            title="Your login email can't be changed here"
          />
          <span className="text-[11px] text-muted-foreground">
            Used to sign in — can&apos;t be changed here.
          </span>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save}>Save changes</Button>
        {saved && (
          <span className="text-xs text-status-applied-foreground">Saved</span>
        )}
      </div>
    </section>
  );
}

/* ---------------- Google connection ---------------- */

function PlanDetailsCard() {
  const { open: openSupport } = useContactSupport();
  const [plan, setPlan] = useState<MyPlanDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPlanAction().then((p) => {
      setPlan(p);
      setLoading(false);
    });
  }, []);

  function requestUpgrade() {
    openSupport({
      category: "billing",
      subject: "Upgrade request",
      message: `<p>I'd like to upgrade my plan${plan ? ` (currently on ${plan.name})` : ""}. Please help me move to a higher plan.</p>`,
      source: "plan",
    });
  }

  const money = (n: number, cur: string) => `${cur === "USD" ? "$" : "₹"}${n.toLocaleString("en-IN")}`;
  const daysLeft = plan?.expiresAt
    ? Math.ceil((new Date(plan.expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="rounded-2xl border bg-card">
      <div className="border-b p-4 md:p-5">
        <h2 className="text-sm font-medium">Your plan</h2>
        <p className="text-xs text-muted-foreground">Your current plan and what&apos;s included.</p>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : !plan ? (
        <div className="p-6 text-center">
          <p className="text-sm font-medium">No plan assigned</p>
          <p className="mt-1 text-xs text-muted-foreground">Contact support to get set up on a plan.</p>
        </div>
      ) : (
        <div className="p-4 md:p-5">
          {/* Coloured plan header */}
          <div className={cn("rounded-xl bg-gradient-to-br p-4 text-white", planGradientClass(plan.accent))}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Crown className="size-5 shrink-0" aria-hidden />
                <span className="text-lg font-semibold">{plan.name}</span>
              </div>
              <div className="text-right">
                {plan.isFree ? (
                  <span className="text-lg font-bold">Free</span>
                ) : plan.monthlyPrice > 0 ? (
                  <span className="text-lg font-bold">
                    {money(plan.monthlyPrice, plan.currency)}
                    <span className="text-xs font-normal opacity-80">/mo</span>
                  </span>
                ) : (
                  <span className="text-lg font-bold">
                    {money(plan.yearlyPrice, plan.currency)}
                    <span className="text-xs font-normal opacity-80">/yr</span>
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-white/85">
              {plan.expiresAt ? (
                <>
                  Access until{" "}
                  {new Date(plan.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  {daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && <span className="ml-1 opacity-90">· {daysLeft}d left</span>}
                </>
              ) : (
                "No expiry"
              )}
            </p>
          </div>

          {/* Features */}
          {plan.features.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">{f}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Limits */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Résumés: <span className="font-medium text-foreground">{plan.limitResumes === null ? "Unlimited" : plan.limitResumes}</span>
            </span>
            <span>
              Custom AI prompts: <span className="font-medium text-foreground">{plan.allowCustomPrompts ? "Yes" : "No"}</span>
            </span>
            <span>
              Notes: <span className="font-medium text-foreground">{plan.allowNotes ? "Yes" : "No"}</span>
            </span>
            <span>
              Salary insight: <span className="font-medium text-foreground">{plan.allowSalaryInsight ? "Yes" : "No"}</span>
            </span>
          </div>

          {/* Upgrade — only when a higher-priced active plan exists */}
          {plan.upgradeAvailable ? (
            <div className="relative mt-5">
              <div
                aria-hidden
                className="absolute -inset-0.5 animate-pulse rounded-xl bg-gradient-to-r from-primary to-[oklch(0.5_0.2_308)] opacity-60 blur-md"
              />
              <button
                type="button"
                onClick={requestUpgrade}
                className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[oklch(0.5_0.2_308)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Sparkles className="size-4" aria-hidden /> Upgrade your plan
                <ArrowUpRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <p className="mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" aria-hidden /> You&apos;re on the top plan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GoogleCard() {
  const google = useGoogle();
  const [settings, updateSettings] = useGmailSettings();
  const syncStatus = useGmailSync();
  const paused = !!syncStatus.pausedAt;
  const mounted = useMounted(); // pause date is locale-dependent → client-only
  const [pausing, setPausing] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [sendersText, setSendersText] = useState("");
  const [label, setLabel] = useState("");
  const [subjectKeywords, setSubjectKeywords] = useState("");
  const [lookbackDays, setLookbackDays] = useState(30);
  const [saved, setSaved] = useState(false);
  const [sendersError, setSendersError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function runSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await syncGmail();
      if (r.connected) {
        const summary =
          `Fetched ${r.fetched}, added ${r.inserted} new, renewed ${r.renewed}` +
          (r.errors ? `, ${r.errors} parse issue${r.errors === 1 ? "" : "s"}.` : ".");
        setSyncMsg(summary);
        toast.success(
          r.inserted === 1
            ? "1 new lead captured"
            : `${r.inserted} new leads captured`,
          summary,
        );
      } else {
        const msg = r.message ?? "Not connected.";
        setSyncMsg(msg);
        toast.error("Gmail not synced", msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed.";
      setSyncMsg(msg);
      toast.error("Sync failed", msg);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setSendersText(settings.senders.join("\n"));
    setLabel(settings.label);
    setSubjectKeywords(settings.subjectKeywords);
    setLookbackDays(settings.lookbackDays);
  }, [settings]);

  const draft = {
    senders: sendersText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    label,
    subjectKeywords,
    lookbackDays,
  };
  const query = buildGmailQuery(draft);

  function save() {
    const badSenders = draft.senders.filter((s) => !isValidEmail(s));
    if (badSenders.length > 0) {
      setSendersError(
        `Not a valid email address: ${badSenders.join(", ")}. Put one address per line.`,
      );
      return;
    }
    if (draft.senders.length === 0 && !draft.label.trim()) {
      setSendersError(
        "Add at least one sender (or a Gmail label) so only job-alert emails are read.",
      );
      return;
    }
    setSendersError("");
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Google connection</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Connect Gmail so Jobtiva can read your LinkedIn job-alert emails.
          </p>
        </div>
        <span
          className={
            google.connected && paused
              ? "rounded-full bg-status-shortlisted px-2.5 py-0.5 text-[11px] font-medium text-status-shortlisted-foreground"
              : google.connected
                ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
                : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {google.connected ? (paused ? "Connected · Paused" : "Connected") : "Not connected"}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Read-only access (<code className="text-[11px]">gmail.readonly</code>).
          Jobtiva can never send, delete, or modify anything in your mailbox.
        </p>
      </div>

      {google.connected ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Connected as{" "}
              <span className="font-medium">
                {google.email ?? "Google account"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={runSync}
                disabled={syncing || paused}
                title={paused ? "Resume syncing to fetch new job alerts" : undefined}
              >
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="outline"
                disabled={pausing}
                onClick={async () => {
                  setPausing(true);
                  await setSyncPaused(!paused);
                  setPausing(false);
                }}
              >
                {paused ? (
                  <Play className="size-4" aria-hidden />
                ) : (
                  <Pause className="size-4" aria-hidden />
                )}
                {paused ? "Resume sync" : "Pause sync"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Disconnect Google?",
                      description:
                        "Gmail sync will stop until you reconnect. Your captured leads stay.",
                      confirmLabel: "Disconnect",
                      destructive: true,
                    })
                  ) {
                    disconnectGoogle();
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
          {paused && (
            <p className="text-xs text-status-shortlisted-foreground">
              Syncing is paused{mounted && syncStatus.pausedAt ? ` since ${formatDateTime(syncStatus.pausedAt)}` : ""}. Your
              Google account stays connected — no new job alerts are fetched until you resume.
            </p>
          )}
          {syncMsg && (
            <p className="text-xs text-muted-foreground">{syncMsg}</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={() => connectGoogle()} disabled={!google.configured}>
            <GoogleGlyph />
            Connect Google
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {google.configured
              ? "Grants read-only Gmail access so Jobtiva can fetch your LinkedIn job alerts."
              : "Gmail connection isn’t available yet — an administrator needs to configure Google access for this workspace."}
          </p>
        </div>
      )}

      {/* ---- Which emails to ingest ---- */}
      <div className="mt-5 border-t pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" aria-hidden />
          Which emails to read
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Jobtiva only reads messages matching these rules. Tip: open a real
          LinkedIn alert in Gmail and copy its “From” address to be sure.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="From addresses (one per line)">
            <Textarea
              value={sendersText}
              onChange={(e) => {
                setSendersText(e.target.value);
                if (sendersError) setSendersError("");
              }}
              placeholder="jobalerts-noreply@linkedin.com"
              aria-invalid={!!sendersError}
              className="min-h-20 font-mono text-[13px]"
            />
            {sendersError ? (
              <span className="text-[11px] text-destructive">{sendersError}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Required — at least one sender, or a Gmail label below.
              </span>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gmail label (optional)">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Job Alerts"
              />
            </Field>
            <Field label="Initial history to pull">
              <Select
                items={{
                  "7": "Last 7 days",
                  "30": "Last 30 days",
                  "90": "Last 90 days",
                  "180": "Last 6 months",
                  "0": "All mail",
                }}
                value={String(lookbackDays)}
                onValueChange={(v) => setLookbackDays(Number(v ?? "30"))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="0">All mail</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Subject must contain (optional, comma-separated)">
            <Input
              value={subjectKeywords}
              onChange={(e) => setSubjectKeywords(e.target.value)}
              placeholder="job alert, new jobs"
            />
          </Field>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Effective Gmail search
            </span>
            <p className="mt-1.5 rounded-lg border bg-muted/40 p-2.5 font-mono text-[12px] break-all text-foreground">
              {query}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              The first sync backfills this window; after that Jobtiva fetches only
              new mail and skips jobs already saved (deduped by LinkedIn job
              ID), so nothing is imported twice.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Save email rules</Button>
            {saved && (
              <span className="text-xs text-status-applied-foreground">Saved</span>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </section>
  );
}

/* ---------------- Sync schedule (cron) ---------------- */

const INTERVAL_LABELS: Record<string, string> = {
  "1": "Every hour",
  "3": "Every 3 hours",
  "6": "Every 6 hours",
  "12": "Every 12 hours",
  "24": "Once a day",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function SyncScheduleCard() {
  const google = useGoogle();
  const [interval, setInterval] = useSyncInterval();
  const sync = useGmailSync();
  const [cfg] = useGmailSettings();
  const mounted = useMounted(); // sync times are locale/time-zone dependent → client-only

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Sync schedule</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How often Jobtiva checks Gmail for new LinkedIn alerts.
      </p>

      <div className="mt-4">
        <Field label="Run frequency">
          <Select
            items={INTERVAL_LABELS}
            value={String(interval)}
            onValueChange={(v) => setInterval(Number(v ?? "24"))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INTERVAL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
        {!google.connected ? (
          <p className="text-muted-foreground">
            Connect Google (above) to enable syncing.
          </p>
        ) : sync.lastSyncedAt ? (
          <p className="text-foreground">
            Next run fetches alerts received{" "}
            <span className="font-medium">since {mounted ? fmtDateTime(sync.lastSyncedAt) : ""}</span>.
          </p>
        ) : (
          <p className="text-foreground">
            First run backfills the last{" "}
            <span className="font-medium">
              {cfg.lookbackDays === 0 ? "all" : cfg.lookbackDays} day
              {cfg.lookbackDays === 1 ? "" : "s"}
            </span>
            ; after that it fetches only new mail since the previous run.
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          Last run: {mounted ? fmtDateTime(sync.lastRunAt) : ""}
          {sync.lastError ? ` · last error: ${sync.lastError}` : ""}
        </p>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Auto-syncs about {INTERVAL_LABELS[String(interval)]?.toLowerCase()} while
        the app is open; the deployed cron runs it in the background.
      </p>
    </section>
  );
}

/* ---------------- Ingestion issues (FR-1.7) ---------------- */

function IngestionIssuesCard() {
  const errors = useIngestErrors();
  const mounted = useMounted(); // timestamps are locale/time-zone dependent → client-only
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { open: openSupport } = useContactSupport();

  function reportToSupport() {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const list = errors.slice(0, 8).map((e) => `<li>${esc(e.reason)}</li>`).join("");
    openSupport({
      category: "bug",
      subject: "Problem with Gmail sync / ingestion",
      source: "ingestion-issues",
      message: `<p>I'm seeing ingestion issues when my LinkedIn alerts are synced:</p><ul>${list}</ul><p>&nbsp;</p>`,
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Ingestion issues</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alert emails that couldn’t be parsed into leads.
          </p>
        </div>
        {errors.length > 0 && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={reportToSupport}>
              <LifeBuoy className="size-4" aria-hidden /> Report to support
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Clear ingestion issues?",
                    description: `All ${errors.length} logged parse issue${errors.length === 1 ? "" : "s"} will be removed. This can't be undone.`,
                    confirmLabel: "Clear",
                    destructive: true,
                  })
                ) {
                  clearIngestErrors();
                }
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
      {confirmDialog}

      {errors.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No issues — every alert parsed cleanly.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {errors.map((e) => (
            <li key={e.id} className="rounded-lg border p-3">
              <p className="text-xs font-medium">{e.reason}</p>
              {e.rawExcerpt && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {e.rawExcerpt}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {mounted ? fmtDateTime(e.createdAt) : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- AI provider & API key ---------------- */

function AiProviderCard() {
  const ai = useAiSettings();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { open: openSupport } = useContactSupport();
  const [provider, setProvider] = useState<AiProvider>(ai.provider);
  const [model, setModel] = useState(ai.model);
  const [keyInput, setKeyInput] = useState("");
  const [editingKey, setEditingKey] = useState(!ai.keyConfigured);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProvider(ai.provider);
    setModel(ai.model);
    setEditingKey(!ai.keyConfigured);
  }, [ai]);

  function pickProvider(p: AiProvider) {
    setProvider(p);
    updateAiSettings({ provider: p, model });
  }

  function saveModel() {
    updateAiSettings({ provider, model });
  }

  function saveKey() {
    const key = keyInput.trim();
    if (key.length < 8) {
      setError("Enter a valid API key.");
      return;
    }
    setError("");
    saveAiKey(key);
    setKeyInput("");
    setEditingKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function removeKey() {
    if (
      !(await confirm({
        title: "Remove API key?",
        description:
          "AI features (summaries, drafting, fit scoring) will stop working until you add a key again.",
        confirmLabel: "Remove",
        destructive: true,
      }))
    ) {
      return;
    }
    removeAiKey();
    setKeyInput("");
    setEditingKey(true);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">AI provider</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Powers job-description summaries, contact structuring, and outreach
            drafting.
          </p>
          <Link
            href="/guides?topic=ai-key"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            <BookOpen className="size-3.5" aria-hidden />
            How to get an API key
          </Link>
        </div>
        <span
          className={
            ai.keyConfigured
              ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
              : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {ai.keyConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select
            items={AI_PROVIDER_LABELS}
            value={provider}
            onValueChange={(v) => pickProvider((v as AiProvider) ?? provider)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {AI_PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Model (optional)">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={saveModel}
            placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
          />
        </Field>
      </div>

      <div className="mt-3">
        <span className="text-xs font-medium text-muted-foreground">
          API key
        </span>
        {ai.keyConfigured && !editingKey ? (
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              {AI_PROVIDER_KEY_PREFIX[provider]}-••••••••{ai.keyLast4}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditingKey(true)}>
                Replace
              </Button>
              <Button variant="outline" onClick={removeKey}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={`${AI_PROVIDER_KEY_PREFIX[provider]}-…`}
              autoComplete="off"
              className="flex-1 font-mono"
            />
            <div className="flex items-center gap-2">
              <Button onClick={saveKey}>Save key</Button>
              {ai.keyConfigured && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingKey(false);
                    setKeyInput("");
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        {saved && (
          <p className="mt-2 text-xs text-status-applied-foreground">
            API key saved
          </p>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Stored encrypted and used only server-side for AI calls. Your key is
          never sent to the browser or exposed in client code.
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Trouble with AI features?{" "}
        <button
          type="button"
          onClick={() => openSupport({ category: "bug", subject: "AI isn't working", source: "ai-settings" })}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Contact support
        </button>
        .
      </p>
      {confirmDialog}
    </section>
  );
}

/* ---------------- AI prompts ---------------- */

type PromptType = "summary" | "draft" | "score";

const SAMPLE_DRAFT_CONTEXT = `Message type: Cold outreach
Recipient: Priya Nair, Staff Product Manager (Referral)
Role: Senior Product Manager at Stripe
My resume: PM — Payments focus
Job context: Own the payments acceptance experience at scale — reliability, cross-functional leadership, remote (US).`;

const SAMPLE_SCORE_CONTEXT = `Role: Senior Product Manager at Stripe
Job description / summary:
Own the payments acceptance experience at scale — reliability, cross-functional leadership, remote (US).

Candidate resume (PM — Payments focus):
Product manager, 6 yrs in fintech/payments. Led acceptance & checkout at a mid-size PSP. Strong cross-functional leadership; some large-scale reliability exposure.`;

function AiPromptsCard() {
  const prompts = useAiPrompts();
  const [summary, setSummary] = useState(prompts.summary);
  const [draft, setDraft] = useState(prompts.draft);
  const [score, setScore] = useState(prompts.score);
  const prev = useRef(prompts);
  const [savedType, setSavedType] = useState<PromptType | null>(null);

  // Test modal state.
  const [testType, setTestType] = useState<PromptType | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  // Only reset a field when its *saved* value changes, so saving one prompt
  // (which refreshes the store) doesn't wipe an unsaved edit to the other.
  useEffect(() => {
    if (prompts.summary !== prev.current.summary) setSummary(prompts.summary);
    if (prompts.draft !== prev.current.draft) setDraft(prompts.draft);
    if (prompts.score !== prev.current.score) setScore(prompts.score);
    prev.current = prompts;
  }, [prompts]);

  const valueOf = (t: PromptType) =>
    t === "summary" ? summary : t === "draft" ? draft : score;
  const defaultOf = (t: PromptType) =>
    t === "summary"
      ? DEFAULT_SUMMARY_PROMPT
      : t === "draft"
        ? DEFAULT_DRAFT_PROMPT
        : DEFAULT_SCORE_PROMPT;

  // Save just one prompt; keep the others at their currently-saved value.
  function saveOne(t: PromptType) {
    updateAiPrompts({
      summary: t === "summary" ? summary : prompts.summary,
      draft: t === "draft" ? draft : prompts.draft,
      score: t === "score" ? score : prompts.score,
    });
    setSavedType(t);
    setTimeout(() => setSavedType((s) => (s === t ? null : s)), 1500);
  }

  function openTest(t: PromptType) {
    setTestType(t);
    setTestResult("");
    setTestError("");
    setTestInput(
      t === "draft"
        ? SAMPLE_DRAFT_CONTEXT
        : t === "score"
          ? SAMPLE_SCORE_CONTEXT
          : "",
    );
  }

  async function runTest() {
    if (!testType) return;
    setTesting(true);
    setTestError("");
    setTestResult("");
    // Test the current (unsaved) prompt, falling back to the default if empty.
    const system = valueOf(testType).trim() || defaultOf(testType);
    const res = await previewPromptAction(system, testInput);
    if (res.ok) setTestResult(res.output);
    else setTestError(res.error);
    setTesting(false);
  }

  function saveFromTest() {
    if (!testType) return;
    saveOne(testType);
    setTestType(null);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI prompts</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Customize the instructions used by “Summarize with AI”, “Draft with AI”,
        and fit scoring. Leave blank to use the default. Write instructions only
        — the job description, resume, and lead/contact details are added
        automatically. Use <span className="font-medium">Test</span> to preview a
        prompt before saving it.
      </p>

      <div className="mt-4 space-y-6">
        <PromptEditor
          label="Summarize prompt"
          value={summary}
          onChange={setSummary}
          onReset={() => setSummary("")}
          onTest={() => openTest("summary")}
          onSave={() => saveOne("summary")}
          saved={savedType === "summary"}
          placeholder={DEFAULT_SUMMARY_PROMPT}
          minHeight="min-h-24"
        />
        <PromptEditor
          label="Draft outreach prompt"
          value={draft}
          onChange={setDraft}
          onReset={() => setDraft("")}
          onTest={() => openTest("draft")}
          onSave={() => saveOne("draft")}
          saved={savedType === "draft"}
          placeholder={DEFAULT_DRAFT_PROMPT}
          minHeight="min-h-32"
        />
        <PromptEditor
          label="Fit score prompt"
          value={score}
          onChange={setScore}
          onReset={() => setScore("")}
          onTest={() => openTest("score")}
          onSave={() => saveOne("score")}
          saved={savedType === "score"}
          placeholder={DEFAULT_SCORE_PROMPT}
          minHeight="min-h-24"
        />
      </div>

      <Dialog
        open={testType !== null}
        onOpenChange={(o) => !o && !testing && setTestType(null)}
      >
        <DialogContent className="sm:max-w-xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Test{" "}
              {testType === "draft"
                ? "draft outreach"
                : testType === "score"
                  ? "fit score"
                  : "summarize"}{" "}
              prompt
            </DialogTitle>
            <DialogDescription>
              Run your prompt against sample text and review the result. Nothing
              is saved until you approve it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-test-input">
                {testType === "draft"
                  ? "Sample context"
                  : testType === "score"
                    ? "Sample job + resume"
                    : "Sample job description"}
              </Label>
              <Textarea
                id="prompt-test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={
                  testType === "draft"
                    ? "Recipient, role, resume, job context…"
                    : testType === "score"
                      ? "Job description + candidate resume…"
                      : "Paste a job description to summarize…"
                }
                className="min-h-28"
              />
            </div>

            <Button onClick={runTest} disabled={testing || !testInput.trim()}>
              <Sparkles className="size-4" aria-hidden />
              {testing
                ? "Running…"
                : testResult
                  ? "Run again"
                  : testType === "draft"
                    ? "Draft & test"
                    : testType === "score"
                      ? "Score & test"
                      : "Summarize & test"}
            </Button>

            {testError && (
              <p className="text-xs text-destructive">{testError}</p>
            )}
            {testResult && (
              <div className="space-y-1.5">
                <Label>Generated result</Label>
                <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/40 p-3">
                  {looksLikeMarkdown(testResult) ? (
                    <MarkdownLite text={testResult} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{testResult}</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Happy with this? Save the prompt. Otherwise close, tweak it,
                  and test again.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestType(null)}
              disabled={testing}
            >
              Cancel
            </Button>
            <Button onClick={saveFromTest} disabled={!testResult || testing}>
              <Check className="size-4" aria-hidden />
              Looks good — save prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PromptEditor({
  label,
  value,
  onChange,
  onReset,
  onTest,
  onSave,
  saved,
  placeholder,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  onTest: () => void;
  onSave: () => void;
  saved: boolean;
  placeholder: string;
  minHeight: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Reset to default
          </button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("mt-1.5", minHeight)}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" onClick={onTest}>
          <Sparkles className="size-4" aria-hidden />
          Test
        </Button>
        <Button onClick={onSave}>Save</Button>
        {saved && (
          <span className="text-xs text-status-applied-foreground">Saved</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Follow-ups ---------------- */

/** Days settings are whole numbers in 1–365. */
function clampDays(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(365, n);
}

function FollowUpsCard() {
  const [settings, update] = useAppSettings();
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Follow-ups</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How reminders are scheduled and when stalled leads get flagged.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Reminder interval (days)">
          <Input
            type="number"
            min={1}
            max={365}
            step={1}
            value={settings.reminderIntervalDays}
            onChange={(e) =>
              update({
                reminderIntervalDays: clampDays(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Flag lead as stale after (days)">
          <Input
            type="number"
            min={1}
            max={365}
            step={1}
            value={settings.staleLeadDays}
            onChange={(e) => update({ staleLeadDays: clampDays(e.target.value) })}
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A follow-up is auto-scheduled {settings.reminderIntervalDays} day
        {settings.reminderIntervalDays === 1 ? "" : "s"} after a message is
        marked sent. Open leads with no pending follow-up for{" "}
        {settings.staleLeadDays} days are flagged <em>Stale</em> for review.
      </p>

      <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
        <Field label="Automatic follow-ups after the first">
          <Input
            type="number"
            min={0}
            max={5}
            step={1}
            value={settings.maxFollowUps}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              update({ maxFollowUps: Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0 });
            }}
          />
          <span className="block text-[11px] text-muted-foreground">
            0–5. When you mark a follow-up as sent, the next one is scheduled
            until this many are done. 0 turns it off.
          </span>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Update status automatically
          </span>
          <SettingSwitch
            checked={settings.autoStatus}
            onChange={(v) => update({ autoStatus: v })}
            label="Update status automatically"
          />
          <span className="block text-[11px] text-muted-foreground">
            Moves a job forward from what you do — e.g. adding a contact →
            Shortlisted, sending cold outreach → Applied. Never moves backwards,
            and you can always undo.
          </span>
        </div>
      </div>
    </section>
  );
}

/** Accessible on/off switch (44px touch target). */
function SettingSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="text-sm">{checked ? "On" : "Off"}</span>
    </button>
  );
}

/* ---------------- Resumes ---------------- */

function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

interface PendingFile {
  fileName: string;
  fileType: Resume["fileType"];
  sizeKb: number;
}

function ResumesCard() {
  const resumes = useResumes();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [defaultResumeId, setDefaultResumeId] = useDefaultResumeId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [nameError, setNameError] = useState("");
  const [uploading, setUploading] = useState(false);
  // Resume-text editor (paste plain text used by AI fit scoring).
  const [textEditId, setTextEditId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textSaving, setTextSaving] = useState(false);

  async function openText(id: string) {
    setTextEditId(id);
    setTextValue("");
    setTextLoading(true);
    try {
      setTextValue(await getResumeText(id));
    } finally {
      setTextLoading(false);
    }
  }
  async function saveText() {
    if (!textEditId) return;
    setTextSaving(true);
    try {
      await updateResumeText(textEditId, textValue);
      setTextEditId(null);
    } finally {
      setTextSaving(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!(RESUME_ALLOWED_EXT as readonly string[]).includes(ext)) {
      setError("Upload a PDF or Word file (.pdf, .docx).");
    } else if (file.size > RESUME_MAX_BYTES) {
      setError("File must be under 5 MB.");
    } else {
      setError("");
      setPendingFile(file);
      setPending({
        fileName: file.name,
        fileType: ext as Resume["fileType"],
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      });
      setPendingName(file.name.replace(/\.[^.]+$/, ""));
      setNameError("");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    const label = pendingName.trim();
    if (!label) {
      setNameError("Give this resume a name.");
      return;
    }
    setUploading(true);
    setNameError("");
    const res = await uploadResume(pendingFile, label);
    setUploading(false);
    if (!res.ok) {
      setNameError(res.error);
      return;
    }
    setPending(null);
    setPendingFile(null);
    setPendingName("");
  }

  async function downloadResume(id: string) {
    const res = await getResumeFile(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: res.contentType }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = res.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveEdit(id: string) {
    const label = editLabel.trim();
    if (label) renameResume(id, label);
    setEditingId(null);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Resumes</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Upload PDF or Word (.docx) résumés. On upload the text is extracted and
        stored for AI fit scoring — edit it any time with the{" "}
        <ScrollText className="inline size-3" aria-hidden /> button.
      </p>

      <ul className="mt-4 space-y-2">
        {resumes.map((r) => (
          <li key={r.id} className="rounded-lg border p-3">
            {editingId === r.id ? (
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" aria-hidden />
                </span>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-9 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={() => saveEdit(r.id)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-status-applied-foreground hover:bg-muted"
                >
                  <Check className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => setEditingId(null)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{r.label}</p>
                    {r.id === defaultResumeId && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="size-2.5 fill-current" aria-hidden />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-px font-medium uppercase">
                      {r.fileType}
                    </span>
                    <span className="min-w-0 truncate">{r.fileName}</span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">
                      {formatSize(r.sizeKb)}
                    </span>
                    <span aria-hidden>·</span>
                    <span
                      className={cn(
                        "whitespace-nowrap font-medium",
                        r.hasText
                          ? "text-status-applied-foreground"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {r.hasText ? "Text added" : "No text"}
                    </span>
                  </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-0.5">
                <button
                  type="button"
                  aria-label={`Download ${r.label}`}
                  title="Download file"
                  onClick={() => downloadResume(r.id)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Edit résumé text for ${r.label}`}
                  title="Résumé text (used for AI scoring)"
                  onClick={() => openText(r.id)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ScrollText className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={
                    r.id === defaultResumeId
                      ? `${r.label} is the default resume`
                      : `Set ${r.label} as default`
                  }
                  title={
                    r.id === defaultResumeId ? "Default resume" : "Set as default"
                  }
                  onClick={() => setDefaultResumeId(r.id)}
                  disabled={r.id === defaultResumeId}
                  className={`flex size-11 items-center justify-center rounded-md sm:size-9 hover:bg-muted disabled:opacity-100 ${
                    r.id === defaultResumeId
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star
                    className={`size-4 ${r.id === defaultResumeId ? "fill-current" : ""}`}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${r.label}`}
                  onClick={() => {
                    setEditingId(r.id);
                    setEditLabel(r.label);
                  }}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${r.label}`}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Delete résumé?",
                        description: `"${r.label}" and its stored file and text will be permanently removed. This can't be undone.`,
                        confirmLabel: "Delete",
                        destructive: true,
                      })
                    ) {
                      deleteResume(r.id);
                    }
                  }}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {resumes.length === 0 && (
          <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No resumes yet.
          </li>
        )}
      </ul>

      <input
        ref={fileRef}
        type="file"
        accept={RESUME_ACCEPT}
        onChange={onFile}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        className="mt-3"
      >
        <Upload className="size-4" aria-hidden />
        Upload resume
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        PDF or Word (.pdf, .docx), up to 5 MB.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o && !uploading) {
            setPending(null);
            setPendingFile(null);
            setPendingName("");
            setNameError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this resume</DialogTitle>
            <DialogDescription>
              A short name to recognise it by. The text is extracted on upload
              for AI scoring.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="min-w-0 space-y-4 py-1">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pending.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="uppercase">{pending.fileType}</span> ·{" "}
                    {formatSize(pending.sizeKb)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resume-name">Resume name</Label>
                <Input
                  id="resume-name"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmUpload()}
                  placeholder="e.g. PM — Fintech"
                  autoFocus
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => {
                setPending(null);
                setPendingFile(null);
                setPendingName("");
                setNameError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmUpload} disabled={uploading}>
              {uploading ? "Adding…" : "Add resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste résumé text (used by AI fit scoring) */}
      <Dialog
        open={textEditId !== null}
        onOpenChange={(o) => !o && !textSaving && setTextEditId(null)}
      >
        <DialogContent className="sm:max-w-lg lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Résumé text</DialogTitle>
            <DialogDescription>
              Paste the plain text of this résumé. It&apos;s used only to score
              how well leads fit — nothing is sent anywhere until you press
              Calculate/Rescore on a lead.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <Textarea
              value={textLoading ? "" : textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={
                textLoading ? "Loading…" : "Paste your résumé text here…"
              }
              disabled={textLoading}
              className="max-h-[50vh] min-h-56"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTextEditId(null)}
              disabled={textSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveText} disabled={textSaving || textLoading}>
              {textSaving ? "Saving…" : "Save text"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </section>
  );
}

/* ---------------- Account ---------------- */

function HelpSupportCard() {
  const { open } = useContactSupport();
  const [tickets, setTickets] = useState<UserTicketSummary[] | null>(null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");

  useEffect(() => {
    let alive = true;
    void listMyTicketsAction().then((res) => {
      if (!alive) return;
      setTickets(res.ok ? res.tickets : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = (tickets ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Help &amp; support</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Have a question or hit a problem? Send us a message — replies show up right here.
          </p>
        </div>
        <Button onClick={() => open({ source: "settings" })}>
          <LifeBuoy className="size-4" aria-hidden /> Contact support
        </Button>
      </div>

      {/* The user's own requests */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Your requests
          </h3>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | TicketStatus)}
            aria-label="Filter requests by status"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="mt-2">
          {tickets === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {tickets.length === 0
                ? "You haven't raised any requests yet."
                : "No requests match this filter."}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border">
              {filtered.map((t) => {
                const cat = TICKET_CATEGORY_LABELS[t.category as TicketCategory] ?? t.category;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/support/${t.id}`}
                      className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{ticketRef(t.number)}</span> · {cat} · updated {formatDateTime(t.updatedAt)}
                          {t.replyCount > 0 && ` · ${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}`}
                        </p>
                      </div>
                      <TicketStatusPill status={t.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function AccountCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePw() {
    if (!current || !next) {
      setError("Enter your current and new password.");
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirmPw) {
      setError("New passwords don't match.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (res?.error) {
      setError(res.error.message ?? "Couldn't change password.");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirmPw("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Account</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Change your password or sign out.
      </p>

      <div className="mt-4 space-y-3">
        <Field label="Current password">
          <PasswordInput
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
        </Field>
        <div>
          <Field label="New password">
            <PasswordInput
              value={next}
              onChange={setNext}
              autoComplete="new-password"
            />
          </Field>
          <PasswordStrength value={next} />
        </div>
        <Field label="Confirm new password">
          <PasswordInput
            value={confirmPw}
            onChange={setConfirmPw}
            autoComplete="new-password"
          />
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={changePw} disabled={busy}>
            {busy ? "Updating…" : "Change password"}
          </Button>
          {saved && (
            <span className="text-xs text-status-applied-foreground">
              Password updated
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <Button variant="destructive" onClick={signOutToHome}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Shared ---------------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

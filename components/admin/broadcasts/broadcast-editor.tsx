"use client";

// Compose a broadcast, or edit a draft or a scheduled send that hasn't started.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, Mail, Megaphone, Save, Send, Trash2, Users, XCircle } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { HtmlEditor } from "@/components/admin/guides/html-editor";
import { InfoTip } from "@/components/ui/info-tip";
import { BroadcastPreview, NotSendingBanner, StatusBadge } from "@/components/admin/broadcasts/broadcast-bits";
import {
  cancelBroadcastAction,
  deleteBroadcastAction,
  saveBroadcastAction,
  sendTestBroadcastAction,
} from "@/actions/admin-broadcasts";
import {
  BROADCAST_CATEGORIES,
  BROADCAST_CHANNELS,
  BROADCAST_SCHEDULE_MIN_MINUTES,
  BROADCAST_TITLE_MAX,
  broadcastInputSchema,
  sendsEmail,
  sendsInApp,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastCategory,
  type BroadcastChannel,
  type BroadcastInput,
} from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

/** ISO → the value a datetime-local input wants, in this browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function BroadcastEditor({
  existing,
  audiences,
  appName,
}: {
  existing: Broadcast | undefined;
  audiences: Record<BroadcastCategory, BroadcastAudience>;
  appName: string;
}) {
  const router = useRouter();
  // Dates follow this browser's locale, so they wait for it.
  const mounted = useMounted();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [contentHtml, setContentHtml] = useState(existing?.contentHtml ?? "");
  const [category, setCategory] = useState<BroadcastCategory>(existing?.category ?? "important");
  const [channel, setChannel] = useState<BroadcastChannel>(existing?.channel ?? "both");
  const [timing, setTiming] = useState<"now" | "later">(existing?.scheduledFor ? "later" : "now");
  const [scheduleLocal, setScheduleLocal] = useState(toLocalInput(existing?.scheduledFor ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmUnschedule, setConfirmUnschedule] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const scheduled = existing?.status === "scheduled";
  const audience = audiences[category];
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [minLocal, setMinLocal] = useState("");
  useEffect(() => {
    setMinLocal(toLocalInput(new Date(Date.now() + BROADCAST_SCHEDULE_MIN_MINUTES * 60_000).toISOString()));
  }, []);

  // A long message is easy to lose to a stray tab close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  function input(): BroadcastInput | null {
    const r = broadcastInputSchema.safeParse({
      title,
      contentHtml,
      category,
      channel,
      scheduledFor: timing === "later" && scheduleLocal ? new Date(scheduleLocal).toISOString() : null,
    });
    const next: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) next[String(i.path[0] ?? "form")] ??= i.message;
    if (timing === "later" && !scheduleLocal) next.scheduledFor = "Pick a date and time, or choose Send now.";
    setErrors(next);
    return r.success && !next.scheduledFor ? r.data : null;
  }

  /** Runs a server action with the buttons held, and shows its error. */
  async function run<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) toast.error((r as { error?: string }).error ?? "Something went wrong.");
      return r.ok ? r : null;
    } catch {
      toast.error("That didn't go through. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!title.trim()) {
      setErrors({ title: "Give it a title so you can find the draft later." });
      return;
    }
    const r = await run(() =>
      saveBroadcastAction(existing?.id ?? null, { title: title.trim(), contentHtml, category, channel, scheduledFor: null }, "draft"),
    );
    if (!r || !("id" in r)) return;
    setDirty(false);
    toast.success(scheduled ? "Unscheduled and saved as a draft" : "Draft saved");
    if (!existing) router.replace(`/jmp-admin/broadcasts/${r.id}`);
    else router.refresh();
  }

  async function sendTest() {
    const v = input();
    if (!v) return;
    const r = await run(() => sendTestBroadcastAction(v));
    if (r && "to" in r) toast.success(`Test sent to ${r.to}`);
  }

  async function send() {
    const v = input();
    if (!v) return;
    const r = await run(() => saveBroadcastAction(existing?.id ?? null, v, "send"));
    if (!r || !("id" in r)) return;
    setDirty(false);
    toast.success(v.scheduledFor ? `Scheduled for ${formatDateTime(v.scheduledFor)}` : "Queued to send");
    router.push(`/jmp-admin/broadcasts/${r.id}`);
    router.refresh();
  }

  const inApp = sendsInApp(channel) ? audience.inApp : 0;
  const email = sendsEmail(channel) ? audience.email : 0;
  const confirmTitle =
    timing === "later" && scheduleLocal
      ? `Schedule for ${formatDateTime(new Date(scheduleLocal).toISOString())}?`
      : `Send to ${plural(Math.max(inApp, email), "user")} now?`;
  const confirmText = [
    inApp ? `In the app: ${plural(inApp, "user")}.` : "",
    email ? `Email: ${plural(email, "address", "addresses")}.` : "",
    timing === "later"
      ? "You can edit or cancel it until it starts."
      : "In-app messages arrive at once. Emails still waiting can be stopped, but sent ones can't be taken back.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <NotSendingBanner />
      {scheduled && existing && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <StatusBadge status="scheduled" /> <span className="ml-1">{mounted ? formatDateTime(existing.scheduledFor) : ""}</span>
          </p>
          <Button variant="outline" onClick={() => setConfirmUnschedule(true)}>
            <XCircle className="size-4" aria-hidden />
            Cancel send
          </Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-sm font-medium">
                Title
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                  {title.length}/{BROADCAST_TITLE_MAX}
                </span>
              </span>
              <Input
                value={title}
                onChange={(e) => touch(setTitle)(e.target.value.slice(0, BROADCAST_TITLE_MAX))}
                placeholder="e.g. Jobtiva will be offline for 30 minutes on Sunday"
                aria-invalid={!!errors.title}
                className="h-11 sm:h-9"
              />
              <span className={cn("block text-[11px]", errors.title ? "text-destructive" : "text-muted-foreground")}>
                {errors.title ?? "Shown in the bell and used as the email subject."}
              </span>
            </label>

            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 text-sm font-medium">Category</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(BROADCAST_CATEGORIES) as BroadcastCategory[]).map((c) => (
                  <label
                    key={c}
                    className={cn(
                      "flex min-h-11 cursor-pointer gap-2.5 rounded-lg border p-3 text-sm",
                      category === c ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c}
                      checked={category === c}
                      onChange={() => touch(setCategory)(c)}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <span>
                      <span className="block font-medium">{BROADCAST_CATEGORIES[c].label}</span>
                      <span className="block text-xs text-muted-foreground">{BROADCAST_CATEGORIES[c].audience}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Send it</legend>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Channel">
                {(Object.keys(BROADCAST_CHANNELS) as BroadcastChannel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    role="radio"
                    aria-checked={channel === ch}
                    onClick={() => touch(setChannel)(ch)}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium sm:min-h-9",
                      channel === ch ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ch === "in_app" ? <Megaphone className="size-4" aria-hidden /> : ch === "email" ? <Mail className="size-4" aria-hidden /> : null}
                    {BROADCAST_CHANNELS[ch]}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="space-y-1.5 p-4">
            <span className="text-sm font-medium">Message</span>
            <HtmlEditor value={contentHtml} onChange={touch(setContentHtml)} placeholder="Write the message…" label="Message" />
            <span className={cn("block text-[11px]", errors.contentHtml ? "text-destructive" : "text-muted-foreground")}>
              {errors.contentHtml ?? "Images need a full web address (https://…) to show in emails."}
            </span>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="space-y-3 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              Who gets it
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className={cn("flex justify-between", !sendsInApp(channel) && "text-muted-foreground line-through")}>
                <dt>In the app</dt>
                <dd className="font-medium tabular-nums">{plural(audience.inApp, "user")}</dd>
              </div>
              <div className={cn("flex justify-between", !sendsEmail(channel) && "text-muted-foreground line-through")}>
                <dt>Email</dt>
                <dd className="font-medium tabular-nums">{plural(audience.email, "address", "addresses")}</dd>
              </div>
            </dl>
            <ul className="space-y-1 border-t pt-2.5 text-xs text-muted-foreground">
              {sendsInApp(channel) && audience.expired > 0 && (
                <li>
                  {plural(audience.expired, "user")} on expired plans see it in the app after renewing.
                </li>
              )}
              {sendsEmail(channel) && audience.unverified > 0 && (
                <li>{plural(audience.unverified, "user")} haven&apos;t confirmed their email, so they get no email.</li>
              )}
              {audience.optedOut > 0 && <li>{plural(audience.optedOut, "user")} turned off promotional messages.</li>}
              <li>Deactivated accounts get nothing.</li>
            </ul>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">When</h2>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="When">
              {(["now", "later"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={timing === t}
                  onClick={() => touch(setTiming)(t)}
                  className={cn(
                    "min-h-11 rounded-md px-2 text-sm font-medium sm:min-h-9",
                    timing === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "now" ? "Send now" : "Schedule"}
                </button>
              ))}
            </div>
            {timing === "later" && (
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1 text-xs font-medium">
                  Date and time
                  <InfoTip label="About scheduled sends">
                    The server checks for due broadcasts every few minutes, so it goes out within about 5 minutes of
                    this time.
                  </InfoTip>
                </span>
                <Input
                  type="datetime-local"
                  value={scheduleLocal}
                  min={minLocal}
                  onChange={(e) => touch(setScheduleLocal)(e.target.value)}
                  aria-invalid={!!errors.scheduledFor}
                  className="h-11 sm:h-9"
                />
                <span className={cn("block text-[11px]", errors.scheduledFor ? "text-destructive" : "text-muted-foreground")}>
                  {errors.scheduledFor ?? `Your time zone: ${tz}`}
                </span>
              </label>
            )}
          </Card>

          <div className="grid gap-2">
            <Button onClick={() => input() && setConfirmSend(true)} disabled={busy}>
              {timing === "later" ? <CalendarClock className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {timing === "later" ? (scheduled ? "Update schedule" : "Schedule") : "Send now"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPreview(true)}>
                <Eye className="size-4" aria-hidden />
                Preview
              </Button>
              <Button variant="outline" onClick={sendTest} disabled={busy || !sendsEmail(channel)} title={sendsEmail(channel) ? undefined : "Only for broadcasts that send email"}>
                <Mail className="size-4" aria-hidden />
                Test to me
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={saveDraft} disabled={busy}>
                <Save className="size-4" aria-hidden />
                {scheduled ? "Unschedule" : "Save draft"}
              </Button>
              {existing && existing.status === "draft" && (
                <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <BroadcastPreview
        open={preview}
        onOpenChange={setPreview}
        title={title}
        contentHtml={contentHtml}
        category={category}
        channel={channel}
        appName={appName}
      />
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={confirmTitle}
        description={confirmText}
        confirmLabel={timing === "later" ? "Schedule" : "Send now"}
        onConfirm={send}
      />
      <ConfirmDialog
        open={confirmUnschedule}
        onOpenChange={setConfirmUnschedule}
        title="Cancel this send?"
        description="Nobody gets it. It stays in the list as canceled, and Duplicate makes a new draft from it."
        confirmLabel="Cancel send"
        destructive
        onConfirm={async () => {
          if (!existing) return;
          const r = await run(() => cancelBroadcastAction(existing.id));
          if (!r) return;
          setDirty(false);
          toast.success("Send canceled");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this draft?"
        description="It's gone for good."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!existing) return;
          const r = await run(() => deleteBroadcastAction(existing.id));
          if (!r) return;
          setDirty(false);
          toast.success("Draft deleted");
          router.push("/jmp-admin/broadcasts");
          router.refresh();
        }}
      />
    </div>
  );
}

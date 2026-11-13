"use client";

// Dashboard blocks about running the service: support, renewals, forwarding,
// email delivery, broadcasts, Gmail sync and the system itself.

import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  Forward,
  LifeBuoy,
  Mail,
  Mails,
  Megaphone,
  Server,
} from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { DonutChart } from "@/components/admin/ui/charts";
import { PROVIDER_LABELS } from "@/lib/email-delivery-model";
import {
  formatBytes,
  formatCount,
  formatDuration,
  links,
  timeUntil,
  type BroadcastSummary,
} from "@/lib/admin/dashboard-model";
import { timeAgo } from "@/lib/email-intake-model";
import { ticketRef } from "@/lib/tickets-model";
import { useMounted } from "@/lib/use-mounted";
import { BlockCard, Empty, Meter, StatRow } from "./parts";
import type { BlockProps } from "./blocks-growth";

const ROW = "-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60";

/* ---------------- support ---------------- */

export function SupportBlock({ data }: BlockProps) {
  const s = data.support;
  const mix = [
    { label: "Open", value: s.open },
    { label: "In progress", value: s.inProgress },
  ].filter((p) => p.value > 0);
  return (
    <BlockCard
      title="Support"
      icon={LifeBuoy}
      href={links.tickets({ status: "unresolved" })}
      info="The averages cover tickets opened in the selected period. First reply counts your first answer, not the user's own follow-ups."
    >
      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div>
          {mix.length > 0 ? (
            <DonutChart
              data={mix}
              centerLabel="Waiting"
              hrefs={mix.map((m) => links.tickets({ status: m.label === "Open" ? "open" : "in_progress" }))}
            />
          ) : (
            <Empty>No open tickets</Empty>
          )}
          <div className="mt-3 border-t pt-2">
            <StatRow
              label="Oldest waiting"
              value={formatDuration(s.oldestOpenMs)}
              tone={s.oldestOpenMs !== null && s.oldestOpenMs > 86_400_000 ? "bad" : "default"}
            />
            <StatRow label="Avg first reply" value={formatDuration(s.avgFirstResponseMs)} />
            <StatRow label="Avg time to resolve" value={formatDuration(s.avgResolutionMs)} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Waiting on you, oldest first</p>
          {s.waiting.length > 0 ? (
            <ul className="divide-y divide-border">
              {s.waiting.map((t) => (
                <li key={t.id}>
                  <Link href={links.tickets({ open: t.id })} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{ticketRef(t.number)}</span> · {t.who}
                        <span className="sm:hidden"> · {t.status === "open" ? "Open" : "In progress"}</span>
                      </p>
                    </div>
                    <Badge variant={t.status === "open" ? "warning" : "neutral"} className="hidden sm:inline-flex">
                      {t.status === "open" ? "Open" : "In progress"}
                    </Badge>
                    <span
                      className={
                        "w-14 shrink-0 text-right text-xs tabular-nums " +
                        (t.waitingMs > 86_400_000 ? "font-medium text-destructive" : "text-muted-foreground")
                      }
                    >
                      {formatDuration(t.waitingMs)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing is waiting on you</Empty>
          )}
        </div>
      </div>
    </BlockCard>
  );
}

/* ---------------- renewals ---------------- */

export function RenewalsBlock({ data }: BlockProps) {
  const r = data.renewals;
  const mounted = useMounted();
  return (
    <BlockCard title="Renewals" icon={CalendarClock} href={links.renewals()}>
      <StatRow label="Due in 7 days" value={formatCount(r.due7)} tone={r.due7 > 0 ? "warn" : "default"} href={links.renewals({ due: "7" })} />
      <StatRow label="Due in 30 days" value={formatCount(r.due30)} href={links.renewals({ due: "30" })} />
      <StatRow
        label="Expired in last 30 days"
        value={formatCount(r.expired30)}
        tone={r.expired30 > 0 ? "bad" : "good"}
        href={links.renewals({ due: "ended" })}
      />
      <p className="mt-3 mb-1 border-t pt-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next due</p>
      {r.next.length > 0 ? (
        <ul>
          {r.next.map((n) => (
            <li key={n.userId}>
              <Link href={links.renewals({ due: "7" })} className={ROW}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.plan}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{mounted ? timeUntil(n.endsAt) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No paid plans end soon</Empty>
      )}
    </BlockCard>
  );
}

/* ---------------- forwarding ---------------- */

export function ForwardingBlock({ data, range }: BlockProps) {
  const f = data.forwarding;
  const mounted = useMounted();
  return (
    <BlockCard title="Forwarding health" icon={Forward} href={links.inbound({ from: range.from, to: range.to })} cta="Log">
      {!f.enabled && <p className="mb-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Forwarding is turned off</p>}
      <StatRow label="Users set up" value={`${formatCount(f.usersSetUp)} / ${formatCount(f.usersTotal)}`} />
      <StatRow label="Received" value={formatCount(f.received)} href={links.inbound({ from: range.from, to: range.to })} />
      <StatRow
        label="Rejected"
        value={formatCount(f.rejected)}
        tone={f.rejected > 0 ? "warn" : "default"}
        href={links.inbound({ status: "rejected", from: range.from, to: range.to })}
      />
      <StatRow label="Accepted" value={`${f.acceptedPct}%`} tone={f.acceptedPct >= 80 ? "good" : f.acceptedPct < 50 ? "bad" : "warn"} />
      <StatRow label="Last email" value={mounted && f.lastReceivedAt ? timeAgo(f.lastReceivedAt) : f.lastReceivedAt ? "…" : "None yet"} />
      {f.topRejections.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Top rejections</p>
          <ul className="mt-1 space-y-1 text-xs">
            {f.topRejections.slice(0, 3).map((r) => (
              <li key={r.reason} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{r.reason}</span>
                <span className="font-medium tabular-nums">{formatCount(r.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockCard>
  );
}

/* ---------------- email delivery ---------------- */

export function EmailDeliveryBlock({ data, range }: BlockProps) {
  const e = data.emailDelivery;
  const q = e.sesQuota;
  const quotaPct = q && q.max > 0 ? q.used / q.max : 0;
  return (
    <BlockCard title="Email delivery" icon={Mails} href={links.settings("email")} cta="Settings">
      <StatRow
        label="Sending with"
        value={
          <span className="inline-flex items-center gap-1.5">
            {PROVIDER_LABELS[e.provider]}
            <Badge variant={e.ready ? "success" : "danger"}>{e.ready ? "Ready" : "Not set up"}</Badge>
          </span>
        }
      />
      {e.provider === "ses" && e.sesSandbox && <StatRow label="Amazon SES account" value="Sandbox" tone="warn" href={links.settings("email")} />}
      {q && (
        <div className="py-1.5">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">SES quota today</span>
            <span className="font-medium tabular-nums">
              {formatCount(q.used)} / {formatCount(q.max)}
            </span>
          </div>
          <Meter value={q.used} max={q.max} label="Amazon SES quota used today" tone={quotaPct > 0.9 ? "bad" : quotaPct > 0.7 ? "warn" : "default"} />
        </div>
      )}
      <StatRow label="Sent" value={formatCount(e.sent)} href={links.sentEmails({ status: "sent", from: range.from, to: range.to })} />
      <StatRow
        label="Failed"
        value={formatCount(e.failed)}
        tone={e.failed > 0 ? "bad" : "good"}
        href={links.sentEmails({ status: "failed", from: range.from, to: range.to })}
      />
      {e.byChannel.length > 1 && (
        <div className="mt-2 border-t pt-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">By channel</p>
          <ul className="mt-1 space-y-1 text-xs">
            {e.byChannel.map((c) => (
              <li key={c.channel} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{c.channel}</span>
                <span className="tabular-nums">
                  {formatCount(c.sent)} sent{c.failed > 0 && <span className="text-destructive"> · {formatCount(c.failed)} failed</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockCard>
  );
}

/* ---------------- broadcasts ---------------- */

function BroadcastRow({ label, b, when }: { label: string; b: BroadcastSummary; when: string }) {
  const pct = b.total > 0 ? Math.round((b.delivered / b.total) * 100) : 0;
  return (
    <Link href={links.broadcasts({ id: b.id })} className={ROW + " flex-col items-stretch gap-1"}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{when}</span>
      </div>
      <p className="truncate text-sm font-medium">{b.title}</p>
      {label !== "Next" && (
        <>
          {label === "Sending now" && <Meter value={b.delivered} max={b.total} label={`${b.title} progress`} />}
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatCount(b.delivered)} of {formatCount(b.total)} delivered ({pct}%)
            {b.failed > 0 && <span className="text-destructive"> · {formatCount(b.failed)} failed</span>}
          </p>
        </>
      )}
      {label === "Next" && <p className="text-xs text-muted-foreground tabular-nums">To {formatCount(b.total)} users</p>}
    </Link>
  );
}

export function BroadcastsBlock({ data }: BlockProps) {
  const b = data.broadcasts;
  const mounted = useMounted();
  const none = !b.next && !b.sending && !b.last;
  return (
    <BlockCard title="Broadcasts" icon={Megaphone} href={links.broadcasts()}>
      {none ? (
        <Empty>No broadcasts yet</Empty>
      ) : (
        <div className="divide-y divide-border">
          {b.sending && <BroadcastRow label="Sending now" b={b.sending} when={mounted ? `started ${timeAgo(b.sending.at)}` : ""} />}
          {b.next && <BroadcastRow label="Next" b={b.next} when={mounted ? timeUntil(b.next.at) : ""} />}
          {b.last && <BroadcastRow label="Last sent" b={b.last} when={mounted ? timeAgo(b.last.at) : ""} />}
        </div>
      )}
    </BlockCard>
  );
}

/* ---------------- Gmail (only while Gmail sign-in sync is on) ---------------- */

export function GmailBlock({ data }: BlockProps) {
  const g = data.gmail;
  const mounted = useMounted();
  return (
    <BlockCard title="Gmail health" icon={Mail}>
      <StatRow label="Connected accounts" value={`${formatCount(g.connected)} / ${formatCount(g.totalUsers)}`} />
      <StatRow label="Last sync" value={mounted && g.lastSyncAt ? timeAgo(g.lastSyncAt) : g.lastSyncAt ? "…" : "Never"} />
      <StatRow label="Ingest errors" value={formatCount(g.ingestErrors)} tone={g.ingestErrors > 0 ? "bad" : "good"} />
      <StatRow label="Failing syncs" value={formatCount(g.failingSyncs)} tone={g.failingSyncs > 0 ? "bad" : "good"} />
    </BlockCard>
  );
}

/* ---------------- system ---------------- */

export function SystemBlock({ data }: BlockProps) {
  const s = data.system;
  const mounted = useMounted();
  const diskPct = s.diskBytes ? s.dbSizeBytes / s.diskBytes : 0;
  return (
    <BlockCard title="System" icon={Server}>
      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <StatRow label="Environment" value={s.environment} />
          <StatRow label="Deployed commit" value={s.commit ? <span className="font-mono">{s.commit}</span> : "Unknown"} />
          <div className="py-1.5">
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Database size</span>
              <span className="font-medium tabular-nums">
                {formatBytes(s.dbSizeBytes)}
                {s.diskBytes ? <span className="font-normal text-muted-foreground"> of {formatBytes(s.diskBytes)} disk</span> : null}
              </span>
            </div>
            {s.diskBytes ? <Meter value={s.dbSizeBytes} max={s.diskBytes} label="Database size on disk" tone={diskPct > 0.8 ? "bad" : diskPct > 0.6 ? "warn" : "default"} /> : null}
          </div>
          <StatRow
            label="Résumés"
            value={`${formatCount(s.resumeFiles)} files · ${formatBytes(s.resumeBytes)}`}
            href={links.settings("retention")}
          />
          <StatRow label="App images" value={formatBytes(s.assetBytes)} href={links.settings("general")} />
        </div>
        <div className="mt-2 border-t pt-2 lg:mt-0 lg:border-t-0 lg:pt-0">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Scheduled jobs, last run</p>
          <ul>
            {s.jobs.map((j) => (
              <li key={j.key} className="flex min-h-9 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={j.error}>
                  {j.label}
                  {j.ok === false && j.error && <span className="block truncate text-[11px] text-destructive">{j.error}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{mounted && j.lastRunAt ? timeAgo(j.lastRunAt) : j.lastRunAt ? "" : "Never"}</span>
                <Badge variant={j.ok === null ? "neutral" : j.ok ? "success" : "danger"}>{j.ok === null ? "Not run" : j.ok ? "OK" : "Failed"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BlockCard>
  );
}

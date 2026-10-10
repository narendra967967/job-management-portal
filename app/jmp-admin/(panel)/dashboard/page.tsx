import Link from "next/link";
import {
  Users,
  UserCheck,
  FileText,
  Sparkles,
  LifeBuoy,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Badge } from "@/components/admin/ui/badge";
import { DonutChart, VizStyle } from "@/components/admin/ui/charts";
import { TimeSeriesCard } from "@/components/admin/dashboard/time-series-card";
import { requireAdmin } from "@/lib/current-user";
import {
  loadDashboardMetrics,
  type RecentTicket,
} from "@/lib/admin/dashboard-data";

// Admin dashboard home — real aggregates from the DB (see lib/admin/dashboard-data).
// User-base metrics count role='user' only (admins are operators, not customers).
//
// Note: deliberately NO aggregate lead-volume analytics here (total leads across
// users, leads-over-time). That's high-volume, per-user operational data — not
// useful admin analytics — and the leads table is auto-pruned on a retention
// schedule (see backend backlog). Admin metrics stay user/usage/system focused.
//
// Revenue / plan-over-time charts are intentionally absent: they need the billing
// integration (payments table + plan-change event log), which is deferred.

const STAT_ICONS: Record<string, LucideIcon> = {
  users: Users,
  active: UserCheck,
  resumes: FileText,
  ai: Sparkles,
};

const TICKET_BADGE: Record<RecentTicket["status"], "warning" | "neutral" | "success"> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
};
const TICKET_LABEL: Record<RecentTicket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default async function AdminDashboardPage() {
  await requireAdmin();
  const {
    stats,
    newUsers,
    aiScores,
    activeUsers,
    planMix,
    statusMix,
    funnel,
    ticketStats,
    recentTickets,
    sla,
    activity,
    system,
  } = await loadDashboardMetrics();

  return (
    <div className="space-y-6">
      <VizStyle />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = STAT_ICONS[s.key] ?? Sparkles;
          return (
            <Card key={s.key}>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.label} · {s.delta}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* User growth + plan mix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesCard title="New users" series={newUsers} unit="users" kind="bar" href="/jmp-admin/users" />
        </div>
        <Card>
          <SectionHeader title="Plan distribution" href="/jmp-admin/users" />
          <CardContent>
            {planMix.length > 0 ? (
              <DonutChart data={planMix} centerLabel="Users" />
            ) : (
              <Empty>No users yet</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI usage + active users (both time-based) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeSeriesCard title="AI scores" series={aiScores} unit="scores" kind="area" />
        <TimeSeriesCard title="Active users" series={activeUsers} unit="users" kind="area" href="/jmp-admin/users" />
      </div>

      {/* User status + onboarding funnel + support SLA */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Users by status" href="/jmp-admin/users" />
          <CardContent>
            {statusMix.length > 0 ? (
              <DonutChart data={statusMix} centerLabel="Users" />
            ) : (
              <Empty>No users yet</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Onboarding funnel" />
          <CardContent className="space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {f.value} · {f.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Support SLA" href="/jmp-admin/tickets" />
          <CardContent className="space-y-3 text-sm">
            <StatRow label="Avg first response" value={sla.firstResponse} />
            <StatRow label="Avg resolution" value={sla.resolution} />
            <StatRow label="Open (unresolved)" value={String(sla.openCount)} />
            <StatRow label="Oldest open" value={sla.oldestOpen} />
            <StatRow label="Resolution rate" value={`${sla.resolutionRate}%`} ok={sla.resolutionRate >= 50} />
          </CardContent>
        </Card>
      </div>

      {/* Tickets: status mix + recent list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Tickets by status" href="/jmp-admin/tickets" />
          <CardContent>
            {ticketStats.statusMix.length > 0 ? (
              <DonutChart data={ticketStats.statusMix} centerLabel="Tickets" />
            ) : (
              <Empty>No tickets yet</Empty>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Recent tickets" href="/jmp-admin/tickets" />
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="neutral">{ticketStats.total} total</Badge>
              <Badge variant="warning">{ticketStats.open} open</Badge>
            </div>
            {recentTickets.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentTickets.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                      <LifeBuoy className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.who}</p>
                    </div>
                    <Badge variant={TICKET_BADGE[t.status]}>{TICKET_LABEL[t.status]}</Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.when}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No tickets yet</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + system */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Recent activity" />
          <CardContent className="space-y-0">
            {activity.length > 0 ? (
              <ul className="divide-y divide-border">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                      {a.who.slice(0, 2)}
                    </span>
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.what}</span>
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.when}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No activity yet</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="System" />
          <CardContent className="space-y-3 text-sm">
            {system.map((r) => (
              <StatRow key={r.label} label={r.label} value={r.value} ok={r.ok} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  cta = "View all",
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
      <CardTitle>{title}</CardTitle>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {cta} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </CardHeader>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function StatRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          ok
            ? "font-medium text-status-applied-foreground"
            : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

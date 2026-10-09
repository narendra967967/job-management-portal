import {
  Users,
  UserCheck,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  AreaChart,
  BarChart,
  DonutChart,
  VizStyle,
} from "@/components/admin/ui/charts";
import { requireAdmin } from "@/lib/current-user";
import { loadDashboardMetrics, type SystemRow } from "@/lib/admin/dashboard-data";

// Admin dashboard home — real aggregates from the DB (see lib/admin/dashboard-data).
//
// Note: deliberately NO aggregate lead-volume analytics here (total leads across
// users, leads-over-time). That's high-volume, per-user operational data — not
// useful admin analytics — and the leads table is auto-pruned on a retention
// schedule (see backend backlog). Admin metrics stay user/usage/system focused.

const STAT_ICONS: Record<string, LucideIcon> = {
  users: Users,
  active: UserCheck,
  resumes: FileText,
  ai: Sparkles,
};

export default async function AdminDashboardPage() {
  await requireAdmin();
  const { stats, newUsers, aiCalls, planMix, statusMix, activity, system } =
    await loadDashboardMetrics();

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New users</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={newUsers} unit="users" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {planMix.length > 0 ? (
              <DonutChart data={planMix} centerLabel="Users" />
            ) : (
              <Empty>No users yet</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI usage + status mix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI calls</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart data={aiCalls} unit="calls" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users by status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusMix.length > 0 ? (
              <DonutChart data={statusMix} centerLabel="Users" />
            ) : (
              <Empty>No users yet</Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
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

        {/* System snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {system.map((r) => (
              <Row key={r.label} row={r} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Row({ row }: { row: SystemRow }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{row.label}</span>
      <span
        className={
          row.ok
            ? "font-medium text-status-applied-foreground"
            : "font-medium text-foreground"
        }
      >
        {row.value}
      </span>
    </div>
  );
}

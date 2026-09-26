import {
  Users,
  Briefcase,
  FileText,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/admin/ui/card";

// Admin dashboard home. Static mock data for now (UI-first); real numbers get
// wired to the DB in the backend phase.

const STATS: {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
}[] = [
  { label: "Total users", value: "2", delta: "+1 this month", icon: Users },
  { label: "Active leads", value: "548", delta: "across all users", icon: Briefcase },
  { label: "Résumés stored", value: "3", delta: "in S3", icon: FileText },
  { label: "AI calls (30d)", value: "126", delta: "+18% vs. prev.", icon: Sparkles },
];

const ACTIVITY: { who: string; what: string; when: string }[] = [
  { who: "narendra", what: "connected Gmail (read-only)", when: "2h ago" },
  { who: "kunal", what: "signed in for the first time", when: "5h ago" },
  { who: "system", what: "Gmail sync captured 4 new leads", when: "1d ago" },
  { who: "narendra", what: "uploaded a résumé", when: "2d ago" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest actions across the workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <ul className="divide-y divide-border">
              {ACTIVITY.map((a, i) => (
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
          </CardContent>
        </Card>

        {/* System snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
            <CardDescription>Environment snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Environment" value="Preprod" />
            <Row label="App version" value="v0.1.0" />
            <Row label="Database" value="Connected" ok />
            <Row label="Gmail sync" value="Every 15 min" />
            <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" aria-hidden />
              Placeholder data — wired to real metrics later.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
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

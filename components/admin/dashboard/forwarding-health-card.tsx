"use client";

// Dashboard → Forwarding health (A3) and the Connect Gmail gate for the Gmail
// health card. PHASE 2: sample data (lib/email-intake-mock.ts).

import Link from "next/link";
import { ArrowRight, Forward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { mockHealth, useMockIntake } from "@/lib/email-intake-mock";
import { timeAgo } from "@/lib/email-intake-model";
import { useMounted } from "@/lib/use-mounted";

export function ForwardingHealthCard() {
  const { config } = useMockIntake();
  const h = mockHealth();
  const mounted = useMounted();
  const rate = (a: number, r: number) => (a + r ? Math.round((a / (a + r)) * 100) : 100);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Forward className="size-4 text-primary" aria-hidden /> Forwarding health
        </CardTitle>
        <Link
          href="/jmp-admin/inbound-log"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Log <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!config.forwardingEnabled && (
          <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Forwarding is turned off</p>
        )}
        <StatRow label="Users set up" value={`${h.usersSetUp} / ${h.usersTotal}`} ok={h.usersSetUp > 0} />
        <StatRow label="Received (24 h)" value={String(h.last24h.received)} />
        <StatRow label="Rejected (24 h)" value={String(h.last24h.rejected)} />
        <StatRow
          label="Accepted (7 d)"
          value={`${rate(h.last7d.accepted, h.last7d.rejected)}%`}
          ok={rate(h.last7d.accepted, h.last7d.rejected) >= 80}
          warn={rate(h.last7d.accepted, h.last7d.rejected) < 50}
        />
        <StatRow label="Last email" value={mounted && h.lastReceivedAt ? timeAgo(h.lastReceivedAt) : "—"} />
        {h.topRejections.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Top rejections (7 d)</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              {h.topRejections.slice(0, 3).map((r) => (
                <li key={r.reason} className="flex justify-between">
                  <span className="text-muted-foreground">{r.reason}</span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders its children only while Connect Gmail is active. */
export function GmailOnly({ children }: { children: React.ReactNode }) {
  const { config } = useMockIntake();
  return config.gmailOAuthEnabled ? <>{children}</> : null;
}

function StatRow({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          warn
            ? "text-right font-medium text-destructive"
            : ok
              ? "text-right font-medium text-status-applied-foreground"
              : "text-right font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

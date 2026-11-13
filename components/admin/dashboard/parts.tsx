"use client";

// Small pieces shared by the dashboard blocks. Every link here keeps a 44px
// touch target, since the dashboard is used on phones too.

import Link from "next/link";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

export function BlockCard({
  title,
  icon: Icon,
  href,
  cta = "View all",
  action,
  info,
  className,
  contentClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Side note behind an ⓘ next to the title. */
  info?: React.ReactNode;
  href?: string;
  cta?: string;
  /** Extra control in the header, e.g. a range switch. */
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="size-4 shrink-0 text-primary" aria-hidden />}
          <span className="truncate">{title}</span>
          {info && <InfoTip label={`About ${title}`}>{info}</InfoTip>}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {href && <ViewLink href={href}>{cta}</ViewLink>}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function ViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/5"
    >
      {children} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

type Tone = "default" | "good" | "bad" | "warn";

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-status-applied-foreground",
  bad: "text-destructive",
  warn: "text-status-shortlisted-foreground",
};

/** Label on the left, value on the right; the whole row is a link when href is given. */
export function StatRow({
  label,
  value,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: Tone;
  hint?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 text-muted-foreground">
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
      </span>
      <span className={cn("ml-auto shrink-0 text-right font-medium tabular-nums", TONE[tone])}>{value}</span>
      {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  return href ? (
    <Link href={href} className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted/60">
      {body}
    </Link>
  ) : (
    <div className="flex min-h-9 items-center gap-2 text-sm">{body}</div>
  );
}

/** Thin horizontal meter, e.g. quota used. */
export function Meter({ value, max, tone = "default", label }: { value: number; max: number; tone?: Tone; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={cn(
          "h-full rounded-full",
          tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-status-shortlisted-foreground" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex min-h-24 items-center justify-center text-center text-sm text-muted-foreground">{children}</p>;
}

/** A small grey line under a figure, for the one note an admin needs. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

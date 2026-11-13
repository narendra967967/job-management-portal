"use client";

// The one period control for the whole dashboard. Lives in the URL
// (?period=&from=&to=) so a reload or a shared link shows the same view. The
// last choice is also kept in a cookie, which the page reads on the next visit
// without ?period (no redirect, no flash).

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { timeAgo } from "@/lib/email-intake-model";
import { PERIOD_COOKIE, PERIODS, ymd, type PeriodId, type PeriodSel } from "@/lib/admin/dashboard-model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

function remember(sel: PeriodSel) {
  const v = new URLSearchParams({ period: sel.id, ...(sel.id === "custom" && sel.from && sel.to ? { from: sel.from, to: sel.to } : {}) });
  document.cookie = `${PERIOD_COOKIE}=${encodeURIComponent(v.toString())}; path=/jmp-admin; max-age=31536000; samesite=lax`;
}

export function PeriodSwitch({ sel, generatedAt }: { sel: PeriodSel; generatedAt: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mounted = useMounted();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(sel.from ?? "");
  const [to, setTo] = useState(sel.to ?? "");
  const [custom, setCustom] = useState(sel.id === "custom");
  const [, tick] = useState(0);

  const go = (next: PeriodSel) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", next.id);
    if (next.id === "custom" && next.from && next.to) {
      sp.set("from", next.from);
      sp.set("to", next.to);
    } else {
      sp.delete("from");
      sp.delete("to");
    }
    remember(next);
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  // Follow the URL when it changes underneath us (remembered period, back button).
  useEffect(() => {
    setCustom(sel.id === "custom");
    if (sel.id === "custom") {
      setFrom(sel.from ?? "");
      setTo(sel.to ?? "");
    }
  }, [sel.id, sel.from, sel.to]);

  // Keep "Updated 3 min ago" honest while the page stays open.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const invalid = custom && (!from || !to || from > to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Period"
        value={custom ? "custom" : sel.id}
        onChange={(e) => {
          const id = e.target.value as PeriodId;
          if (id === "custom") {
            setCustom(true);
            if (!from || !to) {
              const today = new Date();
              setTo(ymd(today));
              setFrom(ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13)));
            }
            return;
          }
          setCustom(false);
          go({ id });
        }}
        className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 sm:flex-none"
      >
        {PERIODS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {custom && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-invalid={invalid} className="h-11 w-[9.5rem] sm:h-9" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-invalid={invalid} className="h-11 w-[9.5rem] sm:h-9" />
          </label>
          <Button size="sm" className="h-11 sm:h-9" disabled={invalid || pending} onClick={() => go({ id: "custom", from, to })}>
            Apply
          </Button>
          {invalid && <span className="w-full text-xs text-destructive">Pick a start date on or before the end date.</span>}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Updating…" : mounted ? `Updated ${timeAgo(generatedAt)}` : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          aria-label="Refresh"
          disabled={pending}
          onClick={() => start(() => router.refresh())}
        >
          <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

"use client";

// The page a promotional email's unsubscribe link opens. One click is enough:
// once the page loads in a browser it turns promotional messages off, no
// sign-in. It runs here rather than on the server's GET so email security
// scanners, which open every link, can't unsubscribe anyone.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, Link2Off, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { resubscribeAction, unsubscribeAction } from "@/actions/unsubscribe";
import { cn } from "@/lib/utils";

type State = "working" | "off" | "on" | "failed";

export function UnsubscribeCard({ token, valid, appName }: { token: string; valid: boolean; appName: string }) {
  const [state, setState] = useState<State>("working");
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!valid || done.current) return;
    done.current = true;
    unsubscribeAction(token)
      .then((r) => setState(r.ok ? "off" : "failed"))
      .catch(() => setState("failed"));
  }, [token, valid]);

  if (!valid) {
    return (
      <Shell icon={<Link2Off className="size-7" aria-hidden />} title="This link doesn't work">
        <p>
          Part of the address may have been cut off. Open the link from the email again, or sign in and turn off
          promotional messages in Settings → Notifications.
        </p>
        <Link href="/login" className={cn(buttonVariants(), "mt-6 h-11 px-5")}>
          Sign in
        </Link>
      </Shell>
    );
  }

  if (state === "working") {
    return (
      <Shell icon={<Loader2 className="size-7 animate-spin" aria-hidden />} title="Unsubscribing…">
        <p>One moment.</p>
      </Shell>
    );
  }

  if (state === "failed") {
    return (
      <Shell icon={<Link2Off className="size-7" aria-hidden />} title="That didn't go through">
        <p>
          Try the link again in a minute. If it still doesn&apos;t work, sign in and turn off promotional messages in
          Settings → Notifications.
        </p>
        <Link href="/login" className={cn(buttonVariants(), "mt-6 h-11 px-5")}>
          Sign in
        </Link>
      </Shell>
    );
  }

  return state === "off" ? (
    <Shell icon={<BellOff className="size-7" aria-hidden />} title="You're unsubscribed">
      <p>
        {appName} won&apos;t send you promotional messages anymore, by email or in the app. You&apos;ll still get
        important ones about your account, like planned downtime.
      </p>
      <Button
        variant="outline"
        className="mt-6 h-11 px-5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await resubscribeAction(token).catch(() => ({ ok: false }));
          setBusy(false);
          if (r.ok) setState("on");
        }}
      >
        Changed your mind? Turn them back on
      </Button>
    </Shell>
  ) : (
    <Shell icon={<BellRing className="size-7" aria-hidden />} title="Promotional messages are back on">
      <p>You can turn them off again any time in Settings → Notifications.</p>
      <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}>
        Sign in to {appName}
      </Link>
    </Shell>
  );
}

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-strong rounded-3xl p-6 text-center sm:p-10" role="status" aria-live="polite">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

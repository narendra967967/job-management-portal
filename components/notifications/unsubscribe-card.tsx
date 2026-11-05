"use client";

// The page a promotional email's unsubscribe link opens. One click is enough:
// arriving here with a valid link turns promotional messages off, no sign-in.
// PHASE 1: works on the sample opt-out in this browser; phase 4 checks a signed
// token from the link instead.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, Link2Off } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { setPromoOptOut } from "@/lib/broadcasts-mock";
import { cn } from "@/lib/utils";

export function UnsubscribeCard({ token, appName }: { token: string | null; appName: string }) {
  const [state, setState] = useState<"off" | "on">("off");

  useEffect(() => {
    if (token) setPromoOptOut(true);
  }, [token]);

  if (!token) {
    return (
      <Shell icon={<Link2Off className="size-7" aria-hidden />} title="This link isn't complete">
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

  return state === "off" ? (
    <Shell icon={<BellOff className="size-7" aria-hidden />} title="You're unsubscribed">
      <p>
        {appName} won&apos;t send you promotional messages anymore, by email or in the app. You&apos;ll still get
        important ones about your account, like planned downtime.
      </p>
      <Button
        variant="outline"
        className="mt-6 h-11 px-5"
        onClick={() => {
          setPromoOptOut(false);
          setState("on");
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
    <div className="glass-strong rounded-3xl p-6 text-center sm:p-10">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

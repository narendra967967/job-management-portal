"use client";

// Full-screen (no-scroll) notices shown when an admin has deactivated an account
// or its plan has expired. Deactivated users can message the admin; both can log out.

import { useState } from "react";
import { Ban, Clock, LogOut, Mail, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RichText } from "@/components/ui/rich-text";
import { signOutToHome } from "@/lib/auth-client";
import { requestReactivationAction } from "@/actions/account";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-sidebar-accent/40 via-background to-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">{children}</div>
    </div>
  );
}

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function DeactivatedNotice({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    const message = plainText(html);
    if (!message) {
      setError("Write a short message first.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await requestReactivationAction({ message, html });
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error ?? "Couldn't send. Please try again.");
  }

  function close() {
    setOpen(false);
    // Reset after the dialog animates out.
    setTimeout(() => {
      setSent(false);
      setHtml("");
      setError("");
    }, 200);
  }

  return (
    <Shell>
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Ban className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Your account is deactivated</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {name ? `${name}, an` : "An"} administrator has paused access to this account. If you think
        this is a mistake, send them a quick note and they&apos;ll take a look.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button className="h-10 w-full gap-2" onClick={() => setOpen(true)}>
          <Mail className="size-4" aria-hidden />
          Email the admin
        </Button>
        <Button variant="outline" className="h-10 w-full gap-2" onClick={() => signOutToHome()}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-applied text-status-applied-foreground">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold">Message sent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The admin has your note and will get back to you by email.
              </p>
              <Button className="mt-5" onClick={close}>Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Message the admin</DialogTitle>
                <DialogDescription>
                  Tell them what you need and they&apos;ll reply to your email.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <RichText value={html} onChange={setHtml} placeholder="Hi, I'd like my account reactivated because…" />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
                <Button onClick={send} disabled={busy} className="gap-2">
                  <Send className="size-4" aria-hidden />
                  {busy ? "Sending…" : "Send"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

export function RenewNotice({ name }: { name: string }) {
  return (
    <Shell>
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-status-reviewing text-status-reviewing-foreground">
        <Clock className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Your plan has expired</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {name ? `${name}, your` : "Your"} subscription has run out. Renew to pick up right where you
        left off — your data is safe and waiting.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button className="h-10 w-full" disabled>Renew plan</Button>
        <Button variant="outline" className="h-10 w-full gap-2" onClick={() => signOutToHome()}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </Button>
      </div>
    </Shell>
  );
}

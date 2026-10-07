"use client";

// Contact-support feature. A single dialog is mounted once by ContactSupportProvider;
// every entry point (sidebar, top bar, account menu, Settings) opens it via the
// useContactSupport() hook. Submitting files a ticket (admin inbox) and emails the
// user a confirmation — replies come back by email (one-way).

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { richTextToPlain } from "@/lib/sanitize";
import { submitSupportTicketAction } from "@/actions/support";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory } from "@/lib/tickets-model";
import { cn } from "@/lib/utils";

export interface SupportPrefill {
  category?: TicketCategory;
  subject?: string;
  /** Rich-text HTML to pre-fill the message with (e.g. an error summary). */
  message?: string;
  /** Where this was opened from (defaults to the current page path). */
  source?: string;
}

const SupportContext = createContext<{ open: (prefill?: SupportPrefill) => void } | null>(null);

export function useContactSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error("useContactSupport must be used within <ContactSupportProvider>.");
  return ctx;
}

export function ContactSupportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<SupportPrefill>({});
  const openDialog = useCallback((p?: SupportPrefill) => {
    setPrefill(p ?? {});
    setOpen(true);
  }, []);
  return (
    <SupportContext.Provider value={{ open: openDialog }}>
      {children}
      <ContactSupportDialog open={open} onOpenChange={setOpen} prefill={prefill} />
    </SupportContext.Provider>
  );
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function ContactSupportDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: SupportPrefill;
}) {
  const pathname = usePathname();
  const [category, setCategory] = useState<TicketCategory>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(""); // rich-text HTML
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory(prefill.category ?? "question");
    setSubject(prefill.subject ?? "");
    setMessage(prefill.message ?? "");
  }, [open, prefill]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3) return toast.error("Add a short subject");
    if (richTextToPlain(message).length < 5) return toast.error("Tell us a bit more about the issue");
    setBusy(true);
    const res = await submitSupportTicketAction({
      category,
      subject: subject.trim(),
      message,
      source: prefill.source ?? pathname,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Request sent", "We'll reply to your account email.");
      onOpenChange(false);
    } else {
      toast.error("Couldn't send", res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LifeBuoy className="size-4" aria-hidden />
            </span>
            Contact support
          </DialogTitle>
          <DialogDescription>Tell us what&apos;s up — we&apos;ll reply to your account email.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Category</span>
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly, what's this about?" maxLength={120} />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Message</span>
            <RichText value={message} onChange={setMessage} placeholder="Share the details — what happened, what you expected…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              <Send className="size-4" aria-hidden /> {busy ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Full-width "Help & support" row (sidebar footer / settings). */
export function SupportNavButton({ className }: { className?: string }) {
  const { open } = useContactSupport();
  return (
    <button
      type="button"
      onClick={() => open()}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        className,
      )}
    >
      <LifeBuoy className="size-5 shrink-0" aria-hidden />
      Help &amp; support
    </button>
  );
}

/** Compact "?" icon for the top bar. */
export function SupportIconButton() {
  const { open } = useContactSupport();
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label="Help & support"
      className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <LifeBuoy className="size-5" aria-hidden />
    </button>
  );
}

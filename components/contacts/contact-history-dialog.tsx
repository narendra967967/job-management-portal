"use client";

import Link from "next/link";
import { Sparkles, ExternalLink, Send, Briefcase } from "lucide-react";
import { usePerson } from "@/lib/mock-store";
import {
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
} from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

/**
 * Full outreach history for one person across every lead they appear on
 * (FR-6.1) — context before reaching out to them again.
 */
export function ContactHistoryDialog({
  personKey,
  open,
  onOpenChange,
}: {
  personKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const person = usePerson(personKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {person && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {initialsOf(person.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{person.name}</span>
                  {person.title && (
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {person.title}
                    </span>
                  )}
                </span>
              </DialogTitle>
              <DialogDescription>
                Seen on {person.leads.length}{" "}
                {person.leads.length === 1 ? "lead" : "leads"} ·{" "}
                {person.messageCount}{" "}
                {person.messageCount === 1 ? "message" : "messages"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {person.connectionTypes.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {CONNECTION_TYPE_LABELS[t]}
                  </span>
                ))}
                {person.aiParsed && (
                  <span className="inline-flex items-center gap-1 rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
                    <Sparkles className="size-2.5" aria-hidden />
                    AI-parsed
                  </span>
                )}
              </div>
              {person.linkedinUrl && (
                <a
                  href={person.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  LinkedIn profile
                </a>
              )}
            </div>

            {/* One block per lead this person appears on, newest first. */}
            <ul className="mt-2 space-y-3">
              {person.leads.map(({ lead, contact, messages }) => (
                <li key={contact.id} className="rounded-xl border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="min-w-0 flex-1 hover:text-primary"
                    >
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Briefcase className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{lead.title}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.company} · as{" "}
                        {CONNECTION_TYPE_LABELS[contact.connectionType]}
                      </p>
                    </Link>
                  </div>

                  {messages.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No messages to this contact yet.
                    </p>
                  ) : (
                    <ul className="mt-2.5 space-y-2">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border bg-muted/30 p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-medium">
                              <Send className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                              {OUTREACH_KIND_LABELS[m.kind]} · {m.channel}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                m.status === "sent"
                                  ? "bg-status-applied text-status-applied-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {m.status === "sent"
                                ? `Sent ${m.sentAt ?? ""}`.trim()
                                : "Draft"}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-3 text-xs whitespace-pre-line text-muted-foreground">
                            {m.sentBody ?? m.draftBody}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

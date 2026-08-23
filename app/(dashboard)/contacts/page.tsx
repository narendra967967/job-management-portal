"use client";

import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { getLead } from "@/lib/mock-data";
import { useContacts } from "@/lib/mock-store";
import { CONNECTION_TYPE_LABELS } from "@/lib/types";

export default function ContactsPage() {
  const rows = useContacts()
    .map((c) => ({ contact: c, lead: getLead(c.leadId) }))
    .filter((row) => row.lead);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Contacts</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Recruiters and referrals captured across your leads.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No contacts yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ contact, lead }) => {
            const initials = contact.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("");
            return (
              <li key={contact.id}>
                <Link
                  href={`/leads/${lead!.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {contact.name}
                      </p>
                      {contact.aiParsed && (
                        <span className="inline-flex items-center gap-1 rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
                          <Sparkles className="size-2.5" aria-hidden />
                          AI
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {contact.title} · {lead!.company}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {CONNECTION_TYPE_LABELS[contact.connectionType]}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

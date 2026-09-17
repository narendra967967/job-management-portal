"use client";

import { useState } from "react";
import { Sparkles, Briefcase, Send } from "lucide-react";
import { usePeople, type Person } from "@/lib/mock-store";
import { ContactHistoryDialog } from "@/components/contacts/contact-history-dialog";
import { CONNECTION_TYPE_LABELS } from "@/lib/types";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export default function ContactsPage() {
  const people = usePeople();
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Contacts</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Recruiters and referrals, with their full history across your leads.
        </p>
      </div>

      {people.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No contacts yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {people.map((person) => (
            <li key={person.key}>
              <PersonRow person={person} onOpen={() => setOpenKey(person.key)} />
            </li>
          ))}
        </ul>
      )}

      <ContactHistoryDialog
        personKey={openKey}
        open={openKey !== null}
        onOpenChange={(o) => !o && setOpenKey(null)}
      />
    </div>
  );
}

function PersonRow({
  person,
  onOpen,
}: {
  person: Person;
  onOpen: () => void;
}) {
  const multiLead = person.leads.length > 1;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {initialsOf(person.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{person.name}</p>
          {person.aiParsed && (
            <span className="inline-flex items-center gap-1 rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
              <Sparkles className="size-2.5" aria-hidden />
              AI
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {person.title}
          {person.title && " · "}
          {person.connectionTypes
            .map((t) => CONNECTION_TYPE_LABELS[t])
            .join(", ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={
            multiLead
              ? "inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          <Briefcase className="size-3" aria-hidden />
          {person.leads.length} {person.leads.length === 1 ? "lead" : "leads"}
        </span>
        {person.messageCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Send className="size-3" aria-hidden />
            {person.messageCount}
          </span>
        )}
      </div>
    </button>
  );
}

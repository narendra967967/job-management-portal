"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, Clock, MapPin } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type JobLead,
  type LeadStatus,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | LeadStatus;
type Sort = "newest" | "oldest";

export function LeadsBrowser({ leads }: { leads: JobLead[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");

  const counts = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0,
      reviewing: 0,
      applied: 0,
      discarded: 0,
    };
    for (const l of leads) c[l.status]++;
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    let out = leads.slice();
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (remoteOnly) out = out.filter((l) => l.remote);
    out.sort((a, b) =>
      sort === "newest"
        ? b.capturedAt.localeCompare(a.capturedAt)
        : a.capturedAt.localeCompare(b.capturedAt),
    );
    return out;
  }, [leads, statusFilter, remoteOnly, sort]);

  return (
    <div className="space-y-4">
      {/* Metric row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEAD_STATUSES.map((s) => (
          <div key={s} className="rounded-xl border bg-card p-3">
            <div className="text-2xl font-medium tabular-nums">{counts[s]}</div>
            <div className="text-xs text-muted-foreground">
              {LEAD_STATUS_LABELS[s]}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All
        </Chip>
        {LEAD_STATUSES.map((s) => (
          <Chip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {LEAD_STATUS_LABELS[s]}
          </Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Chip active={remoteOnly} onClick={() => setRemoteOnly((v) => !v)}>
          Remote
        </Chip>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
          className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {sort === "newest" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No leads match these filters.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-2.5 md:hidden">
            {visible.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Contacts</th>
                  <th className="px-4 py-3 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {lead.title}
                      </Link>
                      {lead.hasDueReminder && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-status-reviewing px-2 py-0.5 text-[11px] font-medium text-status-reviewing-foreground">
                          Follow-up due
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.company}
                      <span className="text-muted-foreground/70">
                        {" · "}
                        {lead.location}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {lead.contactCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {lead.postedRelative}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LeadCard({ lead }: { lead: JobLead }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium">{lead.title}</h3>
        <StatusBadge status={lead.status} />
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {lead.company} · {lead.location}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {lead.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-ai-muted px-2 py-0.5 text-[11px] font-medium text-ai"
          >
            {tag}
          </span>
        ))}
        {lead.remote && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Remote
          </span>
        )}
        {lead.contactCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Users className="size-3" aria-hidden />
            {lead.contactCount}
          </span>
        )}
        {lead.hasDueReminder && (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-reviewing px-2 py-0.5 text-[11px] font-medium text-status-reviewing-foreground">
            <Clock className="size-3" aria-hidden />
            Follow-up due
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {lead.postedRelative}
        </span>
      </div>
    </Link>
  );
}

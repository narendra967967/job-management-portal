"use client";

// Admin → Monitoring → Sent emails: every email the app sent, whichever
// channel sent it. Follows the admin table rule (data-table kit): last 7 days
// by default with required dates, stat boxes that filter, multi-select with
// CSV export, an Action column and pagination. Filters live in the link
// (?q=&status=&channel=&kind=&from=&to=), so dashboard numbers can open it
// already filtered.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Eye, FlaskConical, Search, User } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/admin/ui/toast";
import { InfoTip } from "@/components/ui/info-tip";
import {
  BulkBar,
  DateRangeFields,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  StatBox,
  TableBox,
  TablePagination,
  dateRangeError,
  lastDays,
  tableSelectCls,
  usePagination,
  useRowSelection,
  ymd,
} from "@/components/admin/ui/data-table";
import { dateParam, pick, useInitialQuery, useQuerySync } from "@/lib/admin/url-filters";
import {
  SENT_EMAIL_KEEP_DAYS,
  SENT_EMAIL_KIND_LABELS,
  type SentEmailKind,
  type SentEmailRow,
  type SentEmailStatus,
} from "@/lib/admin/sent-emails-model";
import { cn, formatDateTime } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

const KINDS = Object.keys(SENT_EMAIL_KIND_LABELS) as SentEmailKind[];

function downloadCsv(name: string, header: string[], lines: (string | null)[][]) {
  const cell = (v: string | null) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...lines].map((l) => l.map(cell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`);
  }
}

export function SentEmailsClient({ rows, sample }: { rows: SentEmailRow[]; sample?: boolean }) {
  const router = useRouter();
  // Dates and times only render in the browser, in the viewer's own time zone.
  const mounted = useMounted();
  const sp = useInitialQuery();
  const linkRange = (() => {
    const from = dateParam(sp.get("from"));
    const to = dateParam(sp.get("to"));
    return from && to && from <= to ? { from, to } : lastDays(7);
  })();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState<"all" | SentEmailStatus>(() => pick(sp.get("status"), ["all", "sent", "failed"] as const, "all"));
  const [channel, setChannel] = useState(sp.get("channel") || "all");
  const [kind, setKind] = useState<"all" | SentEmailKind>(() => pick(sp.get("kind"), ["all", ...KINDS], "all"));
  const [fromInput, setFromInput] = useState(linkRange.from);
  const [toInput, setToInput] = useState(linkRange.to);
  const [range, setRange] = useState(linkRange);
  const [details, setDetails] = useState<SentEmailRow | null>(null);
  const rangeError = dateRangeError(fromInput, toInput);

  useEffect(() => {
    if (!rangeError) setRange({ from: fromInput, to: toInput });
  }, [fromInput, toInput, rangeError]);

  useQuerySync(
    { q: query.trim(), status, channel, kind, from: range.from, to: range.to },
    { status: "all", channel: "all", kind: "all" },
  );

  // Everything in the dates: the stat boxes count from this.
  const inRange = useMemo(
    () =>
      rows.filter((r) => {
        const d = ymd(new Date(r.sentAt));
        return d >= range.from && d <= range.to;
      }),
    [rows, range],
  );
  const channels = useMemo(() => [...new Set(rows.map((r) => r.channel))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inRange.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (channel !== "all" && r.channel !== channel) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (!needle) return true;
      return [r.to, r.userName, r.subject, r.label].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [inRange, query, status, channel, kind]);

  const selection = useRowSelection(filtered.map((r) => r.id));
  const paging = usePagination(filtered, `${query}|${status}|${channel}|${kind}|${range.from}|${range.to}`);
  const count = (f: (r: SentEmailRow) => boolean) => String(inRange.filter(f).length);

  function exportSelected() {
    const chosen = rows.filter((r) => selection.isSelected(r.id));
    downloadCsv(
      `sent-emails-${range.from}-to-${range.to}.csv`,
      ["Sent", "To", "Name", "Email", "Subject", "Kind", "Channel", "Status", "Error", "Message ID"],
      chosen.map((r) => [r.sentAt, r.to, r.userName, r.label, r.subject, SENT_EMAIL_KIND_LABELS[r.kind], r.channel, r.status, r.error, r.messageId]),
    );
  }

  return (
    <div className="space-y-4">
      {sample && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <FlaskConical className="size-4 shrink-0 text-primary" aria-hidden />
          Sample data. The real log starts recording in a later phase.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Address, name or subject"
            aria-label="Search sent emails"
            className="h-9 pl-8"
          />
        </div>
        <select aria-label="Status" className={tableSelectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select aria-label="Kind of email" className={tableSelectCls} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {SENT_EMAIL_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select aria-label="Channel" className={tableSelectCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">All channels</option>
          {channel !== "all" && !channels.includes(channel) && <option value={channel}>{channel}</option>}
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <DateRangeFields from={fromInput} to={toInput} onFrom={setFromInput} onTo={setToInput} error={rangeError} />
        <InfoTip label="How long sent emails are kept">
          Each email is kept for {SENT_EMAIL_KEEP_DAYS} days by default (Settings → Data retention). Only who it went to, which
          email, the channel and the result are kept, never the email&apos;s content.
        </InfoTip>
      </div>
      {rangeError && <p className="-mt-2 text-xs text-destructive">{rangeError}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Sent" value={count((r) => r.status === "sent")} active={status === "sent"} onClick={() => setStatus(status === "sent" ? "all" : "sent")} />
        <StatBox label="Failed" value={count((r) => r.status === "failed")} active={status === "failed"} onClick={() => setStatus(status === "failed" ? "all" : "failed")} />
        {channels.slice(0, 2).map((c) => (
          <StatBox key={c} label={`Via ${c}`} value={count((r) => r.channel === c)} active={channel === c} onClick={() => setChannel(channel === c ? "all" : c)} />
        ))}
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" onClick={exportSelected}>
          <Download className="size-4" /> Export CSV
        </Button>
      </BulkBar>

      <TableBox minWidth={1000}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-4 py-2.5 font-medium">Sent</th>
            <th className="px-4 py-2.5 font-medium">To</th>
            <th className="px-4 py-2.5 font-medium">Email</th>
            <th className="px-4 py-2.5 font-medium">Channel</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {paging.paged.map((r) => (
            <tr key={r.id} className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selection.isSelected(r.id) && "bg-primary/5")}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={r.id} label={`${r.label} to ${r.to}`} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{mounted ? formatDateTime(r.sentAt) : ""}</td>
              <td className="max-w-[15rem] px-4 py-2.5">
                <span className="block truncate">{r.userName || "–"}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.to}</span>
              </td>
              <td className="max-w-[18rem] px-4 py-2.5">
                <span className="block truncate">{r.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{SENT_EMAIL_KIND_LABELS[r.kind]}</span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.channel}</td>
              <td className="w-[16rem] min-w-[14rem] px-4 py-2.5">
                <Badge variant={r.status === "sent" ? "success" : "danger"}>{r.status === "sent" ? "Sent" : "Failed"}</Badge>
                {r.error && (
                  <span className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={r.error}>
                    {r.error}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                <RowActions label={`${r.label} to ${r.to}`}>
                  <DropdownMenuItem onClick={() => setDetails(r)}>
                    <Eye /> View details
                  </DropdownMenuItem>
                  {r.userId && (
                    <DropdownMenuItem onClick={() => router.push(`/jmp-admin/users?q=${encodeURIComponent(r.to)}`)}>
                      <User /> View user
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => copyText(r.to, "Address")}>
                    <Copy /> Copy address
                  </DropdownMenuItem>
                </RowActions>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No emails match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>
      <TablePagination paging={paging} />

      <Dialog open={details !== null} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{details?.label}</DialogTitle>
          </DialogHeader>
          {details && (
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Sent</dt>
              <dd>{formatDateTime(details.sentAt)}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd className="break-all">
                {details.userName ? `${details.userName}, ` : ""}
                {details.to}
              </dd>
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{details.subject}</dd>
              <dt className="text-muted-foreground">Kind</dt>
              <dd>{SENT_EMAIL_KIND_LABELS[details.kind]}</dd>
              <dt className="text-muted-foreground">Channel</dt>
              <dd>{details.channel}</dd>
              <dt className="text-muted-foreground">Result</dt>
              <dd>
                <Badge variant={details.status === "sent" ? "success" : "danger"}>{details.status === "sent" ? "Sent" : "Failed"}</Badge>
                {details.error && <p className="mt-1 text-muted-foreground">{details.error}</p>}
              </dd>
              {details.messageId && (
                <>
                  <dt className="text-muted-foreground">Message ID</dt>
                  <dd className="flex items-start gap-1">
                    <span className="min-w-0 font-mono text-xs break-all">{details.messageId}</span>
                    <Button variant="ghost" size="icon" aria-label="Copy message ID" onClick={() => copyText(details.messageId!, "Message ID")}>
                      <Copy className="size-4" aria-hidden />
                    </Button>
                  </dd>
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

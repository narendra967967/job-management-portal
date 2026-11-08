"use client";

// Admin → Renewals. Two tables:
// - Upcoming: plans and free trials ending soon, and users whose plan ended
//   recently (limited mode), with how far their reminder emails have got.
// - Reminders sent: the reminder email log (date range required, last 7 days
//   by default).
// Both follow the admin table rule (data-table kit): multi-select, Action
// column, pagination, filters, stat boxes that filter.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Mail, Search, User } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { toast } from "@/components/admin/ui/toast";
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu";
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
} from "@/components/admin/ui/data-table";
import {
  listReminderLogAction,
  listRenewalsAction,
  type ReminderLogRow,
  type RenewalRow,
} from "@/actions/admin-renewals";
import { cn, formatDateTime } from "@/lib/utils";

const DAY_MS = 86_400_000;

type Tab = "upcoming" | "reminders";
type Window = "7" | "30" | "90" | "ended";
type Kind = "all" | "paid" | "trial";

const WINDOW_LABELS: Record<Window, string> = {
  "7": "Ending in 7 days",
  "30": "Ending in 30 days",
  "90": "Ending in 90 days",
  ended: "Ended in the last 90 days",
};

const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "in 3 days", "today", "2 days ago" (whole days, viewer's clock). */
function relative(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "within a day";
  const ago = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  return ago < 1 ? "today" : ago === 1 ? "1 day ago" : `${ago} days ago`;
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name: string, header: string[], lines: (string | number | null | undefined)[][]) {
  const body = [header, ...lines].map((l) => l.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`);
  }
}

export function RenewalsClient() {
  const [tab, setTab] = useState<Tab>("upcoming");
  // "See reminders" on an Upcoming row opens the log searched for that user.
  const [logQuery, setLogQuery] = useState("");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div role="tablist" aria-label="Renewals" className="inline-flex rounded-xl bg-muted/70 p-1">
        {(
          [
            ["upcoming", "Upcoming"],
            ["reminders", "Reminders sent"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 rounded-lg px-4 text-sm font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "upcoming" ? (
        <Upcoming
          onSeeReminders={(email) => {
            setLogQuery(email);
            setTab("reminders");
          }}
        />
      ) : (
        <ReminderLog initialQuery={logQuery} />
      )}
    </div>
  );
}

/* ---------------- Upcoming ---------------- */

function Upcoming({ onSeeReminders }: { onSeeReminders: (email: string) => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [capped, setCapped] = useState(false);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [kind, setKind] = useState<Kind>("all");
  const [win, setWin] = useState<Window>("7");

  useEffect(() => {
    listRenewalsAction().then((res) => {
      setRows(res.rows);
      setCapped(res.capped);
      setLoaded(true);
    });
  }, []);

  const inWindow = (r: RenewalRow, w: Window) => {
    const left = new Date(r.expiresAt).getTime() - Date.now();
    return w === "ended" ? left <= 0 : left > 0 && left <= Number(w) * DAY_MS;
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!inWindow(r, win)) return false;
      if (plan !== "all" && r.planName !== plan) return false;
      if (kind === "trial" && !r.trial) return false;
      if (kind === "paid" && r.trial) return false;
      return !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);
    });
    // Ended: most recent first. Upcoming: soonest first.
    return win === "ended" ? list.reverse() : list;
  }, [rows, query, plan, kind, win]);

  const selection = useRowSelection(filtered.map((r) => r.userId));
  const paging = usePagination(filtered, `${query}|${plan}|${kind}|${win}`);
  const plans = useMemo(() => [...new Set(rows.map((r) => r.planName))].sort(), [rows]);

  const count = (w: Window, k: Kind = "all") =>
    rows.filter((r) => inWindow(r, w) && (k === "all" || (k === "trial") === r.trial)).length;
  const stats: { label: string; w: Window; k: Kind }[] = [
    { label: "Ending in 7 days", w: "7", k: "all" },
    { label: "Trials ending in 7 days", w: "7", k: "trial" },
    { label: "Ending in 30 days", w: "30", k: "all" },
    { label: "Ended, in limited mode", w: "ended", k: "all" },
  ];

  function exportSelected() {
    const chosen = rows.filter((r) => selection.isSelected(r.userId));
    downloadCsv(
      "renewals.csv",
      ["Name", "Email", "Plan", "Free trial", "Ends", "Reminders sent", "Reminders failed", "Last reminder"],
      chosen.map((r) => [r.name, r.email, r.planName, r.trial ? "Yes" : "No", r.expiresAt, r.remindersSent, r.remindersFailed, r.lastReminderAt]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" aria-label="Search users" className="h-9 pl-8" />
        </div>
        <select aria-label="When" className={tableSelectCls} value={win} onChange={(e) => setWin(e.target.value as Window)}>
          {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
            <option key={w} value={w}>
              {WINDOW_LABELS[w]}
            </option>
          ))}
        </select>
        <select aria-label="Plan type" className={tableSelectCls} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="all">Paid plans and trials</option>
          <option value="paid">Paid plans</option>
          <option value="trial">Free trials</option>
        </select>
        <select aria-label="Plan" className={tableSelectCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">All plans</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {capped && <p className="-mt-2 text-xs text-muted-foreground">Showing the first 5,000 users. Use the search to find others.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const active = win === s.w && kind === s.k;
          return (
            <StatBox
              key={s.label}
              label={s.label}
              value={loaded ? String(count(s.w, s.k)) : "–"}
              active={active}
              onClick={() => {
                if (active) {
                  setWin("7");
                  setKind("all");
                } else {
                  setWin(s.w);
                  setKind(s.k);
                }
              }}
            />
          );
        })}
      </div>

      <BulkBar selection={selection}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(rows.filter((r) => selection.isSelected(r.userId)).map((r) => r.email).join(", "), "Emails")}
        >
          <Copy className="size-4" /> Copy emails
        </Button>
        <Button variant="outline" size="sm" onClick={exportSelected}>
          <Download className="size-4" /> Export CSV
        </Button>
      </BulkBar>

      <TableBox minWidth={820}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-4 py-2.5 font-medium">User</th>
            <th className="px-4 py-2.5 font-medium">Plan</th>
            <th className="px-4 py-2.5 font-medium">{win === "ended" ? "Ended" : "Ends"}</th>
            <th className="px-4 py-2.5 font-medium">Reminders</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {paging.paged.map((r) => (
            <tr
              key={r.userId}
              className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selection.isSelected(r.userId) && "bg-primary/5")}
            >
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={r.userId} label={r.email} />
              </td>
              <td className="max-w-[16rem] px-4 py-2.5">
                <span className="block truncate">{r.name || "–"}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                {r.status === "inactive" && (
                  <Badge variant="neutral" className="mt-1">
                    Deactivated
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="block">{r.planName}</span>
                {r.trial && <span className="block text-xs text-muted-foreground">Free trial</span>}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className="block">{dateOnly(r.expiresAt)}</span>
                <span className={cn("block text-xs", win === "ended" ? "text-destructive" : "text-muted-foreground")}>
                  {relative(r.expiresAt)}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <span className="block tabular-nums">{r.remindersSent} of 7 sent</span>
                {r.remindersFailed > 0 && <span className="block text-xs text-destructive">{r.remindersFailed} failed</span>}
                {r.lastReminderAt && <span className="block text-xs text-muted-foreground">Last {formatDateTime(r.lastReminderAt)}</span>}
              </td>
              <td className="px-4 py-2 text-right">
                <RowActions label={r.email}>
                  <DropdownMenuItem onClick={() => router.push(`/jmp-admin/users?q=${encodeURIComponent(r.email)}`)}>
                    <User /> View user
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSeeReminders(r.email)}>
                    <Mail /> See reminders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyText(r.email, "Email")}>
                    <Copy /> Copy email
                  </DropdownMenuItem>
                </RowActions>
              </td>
            </tr>
          ))}
          {loaded && filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {win === "ended" ? "No plans ended in the last 90 days." : "No plans end in this window."}
              </td>
            </tr>
          )}
          {!loaded && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>
      <TablePagination paging={paging} />
    </div>
  );
}

/* ---------------- Reminders sent ---------------- */

function ReminderLog({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<ReminderLogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [capped, setCapped] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<"all" | "sent" | "failed">("all");
  const [fromInput, setFromInput] = useState(() => lastDays(7).from);
  const [toInput, setToInput] = useState(() => lastDays(7).to);
  const [range, setRange] = useState(() => lastDays(7));
  const rangeError = dateRangeError(fromInput, toInput);

  useEffect(() => {
    if (!rangeError) setRange({ from: fromInput, to: toInput });
  }, [fromInput, toInput, rangeError]);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    const from = new Date(`${range.from}T00:00:00`);
    const to = new Date(`${range.to}T23:59:59.999`);
    listReminderLogAction({ from: from.toISOString(), to: to.toISOString() }).then((res) => {
      if (!live) return;
      setRows(res.rows);
      setCapped(res.capped);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [range]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      return !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);
    });
  }, [rows, query, status]);

  const selection = useRowSelection(filtered.map((r) => r.id));
  const paging = usePagination(filtered, `${query}|${status}|${range.from}|${range.to}`);
  const users = new Set(rows.map((r) => r.userId)).size;

  function exportSelected() {
    const chosen = rows.filter((r) => selection.isSelected(r.id));
    downloadCsv(
      `plan-reminders-${range.from}-to-${range.to}.csv`,
      ["Sent", "Name", "Email", "Plan", "Days before end", "Plan ends", "Suggested plan", "Status", "Error"],
      chosen.map((r) => [r.sentAt, r.name, r.email, r.planName, r.daysBefore, r.expiresAt, r.upsellName, r.status, r.error]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" aria-label="Search reminders" className="h-9 pl-8" />
        </div>
        <select aria-label="Status" className={tableSelectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <DateRangeFields from={fromInput} to={toInput} onFrom={setFromInput} onTo={setToInput} error={rangeError} />
      </div>
      {rangeError && <p className="-mt-2 text-xs text-destructive">{rangeError}</p>}
      {capped && <p className="-mt-2 text-xs text-muted-foreground">Showing the newest 5,000 emails in this range. Narrow the dates to see the rest.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatBox
          label="Sent"
          value={loaded ? String(rows.filter((r) => r.status === "sent").length) : "–"}
          active={status === "sent"}
          onClick={() => setStatus(status === "sent" ? "all" : "sent")}
        />
        <StatBox
          label="Failed"
          value={loaded ? String(rows.filter((r) => r.status === "failed").length) : "–"}
          active={status === "failed"}
          onClick={() => setStatus(status === "failed" ? "all" : "failed")}
        />
        <StatBox
          label="Users reminded"
          value={loaded ? String(users) : "–"}
          active={status === "all" && !query}
          onClick={() => {
            setStatus("all");
            setQuery("");
          }}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" onClick={exportSelected}>
          <Download className="size-4" /> Export CSV
        </Button>
      </BulkBar>

      <TableBox minWidth={860}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-4 py-2.5 font-medium">Sent</th>
            <th className="px-4 py-2.5 font-medium">User</th>
            <th className="px-4 py-2.5 font-medium">Plan</th>
            <th className="px-4 py-2.5 font-medium">Reminder</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {paging.paged.map((r) => (
            <tr key={r.id} className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selection.isSelected(r.id) && "bg-primary/5")}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={r.id} label={`${r.email}, ${r.daysBefore} days before`} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.sentAt)}</td>
              <td className="max-w-[16rem] px-4 py-2.5">
                <span className="block truncate">{r.name || "–"}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
              </td>
              <td className="px-4 py-2.5">
                <span className="block">{r.planName}</span>
                <span className="block text-xs text-muted-foreground">Ends {dateOnly(r.expiresAt)}</span>
              </td>
              <td className="px-4 py-2.5">
                <span className="block whitespace-nowrap">
                  {r.daysBefore === 1 ? "1 day before" : `${r.daysBefore} days before`}
                </span>
                {r.upsellName && <span className="block text-xs text-muted-foreground">Suggested {r.upsellName}</span>}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={r.status === "sent" ? "success" : "danger"}>{r.status === "sent" ? "Sent" : "Failed"}</Badge>
                {r.error && <span className="mt-1 block text-xs text-muted-foreground">{r.error}</span>}
              </td>
              <td className="px-4 py-2 text-right">
                <RowActions label={r.email}>
                  <DropdownMenuItem onClick={() => router.push(`/jmp-admin/users?q=${encodeURIComponent(r.email)}`)}>
                    <User /> View user
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyText(r.email, "Email")}>
                    <Copy /> Copy email
                  </DropdownMenuItem>
                </RowActions>
              </td>
            </tr>
          ))}
          {loaded && filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No reminder emails in these dates.
              </td>
            </tr>
          )}
          {!loaded && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>
      <TablePagination paging={paging} />
    </div>
  );
}

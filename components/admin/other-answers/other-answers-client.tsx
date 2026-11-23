"use client";

// Admin → Customers → Other answers. What users typed after picking "Other",
// one row per value (case and spacing ignored), most common first. Admins mark
// each value Added to the list or Not adding; New is the default. Follows the
// admin table rule (data-table kit): multi-select, Action column, pagination,
// filters, stat boxes that filter. No date window: it's a running tally, not a log.

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { toast } from "@/components/admin/ui/toast";
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu";
import {
  BulkBar,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  StatBox,
  TableBox,
  TablePagination,
  tableSelectCls,
  usePagination,
  useRowSelection,
} from "@/components/admin/ui/data-table";
import { listOtherAnswersAction, markOtherAnswersAction, type OtherAnswerRow } from "@/actions/admin-other-answers";
import { OTHER_FIELDS, OTHER_FIELD_KEYS, OTHER_STATUS_LABELS, type OtherField, type OtherStatus } from "@/lib/other-answers-model";
import { cn } from "@/lib/utils";
import { pick, useInitialQuery, useQuerySync } from "@/lib/admin/url-filters";

type StatusFilter = "all" | OtherStatus;

const rowId = (r: Pick<OtherAnswerRow, "field" | "key">) => `${r.field}|${r.key}`;

const dateOnly = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATUS_BADGE: Record<OtherStatus, "neutral" | "success" | "warning"> = { new: "warning", added: "success", not_adding: "neutral" };

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: OtherAnswerRow[]) {
  const lines = [
    ["Field", "Answer", "Times given", "Users", "First seen", "Last seen", "Status"],
    ...rows.map((r) => [OTHER_FIELDS[r.field].label, r.value, r.answers, r.users, r.firstAt.slice(0, 10), r.lastAt.slice(0, 10), OTHER_STATUS_LABELS[r.status]]),
  ];
  const url = URL.createObjectURL(new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "other-answers.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function OtherAnswersClient() {
  const [rows, setRows] = useState<OtherAnswerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // ?q=&field=&status= (bookmarks)
  const sp = useInitialQuery();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [field, setField] = useState<"all" | OtherField>(() => pick(sp.get("field"), ["all", ...OTHER_FIELD_KEYS] as const, "all"));
  const [status, setStatus] = useState<StatusFilter>(() => pick(sp.get("status"), ["all", "new", "added", "not_adding"] as const, "all"));
  useQuerySync({ q: query.trim(), field, status }, { field: "all", status: "all" });

  const load = () =>
    listOtherAnswersAction().then((r) => {
      setRows(r);
      setLoaded(true);
    });
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (r) => (field === "all" || r.field === field) && (status === "all" || r.status === status) && (!needle || r.key.includes(needle)),
    );
  }, [rows, query, field, status]);

  const selection = useRowSelection(filtered.map(rowId));
  const paging = usePagination(filtered, `${query}|${field}|${status}`);

  const inField = rows.filter((r) => field === "all" || r.field === field);
  const count = (s: OtherStatus) => inField.filter((r) => r.status === s).length;
  const stats: { label: string; s: OtherStatus }[] = [
    { label: "New", s: "new" },
    { label: "Added to the list", s: "added" },
    { label: "Not adding", s: "not_adding" },
  ];

  async function mark(items: OtherAnswerRow[], to: OtherStatus) {
    if (!items.length) return;
    setBusy(true);
    const r = await markOtherAnswersAction({ items: items.map((i) => ({ field: i.field, key: i.key })), status: to });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const ids = new Set(items.map(rowId));
    const now = new Date().toISOString();
    setRows((all) => all.map((x) => (ids.has(rowId(x)) ? { ...x, status: to, reviewedAt: to === "new" ? null : now } : x)));
    selection.clear();
    toast.success(`${r.count === 1 ? items[0].value : `${r.count} answers`}: ${OTHER_STATUS_LABELS[to]}`);
  }

  const chosen = () => rows.filter((r) => selection.isSelected(rowId(r)));

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Answer copied");
    } catch {
      toast.error("Couldn't copy the answer");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search answers" aria-label="Search answers" className="h-9 pl-8" />
        </div>
        <select aria-label="Field" className={tableSelectCls} value={field} onChange={(e) => setField(e.target.value as "all" | OtherField)}>
          <option value="all">All fields</option>
          {OTHER_FIELD_KEYS.map((k) => (
            <option key={k} value={k}>
              {OTHER_FIELDS[k].label}
            </option>
          ))}
        </select>
        <select aria-label="Status" className={tableSelectCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Any status</option>
          {(Object.keys(OTHER_STATUS_LABELS) as OtherStatus[]).map((s) => (
            <option key={s} value={s}>
              {OTHER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => {
          const active = status === s.s;
          return (
            <StatBox
              key={s.s}
              label={s.label}
              value={loaded ? String(count(s.s)) : "–"}
              active={active}
              onClick={() => setStatus(active ? "all" : s.s)}
            />
          );
        })}
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(chosen(), "added")}>
          <Check className="size-4" /> Added to the list
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(chosen(), "not_adding")}>
          <X className="size-4" /> Not adding
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(chosen(), "new")}>
          <RotateCcw className="size-4" /> Back to New
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(chosen())}>
          <Download className="size-4" /> Export CSV
        </Button>
      </BulkBar>

      <TableBox minWidth={760}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-4 py-2.5 font-medium">Answer</th>
            <th className="px-4 py-2.5 font-medium">Given</th>
            <th className="px-4 py-2.5 font-medium">Seen</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {paging.paged.map((r) => (
            <tr
              key={rowId(r)}
              className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selection.isSelected(rowId(r)) && "bg-primary/5")}
            >
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={rowId(r)} label={r.value} />
              </td>
              <td className="max-w-[18rem] px-4 py-2.5">
                <span className="block truncate font-medium">{r.value}</span>
                <span className="block truncate text-xs text-muted-foreground">{OTHER_FIELDS[r.field].label}</span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className="block tabular-nums">{r.answers === 1 ? "1 time" : `${r.answers} times`}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">{r.users === 1 ? "1 user" : `${r.users} users`}</span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className="block">Last {dateOnly(r.lastAt)}</span>
                <span className="block text-xs text-muted-foreground">First {dateOnly(r.firstAt)}</span>
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={STATUS_BADGE[r.status]}>{OTHER_STATUS_LABELS[r.status]}</Badge>
                {r.reviewedAt && <span className="mt-1 block text-xs text-muted-foreground">{dateOnly(r.reviewedAt)}</span>}
              </td>
              <td className="px-4 py-2 text-right">
                <RowActions label={r.value}>
                  {r.status !== "added" && (
                    <DropdownMenuItem disabled={busy} onClick={() => mark([r], "added")}>
                      <Check /> Added to the list
                    </DropdownMenuItem>
                  )}
                  {r.status !== "not_adding" && (
                    <DropdownMenuItem disabled={busy} onClick={() => mark([r], "not_adding")}>
                      <X /> Not adding
                    </DropdownMenuItem>
                  )}
                  {r.status !== "new" && (
                    <DropdownMenuItem disabled={busy} onClick={() => mark([r], "new")}>
                      <RotateCcw /> Back to New
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => copy(r.value)}>
                    <Copy /> Copy answer
                  </DropdownMenuItem>
                </RowActions>
              </td>
            </tr>
          ))}
          {loaded && filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? "No one has picked Other yet." : "No answers match these filters."}
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

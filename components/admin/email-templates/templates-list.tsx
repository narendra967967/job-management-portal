"use client";

// Email templates: every email the system sends on its own, as a table. Not an
// activity log, so no date range. Open one to edit its wording.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Mail, Pencil, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/admin/ui/toast";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/admin/ui/dropdown-menu";
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
import { TemplatePreview } from "@/components/admin/email-templates/template-preview";
import { resetEmailTemplatesAction, sendEmailTemplateTestAction } from "@/actions/admin-email-templates";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_GROUPS,
  type EmailTemplateGroup,
  type TemplateRow,
  type TemplateState,
} from "@/lib/email-templates-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

/** PHASE 2: until the senders read these templates, say that saved wording isn't live yet. */
export function PendingBanner() {
  return (
    <p className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      Emails still go out with their built-in wording for now. What you save here is kept and takes over once the
      switch-over is finished.
    </p>
  );
}

export function WordingBadge({ edited }: { edited: boolean }) {
  return <Badge variant={edited ? "warning" : "neutral"}>{edited ? "Edited" : "Default"}</Badge>;
}

/** Emails a test copy to the signed-in admin, with sample values filled in. */
export async function sendTest(key: string, input?: Parameters<typeof sendEmailTemplateTestAction>[1]) {
  const res = await sendEmailTemplateTestAction(key, input);
  if (res.ok) toast.success(`Test sent to ${res.to}`);
  else toast.error(res.error);
}

export function TemplatesList({ appName, states }: { appName: string; states: TemplateState[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const rows: TemplateRow[] = useMemo(() => {
    const byKey = new Map(states.map((s) => [s.key, s]));
    return EMAIL_TEMPLATES.flatMap((def) => {
      const s = byKey.get(def.key);
      return s ? [{ ...s, def }] : [];
    });
  }, [states]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<EmailTemplateGroup | "all">("all");
  const [wording, setWording] = useState<"all" | "edited" | "default">("all");
  const [preview, setPreview] = useState<TemplateRow | null>(null);
  const [resetting, setResetting] = useState<TemplateRow[] | null>(null);

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter((r) => group === "all" || r.def.group === group)
      .filter((r) => wording === "all" || (wording === "edited" ? r.edited : !r.edited))
      .filter((r) => {
        const hay = `${r.def.name} ${r.def.trigger} ${r.content.subject}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
  }, [rows, query, group, wording]);

  const selection = useRowSelection(list.map((r) => r.def.key));
  const paging = usePagination(list, `${query}|${group}|${wording}`);
  const chosenEdited = list.filter((r) => selection.isSelected(r.def.key) && r.edited);
  const edited = rows.filter((r) => r.edited).length;
  const href = (r: TemplateRow) => `/jmp-admin/email-templates/${r.def.key}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PendingBanner />

      <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
        <StatBox
          label="Edited"
          value={String(edited)}
          active={wording === "edited"}
          onClick={() => setWording(wording === "edited" ? "all" : "edited")}
        />
        <StatBox
          label="Using the default"
          value={String(rows.length - edited)}
          active={wording === "default"}
          onClick={() => setWording(wording === "default" ? "all" : "default")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emails…"
            aria-label="Search emails"
            className="h-11 pl-8 sm:h-9"
          />
        </div>
        <select
          className={cn(tableSelectCls, "h-11 min-w-0 flex-1 sm:h-9 sm:flex-none")}
          value={group}
          onChange={(e) => setGroup(e.target.value as EmailTemplateGroup | "all")}
          aria-label="Filter by group"
        >
          <option value="all">All groups</option>
          {EMAIL_TEMPLATE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" disabled={chosenEdited.length === 0} onClick={() => setResetting(chosenEdited)}>
          <RotateCcw className="size-4" /> Reset to default{chosenEdited.length ? ` (${chosenEdited.length})` : ""}
        </Button>
      </BulkBar>

      <TableBox minWidth={820}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">Email</th>
            <th scope="col" className="w-40 px-3 py-2.5 font-medium">Group</th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">Sent to</th>
            <th scope="col" className="w-24 px-3 py-2.5 font-medium">Wording</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Last edited</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paging.paged.map((r) => (
            <tr key={r.def.key} className={cn("hover:bg-muted/40", selection.isSelected(r.def.key) && "bg-primary/5")}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={r.def.key} label={r.def.name} />
              </td>
              <td className="min-w-[260px] px-3 py-2.5">
                <Link href={href(r)} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="line-clamp-1">{r.def.name}</span>
                </Link>
                <p className="line-clamp-1 text-xs text-muted-foreground">{r.def.trigger}</p>
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.def.group}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.def.recipient === "user" ? "The user" : "Support inbox"}</td>
              <td className="px-3 py-2.5">
                <WordingBadge edited={r.edited} />
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {!r.updatedAt ? "Never" : mounted ? [formatDateTime(r.updatedAt), r.updatedBy].filter(Boolean).join(" · ") : ""}
              </td>
              <td className="px-3 py-2 text-right">
                <RowActions label={r.def.name}>
                  <DropdownMenuItem onClick={() => router.push(href(r))}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPreview(r)}>
                    <Eye /> Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void sendTest(r.def.key)}>
                    <Mail /> Send test to me
                  </DropdownMenuItem>
                  {r.edited && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setResetting([r])}>
                        <RotateCcw /> Reset to default
                      </DropdownMenuItem>
                    </>
                  )}
                </RowActions>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No emails match.
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>

      <TablePagination paging={paging} />

      {preview && (
        <TemplatePreview
          open
          onOpenChange={(o) => !o && setPreview(null)}
          def={preview.def}
          content={preview.content}
          appName={appName}
        />
      )}
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title={resetting?.length === 1 ? `Reset “${resetting[0].def.name}” to default?` : `Reset ${resetting?.length ?? 0} emails to default?`}
        description="They go back to the built-in wording. The current wording is kept in each email's history, so you can restore it."
        confirmLabel="Reset to default"
        onConfirm={async () => {
          const res = await resetEmailTemplatesAction((resetting ?? []).map((r) => r.def.key));
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.reset === 1 ? "Back to the default wording" : `${res.reset} emails back to default`);
          selection.clear();
          router.refresh();
        }}
      />
    </div>
  );
}

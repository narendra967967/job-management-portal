"use client";

// Admin -> Users. Data-grid: search + filters, pagination, multi-select bulk
// actions, inline status toggle, subscription plan + expiry. UI-first: all state
// is local/mock; DB wiring + the payment/subscription flow come later.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  KeyRound,
  UserCheck,
  UserX,
  Eye,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Badge } from "@/components/admin/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/admin/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { PasswordField, isPasswordValid, generatePassword } from "@/components/admin/ui/password-field";
import { UserFormDialog, type UserFormValues } from "@/components/admin/users/user-form-dialog";
import { MOCK_USERS, PLAN_LABELS, type AdminUser } from "@/lib/admin/mock-users";
import { cn } from "@/lib/utils";

const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);
}
function ExpiryCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = daysUntil(iso);
  let tone = "text-foreground";
  let note = "";
  if (d < 0) {
    tone = "text-destructive font-medium";
    note = "expired";
  } else if (d <= 30) {
    tone = "text-status-reviewing-foreground font-medium";
    note = `${d}d left`;
  }
  return (
    <span className={tone}>
      {iso}
      {note && <span className="ml-1 text-[10px]">({note})</span>}
    </span>
  );
}

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const checkboxCls = "size-4 shrink-0 cursor-pointer rounded border-input accent-primary";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [query, setQuery] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fPlan, setFPlan] = useState("all");
  const [fExpiry, setFExpiry] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPw, setResetPw] = useState("");

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (fStatus !== "all" && u.status !== fStatus) return false;
      if (fPlan !== "all" && u.plan !== fPlan) return false;
      if (fExpiry !== "all") {
        const d = u.expiresAt ? daysUntil(u.expiresAt) : null;
        if (fExpiry === "none" && u.expiresAt !== null) return false;
        if (fExpiry === "expired" && !(d !== null && d < 0)) return false;
        if (fExpiry === "soon" && !(d !== null && d >= 0 && d <= 30)) return false;
      }
      return true;
    });
  }, [users, query, fStatus, fPlan, fExpiry]);

  // Reset to page 1 whenever the result set changes.
  useEffect(() => setPage(1), [query, fStatus, fPlan, fExpiry, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const filteredIds = filtered.map((u) => u.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id)) && !allSelected;
  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function setStatusFor(ids: string[], status: "active" | "inactive") {
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, status } : u)));
  }
  function toggleStatus(u: AdminUser) {
    const next = u.status === "active" ? "inactive" : "active";
    setStatusFor([u.id], next);
    say(`${u.name} ${next === "active" ? "activated" : "deactivated"}.`);
  }

  function saveUser(v: UserFormValues) {
    if (editing) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? { ...u, name: v.name, mobile: v.mobile, role: v.role, status: v.status, plan: v.plan, expiresAt: v.expiresAt }
            : u,
        ),
      );
      say(`Updated ${v.name}.`);
    } else {
      setUsers((prev) => [
        {
          id: "u_" + Math.random().toString(36).slice(2, 8),
          name: v.name, email: v.email, mobile: v.mobile, role: v.role,
          status: v.status, plan: v.plan, expiresAt: v.expiresAt,
          createdAt: today(), lastActive: "just now", leads: 0,
        },
        ...prev,
      ]);
      say(`Added ${v.name}.`);
    }
  }

  const selCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Filter / search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…" className="h-9 pl-8" />
        </div>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className={selectCls} value={fPlan} onChange={(e) => setFPlan(e.target.value)} aria-label="Filter plan">
          <option value="all">All plans</option>
          {Object.entries(PLAN_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className={selectCls} value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} aria-label="Filter expiry">
          <option value="all">Any expiry</option>
          <option value="soon">Expiring ≤30d</option>
          <option value="expired">Expired</option>
          <option value="none">No expiry</option>
        </select>
        <Button className="ml-auto gap-1.5" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden />
          Add user
        </Button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-lg border border-status-applied-foreground/25 bg-status-applied px-3 py-2 text-sm text-status-applied-foreground">
          <Check className="size-4" aria-hidden />
          {flash}
        </div>
      )}

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selCount} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setStatusFor([...selected], "active"); say(`Activated ${selCount} user(s).`); clearSelection(); }}>
              <UserCheck className="size-4" /> Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setStatusFor([...selected], "inactive"); say(`Deactivated ${selCount} user(s).`); clearSelection(); }}>
              <UserX className="size-4" /> Deactivate
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2.5">
                <input ref={headerRef} type="checkbox" className={checkboxCls} checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Plan</th>
              <th className="px-4 py-2.5 font-medium">Expires</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Leads</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last active</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {paged.map((u) => (
              <tr key={u.id} className={cn("border-b border-border last:border-0 hover:bg-muted/40", selected.has(u.id) && "bg-primary/5")}>
                <td className="px-3 py-3">
                  <input type="checkbox" className={checkboxCls} checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Select ${u.name}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(u.name)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.name}
                        {u.role === "admin" && <span className="ml-1.5 text-[10px] text-primary">· admin</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => toggleStatus(u)} title="Click to toggle" className="cursor-pointer">
                    <Badge variant={u.status === "active" ? "success" : "neutral"}>
                      {u.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{PLAN_LABELS[u.plan]}</td>
                <td className="px-4 py-3 text-xs"><ExpiryCell iso={u.expiresAt} /></td>
                <td className="hidden px-4 py-3 tabular-nums md:table-cell">{u.leads}</td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{u.lastActive}</td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Actions for ${u.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { setEditing(u); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setResetTarget(u); setResetPw(""); }}><KeyRound /> Reset password</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(u)}>
                        {u.status === "active" ? (<><UserX /> Deactivate</>) : (<><UserCheck /> Activate</>)}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => say(`Opened ${u.name}'s dashboard as user (mock).`)}><Eye /> View as user</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={() => setDeleteTarget(u)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No users match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
          </span>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Rows
            <select className={selectCls + " h-8"} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option>10</option><option>25</option><option>50</option>
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /> Prev</Button>
            <span className="text-muted-foreground">Page {current} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>Next <ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}

      {/* Add / Edit */}
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} onSave={saveUser} />

      {/* Single delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "user"}?`}
        description="Permanently removes the account and all of their data. This can't be undone — consider deactivating instead."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => { if (deleteTarget) { setUsers((p) => p.filter((x) => x.id !== deleteTarget.id)); say(`Deleted ${deleteTarget.name}.`); } }}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selCount} user(s)?`}
        description="Permanently removes the selected accounts and all of their data. This can't be undone."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => { setUsers((p) => p.filter((x) => !selected.has(x.id))); say(`Deleted ${selCount} user(s).`); clearSelection(); }}
      />

      {/* Reset password */}
      <Dialog open={resetTarget !== null} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>For {resetTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <div className="flex items-start gap-2">
              <PasswordField
                className="flex-1 min-w-0"
                value={resetPw}
                onChange={setResetPw}
                placeholder="Create a strong password"
              />
              <Button variant="outline" className="shrink-0" onClick={() => setResetPw(generatePassword())}>Generate</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button disabled={!isPasswordValid(resetPw)} onClick={() => { say(`Password reset for ${resetTarget?.name}.`); setResetTarget(null); }}>Set password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

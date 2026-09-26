"use client";

// Admin → Users. Full management UI (add / edit / activate-deactivate / reset
// password / delete) against mock data. UI-first: all changes are in local state;
// real DB wiring comes in the backend phase.

import { useMemo, useState } from "react";
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
import {
  UserFormDialog,
  type UserFormValues,
} from "@/components/admin/users/user-form-dialog";
import { MOCK_USERS, type AdminUser } from "@/lib/admin/mock-users";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPw, setResetPw] = useState("");

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  function saveUser(v: UserFormValues) {
    if (editing) {
      setUsers((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, name: v.name, status: v.status } : u)),
      );
      say(`Updated ${v.name}.`);
    } else {
      setUsers((prev) => [
        { id: "u_" + Math.random().toString(36).slice(2, 8), name: v.name, email: v.email, status: v.status, createdAt: today(), lastActive: "just now", leads: 0 },
        ...prev,
      ]);
      say(`Added ${v.name}.`);
    }
  }

  function toggleStatus(u: AdminUser) {
    const next = u.status === "active" ? "inactive" : "active";
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
    say(`${u.name} ${next === "active" ? "activated" : "deactivated"}.`);
  }

  function doDelete() {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    say(`Deleted ${deleteTarget.name}.`);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-9 pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} user{filtered.length === 1 ? "" : "s"}
        </span>
        <Button
          className="ml-auto gap-1.5"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Leads</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Created</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last active</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.status === "active" ? "success" : "neutral"}>
                    {u.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="hidden px-4 py-3 tabular-nums md:table-cell">{u.leads}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{u.createdAt}</td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{u.lastActive}</td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${u.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { setEditing(u); setFormOpen(true); }}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setResetTarget(u); setResetPw(""); }}>
                        <KeyRound /> Reset password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(u)}>
                        {u.status === "active" ? (
                          <>
                            <UserX /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck /> Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => say(`Opened ${u.name}'s dashboard as user (mock).`)}>
                        <Eye /> View as user
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={() => setDeleteTarget(u)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No users match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit */}
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} onSave={saveUser} />

      {/* Delete confirm (deactivate is the softer default; delete is hard + confirmed) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "user"}?`}
        description="This permanently removes the account and all of their data (leads, résumés, outreach…). This can't be undone. Consider deactivating instead."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={doDelete}
      />

      {/* Reset password */}
      <Dialog open={resetTarget !== null} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {resetTarget?.name}. They should change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Button
                variant="outline"
                onClick={() => setResetPw(Math.random().toString(36).slice(2, 10) + "A1")}
              >
                Generate
              </Button>
            </div>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={resetPw.length < 8}
              onClick={() => {
                say(`Password reset for ${resetTarget?.name}.`);
                setResetTarget(null);
              }}
            >
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

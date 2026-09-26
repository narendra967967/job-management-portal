"use client";

// Add / edit a user (admin). Email is not editable once the account exists.
// UI-first: onSave receives the values; persistence is wired later.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import type { AdminUser, AdminUserStatus } from "@/lib/admin/mock-users";

export interface UserFormValues {
  name: string;
  email: string;
  password?: string;
  status: AdminUserStatus;
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add mode, otherwise edit mode. */
  user: AdminUser | null;
  onSave: (values: UserFormValues) => void;
}) {
  const editing = !!user;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AdminUserStatus>("active");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setStatus(user?.status ?? "active");
    setPassword("");
    setError("");
  }, [open, user]);

  function save() {
    if (!name.trim()) return setError("Name is required.");
    if (!editing && !email.trim()) return setError("Email is required.");
    if (!editing && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Enter a valid email address.");
    if (!editing && password.length < 8)
      return setError("Password must be at least 8 characters.");
    onSave({ name: name.trim(), email: email.trim(), password: password || undefined, status });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this user's details. Email can't be changed."
              : "Create an admin-provisioned account. They'll sign in with this email + password."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>

          <label className="block space-y-1.5">
            <Label>Email {editing && <span className="text-muted-foreground">(locked)</span>}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={editing}
            />
          </label>

          {!editing && (
            <label className="block space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
          )}

          <label className="block space-y-1.5">
            <Label>Status</Label>
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as AdminUserStatus)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? "Save changes" : "Add user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

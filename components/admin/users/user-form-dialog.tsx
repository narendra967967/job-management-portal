"use client";

// Add / edit a user (admin). Every admin-editable field is here; email is locked
// once the account exists. UI-first: onSave receives the values; persistence and
// the payment/subscription flow are wired later.

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
import {
  PLAN_LABELS,
  ROLE_LABELS,
  type AdminUser,
  type AdminUserStatus,
  type AdminUserRole,
  type AdminPlan,
} from "@/lib/admin/mock-users";

export interface UserFormValues {
  name: string;
  email: string;
  password?: string;
  mobile: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  plan: AdminPlan;
  expiresAt: string | null;
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>
        {label} {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </label>
  );
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  onSave: (values: UserFormValues) => void;
}) {
  const editing = !!user;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<AdminUserRole>("user");
  const [status, setStatus] = useState<AdminUserStatus>("active");
  const [plan, setPlan] = useState<AdminPlan>("free");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setMobile(user?.mobile ?? "");
    setRole(user?.role ?? "user");
    setStatus(user?.status ?? "active");
    setPlan(user?.plan ?? "free");
    setExpiresAt(user?.expiresAt ?? "");
    setPassword("");
    setError("");
  }, [open, user]);

  function save() {
    if (!name.trim()) return setError("Name is required.");
    if (!editing) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
    }
    onSave({
      name: name.trim(),
      email: email.trim(),
      password: password || undefined,
      mobile: mobile.trim(),
      role,
      status,
      plan,
      expiresAt: expiresAt || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this user's details. Email can't be changed."
              : "Create an admin-provisioned account with all its details."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Mobile">
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 …" />
            </Field>
          </div>

          <Field label="Email" hint={editing ? "(locked)" : undefined}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={editing}
            />
          </Field>

          {!editing && (
            <Field label="Temporary password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role">
              <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as AdminUserRole)}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as AdminUserStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subscription plan">
              <select className={selectCls} value={plan} onChange={(e) => setPlan(e.target.value as AdminPlan)}>
                {Object.entries(PLAN_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Expiry date" hint="(blank = no expiry)">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Add user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

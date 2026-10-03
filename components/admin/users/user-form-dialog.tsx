"use client";

// Add / edit a user (admin). Every admin-editable field is here; email is locked
// once the account exists. UI-first: onSave receives the values; persistence and
// the payment/subscription flow are wired later.

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { PasswordField, isPasswordValid } from "@/components/admin/ui/password-field";
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

// Indian mobile masking. The "+91" prefix is a fixed, non-editable adornment (see
// the Mobile field) and the input state holds ONLY the national number. The +91 is
// never stored in state — it's added back only at save time — so backspacing works
// to empty and the prefix "91" can never be re-absorbed into the number.

// Keep only the national (10-digit) digits. Strips a leading 00 exit code and a +91
// country code when clearly a prefix (total > 10 digits), so a national number that
// itself starts with 91 isn't mangled (this only triggers when a full, prefixed
// number is pasted into the national field).
function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  return d.slice(0, 10);
}

// Group the national number as "##### #####".
function groupNational(raw: string): string {
  const d = nationalDigits(raw);
  const a = d.slice(0, 5);
  const b = d.slice(5, 10);
  return b ? `${a} ${b}` : a;
}

// Compose the full value to store from the national number in state ("+91 ##### #####"),
// or "" when empty so the field stays optional.
function storedMobile(national: string): string {
  const grouped = groupNational(national);
  return grouped ? `+91 ${grouped}` : "";
}

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
  const mobileRef = useRef<HTMLInputElement>(null);

  // The mask reformats on every keystroke, which resets the caret; keep it at the
  // end while editing so typing and backspacing-from-the-end stay in sync.
  useEffect(() => {
    const el = mobileRef.current;
    if (el && document.activeElement === el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [mobile]);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setMobile(groupNational(user?.mobile ?? ""));
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
      if (!isPasswordValid(password)) return setError("Password doesn't meet all the requirements below.");
    }
    onSave({
      name: name.trim(),
      email: email.trim(),
      password: password || undefined,
      mobile: storedMobile(mobile),
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
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Mobile">
              <div className="flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30">
                <span className="mr-1.5 shrink-0 select-none text-muted-foreground">+91</span>
                <input
                  ref={mobileRef}
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(groupNational(e.target.value))}
                  placeholder="----- -----"
                  className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
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
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="Create a strong password"
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

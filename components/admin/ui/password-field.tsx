"use client";

// Admin-only password field with live requirement checking. Kept separate from the
// user app's password UI (admin-isolation rule). As the user types it shows which
// rules are still missing; the border is neutral before typing, danger while the
// password is incomplete, and success once every rule is met.

import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PwRule {
  label: string;
  test: (pw: string) => boolean;
}

// The required rules. All must pass for the password to be accepted.
export const PASSWORD_RULES: PwRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "An uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "A number (0–9)", test: (p) => /\d/.test(p) },
  { label: "A special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

// Generate a random password that satisfies every rule above. Ambiguous glyphs
// (l/1/I, O/0) are left out so the temporary password is easy to read and relay.
export function generatePassword(length = 14): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digit = "23456789";
  const special = "!@#$%^&*?-_";
  const all = lower + upper + digit + special;
  const randInt = (max: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  };
  const pick = (set: string) => set[randInt(set.length)];
  // Guarantee one of each required class, then fill the rest from the full set.
  const chars = [pick(lower), pick(upper), pick(digit), pick(special)];
  while (chars.length < Math.max(length, 8)) chars.push(pick(all));
  // Fisher–Yates shuffle so the guaranteed chars aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Success (green) comes from the app's status-applied token so it swaps in dark mode.
const OK = "var(--status-applied-foreground)";

export function PasswordField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const touched = value.length > 0;
  const valid = isPasswordValid(value);

  return (
    <div className={className}>
      <div
        className={cn(
          "flex h-8 w-full min-w-0 items-center rounded-lg border bg-transparent px-2.5 text-base transition-colors focus-within:ring-3 md:text-sm dark:bg-input/30",
          !touched &&
            "border-input focus-within:border-ring focus-within:ring-ring/50",
          touched && !valid && "border-destructive focus-within:ring-destructive/40",
        )}
        style={
          touched && valid
            ? ({ borderColor: OK, "--tw-ring-color": `color-mix(in oklab, ${OK} 40%, transparent)` } as React.CSSProperties)
            : undefined
        }
      >
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={touched && !valid}
          autoComplete="new-password"
          className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="ml-1.5 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {touched && (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(value);
            return (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  ok ? "font-medium" : "text-muted-foreground",
                )}
                style={ok ? { color: OK } : undefined}
              >
                {ok ? (
                  <Check className="size-3 shrink-0" aria-hidden />
                ) : (
                  <X className="size-3 shrink-0 text-destructive" aria-hidden />
                )}
                {r.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

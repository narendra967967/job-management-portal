"use client";

import { passwordStrength } from "@/lib/validation";
import { cn } from "@/lib/utils";

const BAR_COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-status-reviewing-foreground",
  "bg-status-new-foreground",
  "bg-status-applied-foreground",
];

/** A small 4-segment strength meter + label. Hidden until the user types. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const { score, label } = passwordStrength(value);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? BAR_COLORS[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Strength: {label}</p>
    </div>
  );
}

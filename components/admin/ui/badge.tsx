import * as React from "react";
import { cn } from "@/lib/utils";

// Admin-only status badge.
const VARIANTS: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-status-applied text-status-applied-foreground",
  warning: "bg-status-reviewing text-status-reviewing-foreground",
  danger: "bg-destructive/10 text-destructive",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof VARIANTS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

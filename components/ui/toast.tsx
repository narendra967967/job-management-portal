"use client";

// App toasts, built on @base-ui/react/toast to match the rest of the UI.
//
// A single global manager (createToastManager) lets any code call
// `toast.success(...)` / `toast.error(...)` without threading a hook through the
// tree; <Toaster/> is mounted once (in the dashboard layout) and subscribes to
// it. Toasts are colour-coded by `type`: green for success, red for error.

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const toastManager = ToastPrimitive.createToastManager();

type ToastType = "success" | "error" | "info";

function show(type: ToastType, title: string, description?: string) {
  return toastManager.add({
    title,
    description,
    type,
    timeout: type === "error" ? 6000 : 4000,
    priority: type === "error" ? "high" : "low",
  });
}

/** Imperative toast API — callable from anywhere. */
export const toast = {
  success: (title: string, description?: string) =>
    show("success", title, description),
  error: (title: string, description?: string) =>
    show("error", title, description),
  info: (title: string, description?: string) =>
    show("info", title, description),
};

const TYPE_STYLE: Record<
  string,
  { icon: LucideIcon; accent: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "text-[oklch(0.58_0.14_150)]",
    bar: "bg-[oklch(0.58_0.14_150)]",
  },
  error: {
    icon: AlertCircle,
    accent: "text-destructive",
    bar: "bg-destructive",
  },
  info: { icon: Info, accent: "text-primary", bar: "bg-primary" },
};

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((t) => {
    const style = TYPE_STYLE[t.type ?? "info"] ?? TYPE_STYLE.info;
    const Icon = style.icon;
    return (
      <ToastPrimitive.Root
        key={t.id}
        toast={t}
        className={cn(
          "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border bg-popover p-3.5 pr-9 text-popover-foreground shadow-lg ring-1 ring-foreground/5 transition-all",
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
          "select-none data-[swiping]:transition-none",
        )}
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />
        <Icon className={cn("mt-0.5 size-5 shrink-0", style.accent)} aria-hidden />
        <div className="min-w-0 flex-1">
          <ToastPrimitive.Title className="text-sm font-semibold" />
          <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground" />
        </div>
        <ToastPrimitive.Close
          aria-label="Dismiss"
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  });
}

/** Mount once near the app root. Renders the toast stack (bottom-right). */
export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-2 p-4 sm:right-2 sm:bottom-2 sm:max-w-sm">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

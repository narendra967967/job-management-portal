import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { cn } from "@/lib/utils";

// A standalone glass page with one message and a couple of buttons: the 404
// page and the "can't open this invoice" page share it. No session lookups.

export interface NoticeAction {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

export function GlassNotice({
  appName,
  badge,
  title,
  message,
  actions,
}: {
  appName: string;
  /** Big line above the title: "404", or an icon. */
  badge: React.ReactNode;
  title: string;
  message: React.ReactNode;
  actions: NoticeAction[];
}) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <GlassBackdrop variant="screen" />

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit flex-col items-center gap-2 rounded-2xl">
          <span className="glass-strong flex size-14 items-center justify-center rounded-2xl">
            <Logo showName={false} name={appName} className="scale-110" />
          </span>
          <span className="text-base font-semibold tracking-tight">{appName}</span>
        </Link>

        <div className="glass-strong rounded-3xl p-6 text-center sm:p-10">
          {badge}
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {actions.map(({ href, label, icon: Icon, primary }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors",
                  primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "glass hover:bg-white/80",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

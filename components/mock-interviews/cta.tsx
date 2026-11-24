import { cn } from "@/lib/utils";

// The page's one main action (Start interview, Pay and book, New interview):
// a bold gradient button with a soft glowing halo behind it, so it stands out
// from the text around it. The halo pulses gently and holds still for anyone
// who prefers reduced motion. Use it once per screen.

export type CtaTone = "primary" | "amber";

const GRADIENT: Record<CtaTone, string> = {
  primary: "from-primary via-violet-600 to-fuchsia-600",
  amber: "from-amber-500 via-orange-500 to-rose-500",
};

/** The halo; wrap the button or link in it. `className` sizes the wrapper (e.g. w-full, shrink-0). */
export function CtaGlow({
  tone = "primary",
  pulse = true,
  className,
  children,
}: {
  tone?: CtaTone;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r opacity-50 blur-md",
          GRADIENT[tone],
          pulse && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {children}
    </span>
  );
}

/** Classes for the button or link inside CtaGlow. `lg` is 56px tall, `md` 48px. */
export function ctaClass({ tone = "primary", size = "lg", full = false }: { tone?: CtaTone; size?: "lg" | "md"; full?: boolean } = {}): string {
  return cn(
    "relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r font-semibold whitespace-nowrap text-white shadow-lg ring-1 ring-white/25 transition-transform focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-90 motion-safe:hover:-translate-y-0.5 [&_svg]:size-5 [&_svg]:shrink-0",
    GRADIENT[tone],
    tone === "amber" ? "shadow-orange-500/30" : "shadow-primary/30",
    size === "lg" ? "h-14 px-5 text-base" : "h-12 px-4 text-sm",
    full && "w-full",
  );
}

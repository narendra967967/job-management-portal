"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutGrid, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LEADS_HOME, MOCK_INTERVIEWS_HOME } from "@/lib/nav-area";
import { cn } from "@/lib/utils";

// "Not found" inside the signed-in app (a lead, report or booking that doesn't
// exist or isn't yours). It keeps the app's frame and sends people back to the
// part of the app they were in, not to the public website.

export default function DashboardNotFound() {
  const path = usePathname() ?? "";
  const inInterviews = path.startsWith("/mock-interviews");
  const back = inInterviews ? { href: MOCK_INTERVIEWS_HOME, label: "AI mock interviews" } : { href: LEADS_HOME, label: "Back to leads" };
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-2 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <SearchX className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">We can&apos;t find that page</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        It may have been removed, or the link is out of date. Everything else is right where you left it.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Link href={back.href} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
        {inInterviews && (
          <Link href={LEADS_HOME} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
            <LayoutGrid className="size-4" aria-hidden />
            Go to leads
          </Link>
        )}
      </div>
    </div>
  );
}

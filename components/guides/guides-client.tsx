"use client";

// How-to guides (user side). Same layout as Settings: a topic menu (a
// horizontal strip on phones/tablets, a side list on lg+) and the chosen guide
// beside it. The active topic lives in the URL (?topic=<slug>). Topics and
// their HTML bodies come from the DB (admin panel → Operations → How-to
// guides); only active ones are passed in, already sanitized.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import type { GuideTopic } from "@/lib/guides-model";
import { guideIcon } from "@/lib/guide-icons";
import { buttonVariants } from "@/components/ui/button";
import { useContactSupport } from "@/components/support/contact-support";
import { cn } from "@/lib/utils";

export function GuidesClient({ topics }: { topics: GuideTopic[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");
  const current = topics.find((t) => t.slug === topicParam) ?? topics[0] ?? null;

  function select(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("topic", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">How-to guides</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Step-by-step help for every part of Jobtiva.
        </p>
      </div>

      {!current ? (
        <div className="mt-5 rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Guides are on their way. Meanwhile, use <span className="font-medium text-foreground">Help &amp; support</span>{" "}
          if you get stuck.
        </div>
      ) : (
      <div className="mt-5 lg:flex lg:gap-6">
        {/* Phones / tablets: one horizontal strip (the app's own left rail
            already shows at md, so a second sidebar waits for lg). */}
        <nav aria-label="Guide topics" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
          {topics.map((t) => (
            <TopicButton key={t.id} topic={t} active={t.id === current.id} onSelect={select} />
          ))}
        </nav>

        {/* Desktop: vertical list. */}
        <nav aria-label="Guide topics" className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-1">
          {topics.map((t) => (
            <TopicButton key={t.id} topic={t} active={t.id === current.id} onSelect={select} />
          ))}
        </nav>

        <div className="mt-4 min-w-0 flex-1 lg:mt-0">
          <GuideArticle topic={current} />
        </div>
      </div>
      )}
    </div>
  );
}

function TopicButton({
  topic,
  active,
  onSelect,
}: {
  topic: GuideTopic;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = guideIcon(topic.icon);
  return (
    <button
      type="button"
      onClick={() => onSelect(topic.slug)}
      aria-current={active ? "page" : undefined}
      title={topic.summary}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:min-h-0 lg:w-full lg:whitespace-normal",
        active
          ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/10"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
      {topic.title}
    </button>
  );
}

function GuideArticle({ topic }: { topic: GuideTopic }) {
  const Icon = guideIcon(topic.icon);
  const { open: openSupport } = useContactSupport();
  return (
    <article className="rounded-2xl border bg-card p-4 md:p-6">
      <header className="flex items-start gap-3 border-b pb-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold md:text-lg">{topic.title}</h2>
            {topic.inProgress && (
              <span className="rounded-full bg-status-shortlisted px-2 py-0.5 text-[11px] font-medium text-status-shortlisted-foreground">
                Guide in progress
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{topic.summary}</p>
        </div>
      </header>

      {/* Admin-authored HTML, sanitized on save and again when loaded. */}
      {topic.contentHtml ? (
        <div className="guide-content mt-5" dangerouslySetInnerHTML={{ __html: topic.contentHtml }} />
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">This guide doesn&apos;t have any content yet.</p>
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">Still stuck? We&apos;re happy to help.</p>
        <button
          type="button"
          onClick={() =>
            openSupport({
              category: "question",
              subject: `Help with: ${topic.title}`,
              source: `guide:${topic.slug}`,
            })
          }
          className={cn(buttonVariants({ variant: "outline" }), "px-3")}
        >
          <LifeBuoy className="size-4" aria-hidden />
          Contact support
        </button>
      </footer>
    </article>
  );
}

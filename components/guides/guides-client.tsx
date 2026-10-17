"use client";

// How-to guides (user side). Same layout as Settings: a topic menu (a
// horizontal strip on phones/tablets, a grouped side list on lg+) and the chosen
// guide beside it. The active topic lives in the URL (?topic=<slug>) so guides
// can be linked to from anywhere. Topics come from the DB (managed in the admin
// panel, Operations → How-to guides); only active ones are passed in.

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Info,
  Lightbulb,
  LifeBuoy,
  PlayCircle,
} from "lucide-react";
import {
  groupGuides,
  videoEmbedUrl,
  type GuideBlock,
  type GuideTopic,
} from "@/lib/guides-model";
import { guideIcon } from "@/lib/guide-icons";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { buttonVariants } from "@/components/ui/button";
import { useContactSupport } from "@/components/support/contact-support";
import { cn } from "@/lib/utils";

export function GuidesClient({ topics }: { topics: GuideTopic[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");
  const groups = groupGuides(topics);
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

        {/* Desktop: grouped vertical list. */}
        <nav aria-label="Guide topics" className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-5">
          {groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {g.label}
              </p>
              {g.topics.map((t) => (
                <TopicButton key={t.id} topic={t} active={t.id === current.id} onSelect={select} />
              ))}
            </div>
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

      <div className="mt-5 space-y-7">
        {topic.sections.map((s, i) => (
          <section key={i} aria-labelledby={`${topic.slug}-s${i}`} className="space-y-3">
            <h3 id={`${topic.slug}-s${i}`} className="text-sm font-semibold">
              {s.heading}
            </h3>
            {s.blocks.map((b, j) => (
              <Block key={j} block={b} />
            ))}
          </section>
        ))}
      </div>

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

const CALLOUT = {
  tip: { icon: Lightbulb, cls: "border-status-applied-foreground/25 bg-status-applied text-status-applied-foreground", label: "Tip" },
  note: { icon: Info, cls: "border-status-new-foreground/25 bg-status-new text-status-new-foreground", label: "Note" },
  warning: {
    icon: AlertTriangle,
    cls: "border-status-shortlisted-foreground/25 bg-status-shortlisted text-status-shortlisted-foreground",
    label: "Important",
  },
} as const;

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "text":
      return <MarkdownLite text={block.text} className="text-sm leading-relaxed" />;

    case "steps":
      return (
        <ol className="space-y-3">
          {block.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium">{s.title}</p>
                {s.detail && <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      );

    case "callout": {
      const t = CALLOUT[block.tone];
      const Icon = t.icon;
      return (
        <div className={cn("flex gap-2.5 rounded-xl border p-3", t.cls)}>
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{block.title ?? t.label}</p>
            <MarkdownLite text={block.text} className="mt-0.5 opacity-90" />
          </div>
        </div>
      );
    }

    case "video": {
      if (!block.url) {
        return (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <PlayCircle className="size-6 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-foreground">{block.title}</span> — video coming soon.
            </span>
          </div>
        );
      }
      const embed = videoEmbedUrl(block.url);
      if (!embed) {
        return (
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "px-3")}
          >
            <PlayCircle className="size-4" aria-hidden />
            {block.title}
            <ExternalLink className="size-3.5 opacity-60" aria-hidden />
          </a>
        );
      }
      return (
        <figure>
          <div className="aspect-video overflow-hidden rounded-xl border bg-muted">
            <iframe
              src={embed}
              title={block.title}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="size-full"
            />
          </div>
          <figcaption className="mt-1.5 text-xs text-muted-foreground">
            {block.title}
            {block.duration ? ` · ${block.duration}` : ""}
          </figcaption>
        </figure>
      );
    }

    case "image":
      return (
        <figure>
          {/* Static screenshots from /public — plain <img> keeps guides simple. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            loading="lazy"
            className="w-full rounded-xl border"
          />
          {block.caption && (
            <figcaption className="mt-1.5 text-xs text-muted-foreground">{block.caption}</figcaption>
          )}
        </figure>
      );

    case "links":
      return (
        <div className="flex flex-wrap gap-2">
          {block.links.map((l) => (
            <Link key={l.href} href={l.href} className={cn(buttonVariants({ variant: "outline" }), "px-3")}>
              {l.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ))}
        </div>
      );
  }
}

"use client";

import Link from "next/link";
import {
  Circle,
  ChevronRight,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import {
  useTodos,
  completeTask,
  type TodoItem,
  type TodoNudge,
} from "@/lib/mock-store";
import { TASK_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TodoPage() {
  const groups = useTodos();
  const isEmpty = groups.openCount === 0 && groups.nudges.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">To-do</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Follow-ups and next steps across your open jobs.
        </p>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ListChecks className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium">You&apos;re all caught up</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Follow-ups you schedule and open jobs needing a decision will show up
            here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <TaskSection title="Overdue" tone="overdue" items={groups.overdue} />
          <TaskSection title="Today" items={groups.today} />
          <TaskSection title="Upcoming" items={groups.upcoming} />
          <TaskSection title="No due date" items={groups.noDate} />
          <NudgeSection nudges={groups.nudges} />
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  count,
  tone,
}: {
  title: string;
  count: number;
  tone?: "overdue";
}) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      <span className={cn(tone === "overdue" && "text-destructive")}>
        {title}
      </span>
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
        {count}
      </span>
    </h2>
  );
}

function TaskSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: TodoItem[];
  tone?: "overdue";
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} count={items.length} tone={tone} />
      <ul className="space-y-2">
        {items.map((item) => (
          <TaskRow key={item.task.id} item={item} tone={tone} />
        ))}
      </ul>
    </section>
  );
}

function TaskRow({ item, tone }: { item: TodoItem; tone?: "overdue" }) {
  const { task, lead } = item;
  return (
    <li className="group flex items-center gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        aria-label="Mark done"
        title="Mark done"
        onClick={() => completeTask(task.id)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-status-applied-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Circle className="size-5" aria-hidden />
      </button>
      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-primary">
          {task.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {lead.company} · {lead.title}
          {task.dueDate && (
            <span className={cn(tone === "overdue" && "text-destructive")}>
              {" · due "}
              {task.dueDate}
            </span>
          )}
        </p>
      </Link>
      <span className="hidden shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
        {TASK_KIND_LABELS[task.kind]}
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </li>
  );
}

function NudgeSection({ nudges }: { nudges: TodoNudge[] }) {
  if (nudges.length === 0) return null;
  return (
    <section>
      <SectionHeading title="Needs a next step" count={nudges.length} />
      <ul className="space-y-2">
        {nudges.map(({ lead, message }) => (
          <li
            key={lead.id}
            className="group flex items-center gap-2 rounded-xl border border-dashed bg-card p-3 transition-colors hover:border-primary/40"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-status-reviewing text-status-reviewing-foreground">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium group-hover:text-primary">
                {message}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {lead.company} · {lead.title}
              </p>
            </Link>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

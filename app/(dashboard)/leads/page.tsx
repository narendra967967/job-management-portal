"use client";

import { List, Columns3 } from "lucide-react";
import { LeadsBrowser } from "@/components/leads/leads-browser";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { useIsDesktop } from "@/lib/use-media-query";
import { usePersistentState, PERSIST_KEYS } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";

type View = "list" | "board";

export default function LeadsPage() {
  // Persisted across reload AND logout/login (localStorage).
  const [view, setView] = usePersistentState<View>(
    PERSIST_KEYS.leadsView,
    "list",
  );
  const isDesktop = useIsDesktop();
  // The board is a laptop-only view; on smaller screens we always show the list
  // (mobile board design comes later), and the toggle is hidden there. Gating on
  // isDesktop means exactly one of the two views is mounted at a time.
  const showBoard = view === "board" && isDesktop;

  return (
    <div className={cn("mx-auto space-y-3", showBoard ? "max-w-none" : "max-w-5xl")}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Job alerts captured from your inbox.
        </p>
        {/* View toggle — laptop only */}
        <div className="ml-auto hidden rounded-lg border bg-card p-0.5 lg:inline-flex">
          <ViewButton
            active={view === "list"}
            onClick={() => setView("list")}
            icon={<List className="size-4" aria-hidden />}
            label="List"
          />
          <ViewButton
            active={view === "board"}
            onClick={() => setView("board")}
            icon={<Columns3 className="size-4" aria-hidden />}
            label="Board"
          />
        </div>
      </div>

      {showBoard ? <LeadsKanban /> : <LeadsBrowser />}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

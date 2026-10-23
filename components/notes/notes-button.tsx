"use client";

// Top-bar notepad (#8, premium). One personal note per user, saved as rich
// text with autosave. Users whose plan doesn't include Notes see the icon with
// a lock; opening it explains the feature and offers the upgrade request.

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, NotebookPen } from "lucide-react";
import { getMyNotesAction, saveMyNotesAction } from "@/actions/notes";
import { useFeatures } from "@/lib/mock-store";
import { PremiumLockedDialog } from "@/components/premium/premium-locked-dialog";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDateTime } from "@/lib/utils";

const MAX_CHARS = 20_000; // mirrors NOTES_MAX_CHARS in lib/notes.ts
const AUTOSAVE_MS = 1200;

/** Visible-text length of editor HTML (same idea as richTextToPlain). */
function plainLength(html: string): number {
  if (typeof document === "undefined") return html.length;
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").length;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function NotesButton() {
  const { notes: hasNotes } = useFeatures();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasNotes ? "My notes" : "My notes (premium)"}
        title={hasNotes ? "My notes" : "Notes — premium feature"}
        className="relative flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:size-10"
      >
        <NotebookPen className="size-5" aria-hidden />
        {!hasNotes && (
          <span className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-border">
            <Lock className="size-2.5" aria-hidden />
          </span>
        )}
      </button>
      {open &&
        (hasNotes ? (
          <NotesDialog onClose={() => setOpen(false)} />
        ) : (
          <PremiumLockedDialog
            feature="Notes"
            description="Keep a private notepad right inside Jobtiva — interview prep, questions to ask, follow-up ideas — always one click away."
            onClose={() => setOpen(false)}
          />
        ))}
    </>
  );
}

function NotesDialog({ onClose }: { onClose: () => void }) {
  const [html, setHtml] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const latest = useRef("");
  const lastSaved = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chars = plainLength(html);
  const over = chars > MAX_CHARS;

  useEffect(() => {
    let alive = true;
    getMyNotesAction().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setHtml(res.content);
        latest.current = res.content;
        lastSaved.current = res.content;
        setSavedAt(res.updatedAt);
      } else {
        setLoadError(res.error);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const value = latest.current;
    if (value === lastSaved.current) return;
    if (plainLength(value) > MAX_CHARS) {
      setState("error");
      setSaveError(`Notes can be up to ${MAX_CHARS.toLocaleString("en-IN")} characters.`);
      return;
    }
    setState("saving");
    const res = await saveMyNotesAction(value);
    if (res.ok) {
      lastSaved.current = value;
      setSavedAt(res.updatedAt);
      setSaveError("");
      setState(latest.current === value ? "saved" : "dirty");
    } else {
      setState("error");
      setSaveError(res.error);
    }
  }, []);

  function onChange(next: string) {
    setHtml(next);
    latest.current = next;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }

  // Save anything pending when the dialog closes / unmounts.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== lastSaved.current && plainLength(latest.current) <= MAX_CHARS) {
        void saveMyNotesAction(latest.current);
      }
    };
  }, []);

  const status =
    state === "saving"
      ? "Saving…"
      : state === "dirty"
        ? "Unsaved changes"
        : state === "error"
          ? saveError || "Couldn't save"
          : savedAt
            ? `Saved · ${formatDateTime(savedAt)}`
            : "Nothing saved yet";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="size-4 text-primary" aria-hidden />
            My notes
          </DialogTitle>
          <DialogDescription>
            A private notepad — only you can see it. Changes save automatically.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <RichText
            value={html}
            onChange={onChange}
            placeholder="Write anything — prep notes, questions to ask, salary thoughts…"
            ariaLabel="My notes"
            editorClassName="h-[50vh] min-h-48 overflow-y-auto sm:h-80"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            role="status"
            className={cn(
              state === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {status}
          </span>
          <span className={cn("tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
            {chars.toLocaleString("en-IN")} / {MAX_CHARS.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => void save()}
            disabled={!loaded || !!loadError || over || state === "saving" || state === "saved" || state === "idle"}
          >
            Save now
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

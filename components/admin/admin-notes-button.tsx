"use client";

// Admin-panel notepad (#8). Every admin has one; same storage and limits as
// the user app's notes, but built from the admin's own UI pieces.

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { getAdminNotesAction, saveAdminNotesAction } from "@/actions/admin-notes";
import { RichText } from "@/components/admin/ui/rich-text";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { cn, formatDateTime } from "@/lib/utils";

const MAX_CHARS = 20_000; // mirrors NOTES_MAX_CHARS in lib/notes.ts
const AUTOSAVE_MS = 1200;

function plainLength(html: string): number {
  if (typeof document === "undefined") return html.length;
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").length;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function AdminNotesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="My notes"
        title="My notes"
        className="ml-auto flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-10"
      >
        <NotebookPen className="size-5" aria-hidden />
      </button>
      {open && <AdminNotesDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AdminNotesDialog({ onClose }: { onClose: () => void }) {
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
    getAdminNotesAction().then((res) => {
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
    const res = await saveAdminNotesAction(value);
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

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== lastSaved.current && plainLength(latest.current) <= MAX_CHARS) {
        void saveAdminNotesAction(latest.current);
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
        </DialogHeader>

        {!loaded ? (
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <RichText
            value={html}
            onChange={onChange}
            placeholder="Write anything…"
            ariaLabel="My notes"
            editorClassName="h-[50vh] min-h-48 overflow-y-auto sm:h-80"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span role="status" className={cn(state === "error" ? "text-destructive" : "text-muted-foreground")}>
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

"use server";

// Admin-panel notepad — every admin has one (no plan gating).

import { requireAdmin } from "@/lib/current-user";
import { readNotes, writeNotes, type NotesDoc } from "@/lib/notes";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function getAdminNotesAction(): Promise<Result<NotesDoc>> {
  const adminId = await requireAdmin();
  return { ok: true, ...(await readNotes(adminId)) };
}

export async function saveAdminNotesAction(html: string): Promise<Result<NotesDoc>> {
  const adminId = await requireAdmin();
  try {
    return { ok: true, ...(await writeNotes(adminId, html)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save your notes." };
  }
}

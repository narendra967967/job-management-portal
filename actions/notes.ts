"use server";

// User-app notepad (premium). Access is decided on the server from the plan.

import { getCurrentUserId } from "@/lib/current-user";
import { getFeatureAccess, PREMIUM_REQUIRED } from "@/lib/entitlements";
import { readNotes, writeNotes, type NotesDoc } from "@/lib/notes";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; locked?: boolean };

export async function getMyNotesAction(): Promise<Result<NotesDoc>> {
  const userId = await getCurrentUserId();
  if (!(await getFeatureAccess(userId)).notes) {
    return { ok: false, error: PREMIUM_REQUIRED, locked: true };
  }
  return { ok: true, ...(await readNotes(userId)) };
}

export async function saveMyNotesAction(html: string): Promise<Result<NotesDoc>> {
  const userId = await getCurrentUserId();
  if (!(await getFeatureAccess(userId)).notes) {
    return { ok: false, error: PREMIUM_REQUIRED, locked: true };
  }
  try {
    return { ok: true, ...(await writeNotes(userId, html)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save your notes." };
  }
}

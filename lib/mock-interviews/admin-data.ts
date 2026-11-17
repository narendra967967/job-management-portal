import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { aiInterviews, user } from "@/db/schema";
import type { AdminSession, AdminSessionStatus } from "./admin-model";
import type { Difficulty } from "./model";

/** Newest started AI interviews for admin (the screen filters by date). */
const MAX_ROWS = 2000;

const STATUS: Record<string, AdminSessionStatus> = {
  completed: "completed",
  stopped: "stopped",
  failed: "failed",
  in_progress: "in_progress",
  interrupted: "in_progress",
};

export async function loadAdminSessions(): Promise<{ rows: AdminSession[]; capped: boolean }> {
  const replacement = alias(aiInterviews, "replacement");
  const list = await db
    .select({
      i: aiInterviews,
      name: user.name,
      email: user.email,
      creditNote: replacement.creditNote,
    })
    .from(aiInterviews)
    .innerJoin(user, eq(user.id, aiInterviews.userId))
    .leftJoin(replacement, eq(replacement.creditedFromId, aiInterviews.id))
    .where(and(isNotNull(aiInterviews.startedAt)))
    .orderBy(desc(aiInterviews.startedAt))
    .limit(MAX_ROWS + 1);

  const rows = list.slice(0, MAX_ROWS).flatMap(({ i, name, email, creditNote }): AdminSession[] => {
    const status = STATUS[i.status];
    if (!status || !i.startedAt) return [];
    const payment: AdminSession["payment"] =
      i.coverage === "paid" ? { kind: "paid", paise: i.pricePaise } : i.coverage === "plan" ? { kind: "plan" } : i.coverage === "credit" ? { kind: "credit" } : { kind: "free" };
    return [
      {
        id: i.id,
        startedAt: i.startedAt.toISOString(),
        user: { name, email },
        role: i.role,
        category: i.category,
        difficulty: i.difficulty as Difficulty,
        durationMin: i.durationMin,
        status,
        questions: i.questionsAsked,
        tokensIn: i.tokensIn,
        tokensOut: i.tokensOut,
        costPaise: i.aiCostPaise,
        payment,
        ...(creditNote ? { credited: { note: creditNote } } : {}),
      },
    ];
  });
  return { rows, capped: list.length > MAX_ROWS };
}

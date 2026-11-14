import "server-only";

// Records each scheduled job's last run (job_runs, one row per job) for the
// dashboard's System block. A cron route wraps its work in runJob. A run counts
// as failed only when the work throws; problems a job handles itself (one
// user's Gmail sync, one email that bounced) show up in their own places.
// Recording never changes the job's result: if the row can't be written, that
// goes to the server log and the job's own outcome stands.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cleanErrorMessage } from "@/lib/clean-error";
import type { JobKey } from "@/lib/job-runs-model";

async function record(job: JobKey, startedAt: Date, error: unknown | null): Promise<void> {
  const ok = error === null;
  const finishedAt = new Date();
  const durationMs = Math.min(finishedAt.getTime() - startedAt.getTime(), 2_147_483_647);
  try {
    await db.execute(sql`
      insert into job_runs (job, last_started_at, last_finished_at, last_ok, last_error, last_duration_ms, last_ok_at, failures_in_a_row)
      values (
        ${job}, ${startedAt.toISOString()}::timestamptz, ${finishedAt.toISOString()}::timestamptz, ${ok},
        ${ok ? null : cleanErrorMessage(error)}, ${durationMs},
        ${ok ? finishedAt.toISOString() : null}::timestamptz, ${ok ? 0 : 1}
      )
      on conflict (job) do update set
        last_started_at = excluded.last_started_at,
        last_finished_at = excluded.last_finished_at,
        last_ok = excluded.last_ok,
        last_error = excluded.last_error,
        last_duration_ms = excluded.last_duration_ms,
        last_ok_at = coalesce(excluded.last_ok_at, job_runs.last_ok_at),
        failures_in_a_row = case when excluded.last_ok then 0 else job_runs.failures_in_a_row + 1 end`);
  } catch (err) {
    console.error(`[job-runs] couldn't record the ${job} run:`, err instanceof Error ? err.message : err);
  }
}

/** Runs one scheduled job and records how it went. Returns or throws exactly as `work` does. */
export async function runJob<T>(job: JobKey, work: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  let result: T;
  try {
    result = await work();
  } catch (e) {
    await record(job, startedAt, e ?? new Error("Unknown error"));
    throw e;
  }
  await record(job, startedAt, null);
  return result;
}

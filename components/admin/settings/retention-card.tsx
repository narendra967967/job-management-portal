"use client";

// Admin → Settings → Data retention: days to keep each kind of log-like data.
// The daily purge cron deletes anything older (lib/retention.ts).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/admin/ui/input";
import { Field, SaveRow } from "@/components/admin/settings/form-bits";
import { updateRetentionAction } from "@/actions/admin-retention";
import { RETENTION_TYPES, type RetentionConfig, type RetentionKey } from "@/lib/retention-model";

export function RetentionCard({ initial }: { initial: RetentionConfig }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<RetentionKey, string>>(
    () => Object.fromEntries(RETENTION_TYPES.map((t) => [t.key, String(initial[t.key])])) as Record<RetentionKey, string>,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const parsed = {} as RetentionConfig;
    for (const t of RETENTION_TYPES) {
      const n = Number(values[t.key]);
      if (!Number.isInteger(n) || n < t.min || n > t.max) {
        setError(`${t.label}: enter whole days from ${t.min} to ${t.max}.`);
        return;
      }
      parsed[t.key] = n;
    }
    setError("");
    setBusy(true);
    const res = await updateRetentionAction(parsed);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Data retention</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {RETENTION_TYPES.map((t) => (
          <Field key={t.key} label={`${t.label} (days)`} hint={`${t.hint} · ${t.min}–${t.max}`}>
            <Input
              type="number"
              inputMode="numeric"
              min={t.min}
              max={t.max}
              step={1}
              value={values[t.key]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [t.key]: e.target.value }));
                if (error) setError("");
              }}
              className="w-32"
            />
          </Field>
        ))}
      </div>
      <SaveRow busy={busy} saved={saved} error={error} onSave={save} />
    </section>
  );
}

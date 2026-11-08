"use client";

// One email's wording: subject, heading, message, button label and footer, with
// its placeholders as chips that drop in at the cursor. Links aren't editable:
// the app makes them and puts them on the button.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, History, Mail, RotateCcw, Save } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/admin/ui/toast";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { HtmlEditor } from "@/components/admin/guides/html-editor";
import { InfoTip } from "@/components/ui/info-tip";
import { TemplatePreview } from "@/components/admin/email-templates/template-preview";
import { SampleBanner, WordingBadge } from "@/components/admin/email-templates/templates-list";
import { resetTemplate, saveTemplate, useTemplateRow, type TemplateVersion } from "@/lib/email-templates-mock";
import {
  BUTTON_MAX,
  FOOTER_MAX,
  HEADING_MAX,
  SUBJECT_MAX,
  sameContent,
  templateProblems,
  type EmailTemplateContent,
  type TemplateField,
  type TemplatePlaceholder,
} from "@/lib/email-templates-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

type TextField = "subject" | "heading" | "buttonLabel" | "footerNote";

export function TemplateEditor({ templateKey, appName }: { templateKey: string; appName: string }) {
  const mounted = useMounted();
  const row = useTemplateRow(templateKey);
  const [draft, setDraft] = useState<EmailTemplateContent | null>(null);
  const [errors, setErrors] = useState<Partial<Record<TemplateField, string[]>>>({});
  const [preview, setPreview] = useState<EmailTemplateContent | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoring, setRestoring] = useState<TemplateVersion | null>(null);
  const lastField = useRef<TextField | "bodyHtml" | null>(null);
  const inputs = useRef<Partial<Record<TextField, HTMLInputElement | null>>>({});

  // Start from what's saved once the browser's copy has loaded.
  useEffect(() => {
    if (mounted && row && !draft) setDraft(row.content);
  }, [mounted, row, draft]);

  const dirty = !!draft && !!row && !sameContent(draft, row.content);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!row) return null;
  const def = row.def;
  if (!draft) return <SampleBanner />;

  const set = (field: TemplateField, value: string) => {
    setDraft({ ...draft, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  /** Drops {{key}} in at the cursor of the field last used. */
  function insert(ph: TemplatePlaceholder) {
    const token = `{{${ph.key}}}`;
    // Where the cursor is right now (the chip keeps focus where it was), else the last field used.
    const active = document.activeElement;
    const focusedInput = (Object.entries(inputs.current) as [TextField, HTMLInputElement | null][]).find(
      ([, el]) => el && el === active,
    )?.[0];
    const field = focusedInput ?? ((active as HTMLElement | null)?.isContentEditable ? "bodyHtml" : lastField.current);
    if (!field) return toast.error("Click in a field first, where the placeholder should go.");
    if (ph.block && field !== "bodyHtml") return toast.error(`${token} can only go in the message.`);
    if (field === "bodyHtml") {
      const el = document.activeElement as HTMLElement | null;
      if (el?.isContentEditable) document.execCommand("insertText", false, token);
      else set("bodyHtml", `${draft!.bodyHtml}${token}`);
      return;
    }
    const el = inputs.current[field];
    const value = (draft![field] as string | null) ?? "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(field, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function check(): boolean {
    const problems = templateProblems(def, draft!);
    const next: Partial<Record<TemplateField, string[]>> = {};
    for (const p of problems) (next[p.field] ??= []).push(p.message);
    setErrors(next);
    if (problems.length) toast.error("Fix the highlighted fields first.");
    return problems.length === 0;
  }

  function save() {
    if (!check()) return;
    saveTemplate(def.key, draft!);
    toast.success("Saved");
  }

  const text = (field: TextField, label: string, max: number, hint: string) => (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
          {((draft[field] as string | null) ?? "").length}/{max}
        </span>
      </span>
      <Input
        ref={(el) => {
          inputs.current[field] = el;
        }}
        value={(draft[field] as string | null) ?? ""}
        onChange={(e) => set(field, e.target.value)}
        onFocus={() => (lastField.current = field)}
        aria-invalid={!!errors[field]}
        className="h-11 sm:h-9"
      />
      <span className={cn("block text-[11px]", errors[field] ? "text-destructive" : "text-muted-foreground")}>
        {errors[field]?.join(" ") ?? hint}
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SampleBanner />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/jmp-admin/email-templates"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:min-h-9"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Email templates
        </Link>
      </div>

      <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <h2 className="text-base font-semibold">{def.name}</h2>
        <WordingBadge edited={row.edited} />
        <p className="w-full text-xs text-muted-foreground">
          {def.trigger} · sent to {def.recipient === "user" ? "the user" : "your support inbox"}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card className="space-y-4 p-4">
          {text("subject", "Subject", SUBJECT_MAX, "The email's subject line.")}
          {text("heading", "Heading", HEADING_MAX, "The large title at the top. Leave empty for none.")}
          <div className="space-y-1.5" onFocusCapture={() => (lastField.current = "bodyHtml")}>
            <span className="text-sm font-medium">Message</span>
            <HtmlEditor value={draft.bodyHtml} onChange={(html) => set("bodyHtml", html)} placeholder="Write the message…" label="Message" />
            <span className={cn("block text-[11px]", errors.bodyHtml ? "text-destructive" : "text-muted-foreground")}>
              {errors.bodyHtml?.join(" ") ?? "Images need a full web address (https://…) to show in email."}
            </span>
          </div>
          {def.defaults.buttonLabel !== null &&
            text("buttonLabel", "Button label", BUTTON_MAX, "Where the button goes is set by the app, so its link always works.")}
          {text("footerNote", "Footer note", FOOTER_MAX, "A small line above the footer. Leave empty for none.")}
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="space-y-2.5 p-4">
            <h2 className="flex items-center gap-1 text-sm font-semibold">
              Placeholders
              <InfoTip label="About placeholders">
                Click in a field, then click a placeholder to put it there. Each is replaced with the real value when the
                email goes out. Marked ones are required, and dashed ones can only go in the message.
              </InfoTip>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {def.placeholders.map((ph) => (
                <button
                  key={ph.key}
                  type="button"
                  title={ph.label}
                  // Keep the cursor where it is in the field.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(ph)}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border px-2 font-mono text-[11px] hover:border-primary/50 hover:bg-primary/5",
                    ph.block && "border-dashed",
                    ph.required && "border-primary/60 text-primary",
                  )}
                >
                  {`{{${ph.key}}}`}
                  {ph.required && <span className="ml-0.5" aria-label="required">*</span>}
                </button>
              ))}
            </div>
            <ul className="space-y-1 border-t pt-2.5 text-[11px] text-muted-foreground">
              {def.placeholders.map((ph) => (
                <li key={ph.key}>
                  <span className="font-mono text-foreground">{ph.key}</span>: {ph.label}
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-2">
            <Button onClick={save} disabled={!dirty}>
              <Save className="size-4" aria-hidden />
              Save changes
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPreview(draft)}>
                <Eye className="size-4" aria-hidden />
                Preview
              </Button>
              <Button variant="outline" onClick={() => check() && toast.success("Test sent to your admin email")}>
                <Mail className="size-4" aria-hidden />
                Test to me
              </Button>
            </div>
            {row.edited && (
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="size-4" aria-hidden />
                Reset to default
              </Button>
            )}
          </div>

          <Card className="space-y-2 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" aria-hidden />
              Earlier versions
            </h2>
            {row.versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">None yet. Each save keeps the wording it replaces, up to 5.</p>
            ) : (
              <ul className="divide-y">
                {row.versions.map((v, i) => (
                  <li key={`${v.savedAt}-${i}`} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block">{mounted ? formatDateTime(v.savedAt) : ""}</span>
                      <span className="block text-muted-foreground">{v.savedBy}</span>
                    </span>
                    <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-7" onClick={() => setPreview(v.content)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="min-h-11 sm:min-h-7" onClick={() => setRestoring(v)}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {preview && (
        <TemplatePreview open onOpenChange={(o) => !o && setPreview(null)} def={def} content={preview} appName={appName} />
      )}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset to the default wording?"
        description="The current wording is kept in Earlier versions, so you can restore it."
        confirmLabel="Reset to default"
        onConfirm={() => {
          resetTemplate(def.key);
          setDraft(def.defaults);
          setErrors({});
          toast.success("Back to the default wording");
        }}
      />
      <ConfirmDialog
        open={!!restoring}
        onOpenChange={(o) => !o && setRestoring(null)}
        title="Restore this version?"
        description="It replaces the current wording, which is kept in Earlier versions."
        confirmLabel="Restore"
        onConfirm={() => {
          if (!restoring) return;
          saveTemplate(def.key, restoring.content);
          setDraft(restoring.content);
          setErrors({});
          toast.success("Version restored");
        }}
      />
    </div>
  );
}

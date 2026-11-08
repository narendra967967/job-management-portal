"use client";

// What an email looks like with sample values in: subject line, then the
// branded layout every email shares (heading, message, button, footer).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import { fillTemplate, sampleValues, type EmailTemplateContent, type EmailTemplateDef } from "@/lib/email-templates-model";

export function TemplatePreview({
  open,
  onOpenChange,
  def,
  content,
  appName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  def: EmailTemplateDef;
  content: EmailTemplateContent;
  appName: string;
}) {
  const values = { ...sampleValues(def), app_name: appName };
  const text = (s: string) => fillTemplate(def, s, values, "text");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview with sample values</DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border bg-[#f4f4f7]">
          <div className="border-b bg-white px-4 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Subject:</span> {text(content.subject)}
          </div>
          <div className="p-3 sm:p-5">
            <div className="mx-auto max-w-[560px] overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{appName}</div>
              <div className="px-5 py-4">
                {content.heading.trim() && <h2 className="mb-3 text-lg font-semibold">{text(content.heading)}</h2>}
                <div
                  className="guide-content text-sm"
                  dangerouslySetInnerHTML={{ __html: fillTemplate(def, content.bodyHtml, values, "html") }}
                />
                {content.buttonLabel !== null && (
                  <span className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                    {text(content.buttonLabel)}
                  </span>
                )}
              </div>
              <div className="border-t px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                {content.footerNote.trim() && (
                  <>
                    {text(content.footerNote)}
                    <br />
                  </>
                )}
                © {new Date().getFullYear()} {appName}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

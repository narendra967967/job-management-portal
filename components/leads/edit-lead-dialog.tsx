"use client";

// Edit an existing lead's core details (title/company/location/remote/jobUrl/
// tags) plus its JD/notes. Reuses the shared LeadCoreFields from the Add dialog.
// Status is left to the dedicated status control (not edited here), and the job
// URL stays required + unique per user (a colliding URL is rejected server-side).

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { isJobOpen, type JobLead } from "@/lib/types";
import { updateLead, useLeadDetail } from "@/lib/mock-store";
import { ActionDialog } from "@/components/leads/action-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  LeadCoreFields,
  validateLeadCore,
  EMPTY_LEAD_CORE,
  type LeadCoreValue,
} from "@/components/leads/add-lead-dialog";

export function EditLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: JobLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useLeadDetail(lead.id);
  const [core, setCore] = useState<LeadCoreValue>(EMPTY_LEAD_CORE);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<LeadCoreValue>) => setCore((c) => ({ ...c, ...p }));

  // Prefill from the lead + its detail whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCore({
      title: lead.title,
      company: lead.company,
      location: lead.location,
      remote: lead.remote,
      jobUrl: lead.canonicalJobUrl,
      // Not shown/edited here; kept only to satisfy the shared value shape.
      status: isJobOpen(lead.status) ? lead.status : "new",
      tags: lead.tags,
      jdText: detail?.jdText ?? "",
      notes: detail?.notes ?? "",
    });
    setSaving(false);
  }, [open, lead, detail]);

  async function save() {
    const err = validateLeadCore(core);
    if (err) return toast.error(err);

    setSaving(true);
    const res = await updateLead(lead.id, core);
    setSaving(false);

    if (res.ok) {
      toast.success("Lead updated", `${core.title.trim()} · ${core.company.trim()}`);
      onOpenChange(false);
    } else {
      toast.error("Couldn't update lead", res.error);
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="sm:max-w-2xl lg:max-w-3xl"
      icon={<Pencil className="size-4" aria-hidden />}
      title="Edit lead"
      description={`${lead.company} · ${lead.title}`}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <LeadCoreFields value={core} onChange={patch} showStatus={false} />
    </ActionDialog>
  );
}

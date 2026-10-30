"use client";

// Shown when a user opens a premium feature their plan doesn't include:
// what the feature does + "Request upgrade" (the existing billing support flow).

import { Lock, Sparkles } from "lucide-react";
import { useContactSupport } from "@/components/support/contact-support";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PremiumLockedDialog({
  feature,
  description,
  onClose,
}: {
  /** e.g. "Notes" or "AI salary insight". */
  feature: string;
  description: string;
  onClose: () => void;
}) {
  const { open: openSupport } = useContactSupport();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-primary" aria-hidden />
            {feature} isn&apos;t on your plan
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onClose();
              openSupport({
                category: "billing",
                subject: `Upgrade request — ${feature}`,
                message: `<p>I'd like to upgrade my plan to use ${feature}. Please help me move to a plan that includes it.</p>`,
                source: "plan",
              });
            }}
          >
            <Sparkles className="size-4" aria-hidden />
            Request upgrade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

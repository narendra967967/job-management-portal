"use client";

// Reusable confirmation prompt. Usage:
//   const { confirm, dialog } = useConfirm();
//   ...
//   onClick={async () => { if (await confirm({ title, description, destructive: true })) doThing(); }}
//   ...render {dialog} once in the component.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }

  function settle(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  const dialog = (
    <Dialog open={state !== null} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          {state?.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {state?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={state?.destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {state?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}

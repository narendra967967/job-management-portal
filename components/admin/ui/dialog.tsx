"use client";

// Admin-only modal dialog (base-ui). Separate from the user app's dialog so
// admin modals can be styled independently.

import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = D.Root;
const DialogTrigger = D.Trigger;
const DialogClose = D.Close;

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: D.Popup.Props & { showClose?: boolean }) {
  return (
    <D.Portal>
      <D.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <D.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:max-w-lg data-open:animate-in data-open:zoom-in-95 data-closed:animate-out data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <D.Close className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </D.Close>
        )}
      </D.Popup>
    </D.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}
function DialogTitle({ className, ...props }: D.Title.Props) {
  return <D.Title className={cn("text-base font-semibold", className)} {...props} />;
}
function DialogDescription({ className, ...props }: D.Description.Props) {
  return <D.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };

"use client";

// Admin-only dropdown menu (base-ui). Used for table row actions.

import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({
  className,
  align = "end",
  children,
  ...props
}: Menu.Popup.Props & { align?: "start" | "end" }) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={6} className="z-50">
        <Menu.Popup
          className={cn(
            "min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({
  className,
  destructive,
  ...props
}: Menu.Item.Props & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none",
        "data-highlighted:bg-muted",
        destructive ? "text-destructive data-highlighted:bg-destructive/10" : "text-foreground",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return <Menu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };

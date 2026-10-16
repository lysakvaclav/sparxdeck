"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CrossIcon, type IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Blueprint dialog: white header bar with icon, title and close, light body. */
export function Dialog({
  open,
  onOpenChange,
  title,
  icon: Icon,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: IconComponent;
  closeLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(16_22_26/0.7)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-3 top-1/2 z-50 mx-auto flex max-h-[85dvh] max-w-[560px] -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-canvas shadow-elevation-4 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          <div className="flex min-h-10 shrink-0 items-center gap-2.5 bg-background ps-5 pe-[5px] shadow-[0_1px_0_var(--border)]">
            {Icon && <Icon size={20} className="text-muted-foreground" />}
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-ui-lg font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label={closeLabel}>
                <CrossIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 scrollbar-thin overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

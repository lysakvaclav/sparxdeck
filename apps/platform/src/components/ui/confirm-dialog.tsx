"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { CrossIcon, WarningSignIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  /** Shown under the description, e.g. an error from the last attempt. */
  children?: React.ReactNode;
};

/**
 * Confirmation before an irreversible action: a rounded panel with the title
 * over a divider, the text, and actions on the right. Radix AlertDialog traps
 * focus and closes on Escape; confirming never closes it on its own, so the
 * caller can keep it open while the action runs.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[rgb(15_23_42/0.5)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          className={cn(
            "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-[500px] overflow-hidden rounded-xl bg-background pb-6 shadow-elevation-4 outline-none",
            "sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex min-h-14 items-center gap-3 ps-6 pe-2.5 shadow-[0_1px_0_var(--border)]">
            {destructive && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint-danger text-destructive-text">
                <WarningSignIcon />
              </span>
            )}
            <AlertDialog.Title className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" size="icon" aria-label={cancelLabel} disabled={pending}>
                <CrossIcon />
              </Button>
            </AlertDialog.Cancel>
          </div>
          <div className="mx-6 my-5">
            <AlertDialog.Description className="text-ui text-muted-foreground">
              {description}
            </AlertDialog.Description>
            {children && <div className="mt-4">{children}</div>}
          </div>
          <div className="mx-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? "destructive" : "primary"}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

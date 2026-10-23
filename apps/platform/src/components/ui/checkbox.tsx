"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { SmallTickIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Checkbox: an 18px rounded box with a firm border, solid blue when checked. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-background shadow-[inset_0_0_0_1.5px_var(--control-border)] transition-colors outline-none hover:shadow-[inset_0_0_0_1.5px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:shadow-[inset_0_0_0_1.5px_var(--border-strong)] data-[state=checked]:bg-primary data-[state=checked]:shadow-none data-[state=checked]:disabled:opacity-50 data-[state=indeterminate]:bg-primary data-[state=indeterminate]:shadow-none pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-['']",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex text-white">
        <SmallTickIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

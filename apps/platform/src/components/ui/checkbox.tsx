"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { SmallTickIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Checkbox: 16px box with the button surface, blue when checked. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-sm surface-button outline-none hover:bg-[var(--btn-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:shadow-none data-[state=checked]:bg-primary data-[state=checked]:[background-image:var(--btn-intent-gradient)] data-[state=checked]:shadow-[var(--btn-intent-shadow)] data-[state=checked]:disabled:opacity-50 pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-['']",
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

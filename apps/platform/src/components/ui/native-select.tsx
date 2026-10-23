import * as React from "react";
import { DoubleCaretVerticalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// A native <select> styled as a Blueprint HTML select: the phone's own picker is
// the most usable option in the field.
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-[30px] w-full min-w-0 appearance-none rounded-md border-0 surface-button ps-2.5 pe-8 text-base outline-none hover:bg-[var(--btn-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none sm:text-ui pointer-coarse:h-11 [.brand_&]:h-11 [.brand_&]:sm:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <DoubleCaretVerticalIcon className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[var(--btn-icon)]" />
    </div>
  );
}

export { NativeSelect };

import * as React from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// A native <select> with the input look and a chevron: the phone's own picker is
// the most usable option in the field.
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "surface-input h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border-0 ps-3 pe-9 text-base text-foreground transition-[box-shadow] duration-150 outline-none hover:bg-[var(--btn-bg-hover)] focus-visible:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--focus-soft)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:text-[var(--btn-disabled-fg)] sm:text-ui pointer-coarse:h-11 [.brand_&]:h-11 [.brand_&]:sm:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--btn-icon)]" />
    </div>
  );
}

export { NativeSelect };

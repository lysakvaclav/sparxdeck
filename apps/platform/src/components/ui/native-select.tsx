import * as React from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// A native <select>: the phone's own picker is the most usable option in the
// field; with a mouse the option list is drawn as a menu (`.picker` in globals.css).
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "picker h-8 w-full min-w-0 appearance-none rounded-lg border-0 surface-button ps-2.5 pe-8 text-base outline-none hover:bg-[var(--btn-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none sm:text-ui pointer-coarse:h-11 [.brand_&]:h-11 [.brand_&]:sm:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[var(--btn-icon)]" />
    </div>
  );
}

export { NativeSelect };

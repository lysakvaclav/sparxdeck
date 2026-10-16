import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared look of text controls (Blueprint input): white field with an inset
 * hairline and inner shadow, blue ring on focus, red ring when invalid. 16px text
 * on phones so iOS doesn't zoom in.
 */
export const controlClass =
  "surface-input w-full min-w-0 rounded-md border-0 text-base text-foreground transition-[box-shadow] duration-100 outline-none focus-visible:outline-none focus:shadow-[0_0_0_1px_var(--ring),0_0_0_3px_rgb(19_124_189/0.3),inset_0_1px_1px_rgb(16_22_26/0.2)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),inset_0_1px_1px_rgb(16_22_26/0.2)] aria-invalid:focus:shadow-[0_0_0_1px_var(--destructive),0_0_0_3px_rgb(219_55_55/0.3),inset_0_1px_1px_rgb(16_22_26/0.2)] sm:text-ui [.brand_&]:focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--focus)] [.brand_&]:sm:text-sm";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        controlClass,
        "flex h-[30px] px-2.5 pointer-coarse:h-11 pointer-coarse:px-3 [.brand_&]:h-11 [.brand_&]:px-3",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

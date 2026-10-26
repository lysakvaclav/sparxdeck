import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared look of text controls: white field with a thin border, soft blue ring
 * on focus, red border when invalid. 16px text
 * on phones so iOS doesn't zoom in.
 */
export const controlClass =
  "surface-input w-full min-w-0 rounded-md border-0 text-base text-foreground transition-[box-shadow] duration-100 outline-none focus-visible:outline-none focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] aria-invalid:focus:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_3px_rgb(214_69_69/0.3)] sm:text-ui [.brand_&]:focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--focus)] [.brand_&]:sm:text-sm";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        controlClass,
        "flex h-8 px-2.5 pointer-coarse:h-11 pointer-coarse:px-3 [.brand_&]:h-11 [.brand_&]:px-3",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Buttons: 32px tall with 8px corners and medium-weight labels: solid blue for
 * the main action, white with a light grey border for the others, plain text for
 * quiet ones; a small line icon before the label in the text colour. 44px on
 * touch screens; the landing page's pills on the sign-in screens (.brand).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-lg leading-none font-medium whitespace-nowrap transition-[background-color,box-shadow] duration-100 select-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [.brand_&]:rounded-full [.brand_&]:font-medium",
  {
    variants: {
      variant: {
        primary:
          "bg-primary [background-image:var(--btn-intent-gradient)] text-primary-foreground shadow-[var(--btn-intent-shadow)] hover:bg-primary-hover active:bg-primary-active active:[background-image:none] active:shadow-[var(--btn-intent-shadow-active)] disabled:opacity-50",
        outline:
          "surface-button hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] active:[background-image:none] active:shadow-[var(--btn-shadow-active)] disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none",
        ghost:
          "text-foreground hover:bg-accent active:bg-accent-strong disabled:bg-transparent disabled:text-[var(--btn-disabled-fg)]",
        destructive:
          "bg-destructive [background-image:var(--btn-intent-gradient)] text-destructive-foreground shadow-[var(--btn-intent-shadow)] hover:bg-destructive-hover active:bg-destructive-active active:[background-image:none] active:shadow-[var(--btn-intent-shadow-active)] disabled:opacity-50",
        destructiveMinimal:
          "text-destructive-text hover:bg-destructive/15 active:bg-destructive/25 disabled:text-[var(--btn-disabled-fg)] disabled:hover:bg-transparent",
        link: "h-auto min-w-0 px-0 text-link underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 min-w-7 gap-1.5 px-2.5 text-ui pointer-coarse:h-11 pointer-coarse:px-3",
        md: "h-8 min-w-8 gap-1.5 px-3 text-ui pointer-coarse:h-11 pointer-coarse:px-4 [.brand_&]:h-11 [.brand_&]:gap-2 [.brand_&]:px-4 [.brand_&]:text-sm",
        lg: "h-10 min-w-10 gap-2 px-4 text-ui-lg pointer-coarse:h-12",
        icon: "size-8 p-0 pointer-coarse:size-11 [.brand_&]:size-11",
        iconSm: "size-7 p-0 pointer-coarse:size-11",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };

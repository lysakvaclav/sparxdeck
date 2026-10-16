import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Blueprint-style buttons: 30px tall, a light top-down gradient with inset
 * borders, grey icons in neutral buttons. 44px on touch screens; the landing
 * page shape on the sign-in screens (.brand).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md leading-none font-normal whitespace-nowrap transition-[background-color,box-shadow] duration-100 select-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [.brand_&]:font-medium",
  {
    variants: {
      variant: {
        primary:
          "bg-primary [background-image:var(--btn-intent-gradient)] text-primary-foreground shadow-[var(--btn-intent-shadow)] hover:bg-primary-hover active:bg-primary-active active:[background-image:none] active:shadow-[var(--btn-intent-shadow-active)] disabled:opacity-50",
        outline:
          "surface-button hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] active:[background-image:none] active:shadow-[var(--btn-shadow-active)] disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:text-[var(--btn-disabled-fg)] disabled:shadow-none [&_svg]:text-[var(--btn-icon)]",
        ghost:
          "text-foreground hover:bg-accent active:bg-accent-strong disabled:bg-transparent disabled:text-[var(--btn-disabled-fg)] [&_svg]:text-[var(--btn-icon)]",
        destructive:
          "bg-destructive [background-image:var(--btn-intent-gradient)] text-destructive-foreground shadow-[var(--btn-intent-shadow)] hover:bg-destructive-hover active:bg-destructive-active active:[background-image:none] active:shadow-[var(--btn-intent-shadow-active)] disabled:opacity-50",
        destructiveMinimal:
          "text-destructive-text hover:bg-destructive/15 active:bg-destructive/25 disabled:text-[var(--btn-disabled-fg)] disabled:hover:bg-transparent",
        link: "h-auto min-w-0 px-0 text-link underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-6 min-w-6 gap-[5px] px-[7px] text-ui pointer-coarse:h-11 pointer-coarse:px-3",
        md: "h-[30px] min-w-[30px] gap-[7px] px-2.5 text-ui pointer-coarse:h-11 pointer-coarse:px-4 [.brand_&]:h-11 [.brand_&]:gap-2 [.brand_&]:px-4 [.brand_&]:text-sm",
        lg: "h-10 min-w-10 gap-[7px] px-[15px] text-ui-lg pointer-coarse:h-12",
        icon: "size-[30px] p-0 pointer-coarse:size-11 [.brand_&]:size-11",
        iconSm: "size-6 p-0 pointer-coarse:size-11",
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

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Tags: 20px pills with 12px text. "Minimal" variants are tinted.
const badgeVariants = cva(
  "inline-flex min-h-5 max-w-full items-center gap-1 rounded-full px-2 text-ui-sm font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-accent-strong text-foreground",
        solid: "bg-[#5f6b7a] text-white",
        primary: "bg-primary text-primary-foreground",
        // Darker than --link: on a selected row (blue tint under the tint) --link
        // falls below 4.5:1. Dark mode keeps the light link blue.
        primaryMinimal: "bg-primary/15 text-primary-active dark:text-link",
        success: "bg-success/15 text-success-text",
        warning: "bg-warning/15 text-warning-text",
        danger: "bg-destructive/15 text-destructive-text",
        outline: "shadow-[inset_0_0_0_1px_var(--border-strong)] text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };

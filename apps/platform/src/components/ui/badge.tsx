import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pill tags: 22px, medium-weight small text in a soft tint (AA contrast in both themes).
const badgeVariants = cva(
  "inline-flex min-h-[22px] max-w-full items-center gap-1 rounded-full px-2 text-ui-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-tint-neutral text-tint-neutral-foreground",
        solid: "bg-[#5d6979] text-white dark:bg-[#3c4858]",
        primary: "bg-primary text-primary-foreground",
        primaryMinimal: "bg-tint-primary text-tint-primary-foreground",
        success: "bg-tint-success text-tint-success-foreground",
        warning: "bg-tint-warning text-tint-warning-foreground",
        danger: "bg-tint-danger text-tint-danger-foreground",
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

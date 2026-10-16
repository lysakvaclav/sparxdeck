import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Blueprint tags: 20px, 12px text, 3px radius. "Minimal" variants are tinted.
const badgeVariants = cva(
  "inline-flex min-h-5 max-w-full items-center gap-1 rounded-md px-1.5 text-ui-sm whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[rgb(138_155_168/0.2)] text-foreground",
        solid: "bg-[#5c7080] text-[#f5f8fa]",
        primary: "bg-primary text-primary-foreground",
        primaryMinimal: "bg-primary/15 text-link",
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

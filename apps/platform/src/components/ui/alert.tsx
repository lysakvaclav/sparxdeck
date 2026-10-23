import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ErrorIcon,
  InfoSignIcon,
  TickCircleIcon,
  WarningSignIcon,
  type IconComponent,
} from "@/components/icons";
import { cn } from "@/lib/utils";

// Callout: a soft tinted block with a border, an intent icon and optional bold title.
const alertVariants = cva(
  "flex gap-3 rounded-lg border px-4 py-3 text-ui text-foreground [.brand_&]:text-sm",
  {
    variants: {
      variant: {
        info: "border-tint-primary-border bg-tint-primary [&>svg]:text-link [.brand_&]:border-border [.brand_&]:bg-muted [.brand_&]:[&>svg]:text-muted-foreground",
        success:
          "border-tint-success-border bg-tint-success [&>svg]:text-success-text [.brand_&]:border-success/30 [.brand_&]:bg-success/10",
        error:
          "border-tint-danger-border bg-tint-danger [&>svg]:text-destructive-text [.brand_&]:border-destructive/30 [.brand_&]:bg-destructive/10",
        warning: "border-tint-warning-border bg-tint-warning [&>svg]:text-warning-text",
        neutral: "border-tint-neutral-border bg-tint-neutral [&>svg]:text-muted-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons: Record<string, IconComponent> = {
  info: InfoSignIcon,
  success: TickCircleIcon,
  error: ErrorIcon,
  warning: WarningSignIcon,
  neutral: InfoSignIcon,
};

type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & { title?: string; icon?: IconComponent };

function Alert({ className, variant, title, icon, children, ...props }: AlertProps) {
  const Icon = icon ?? icons[variant ?? "info"] ?? InfoSignIcon;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export { Alert };

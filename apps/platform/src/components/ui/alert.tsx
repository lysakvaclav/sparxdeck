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

// Blueprint callout: tinted block with an intent icon and optional bold title.
const alertVariants = cva(
  "flex gap-2.5 rounded-md px-3 py-2.5 text-ui text-foreground [.brand_&]:border [.brand_&]:text-sm",
  {
    variants: {
      variant: {
        info: "bg-primary/15 [&>svg]:text-link [.brand_&]:border-border [.brand_&]:bg-muted [.brand_&]:[&>svg]:text-muted-foreground",
        success: "bg-success/15 [&>svg]:text-success-text [.brand_&]:border-success/30",
        error: "bg-destructive/15 [&>svg]:text-destructive-text [.brand_&]:border-destructive/30",
        warning: "bg-warning/15 [&>svg]:text-warning-text",
        neutral: "bg-[rgb(138_155_168/0.15)] [&>svg]:text-muted-foreground",
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
      <Icon className="mt-px" />
      <div className="min-w-0 flex-1 space-y-1.5">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export { Alert };

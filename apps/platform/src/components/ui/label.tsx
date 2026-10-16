import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "block text-ui text-foreground [.brand_&]:text-sm [.brand_&]:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

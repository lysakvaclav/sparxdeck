import * as React from "react";
import { cn } from "@/lib/utils";
import { controlClass } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        controlClass,
        "flex min-h-[72px] px-3 py-2 [.brand_&]:px-3 [.brand_&]:py-2.5",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

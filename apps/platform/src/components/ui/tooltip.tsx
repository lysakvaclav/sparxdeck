"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

/** App-wide provider: short delay, instant when moving between items. */
function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/** Blueprint tooltip next to an icon-only control. The trigger keeps its own accessible name. */
function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-72 rounded-md bg-tooltip px-2 py-[5px] text-ui-sm text-tooltip-foreground shadow-elevation-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-tooltip" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip, TooltipProvider };

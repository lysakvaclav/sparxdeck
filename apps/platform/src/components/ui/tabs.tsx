"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// Blueprint tabs: 30px tall, selected tab blue with a 3px indicator.
const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex h-[30px] items-stretch gap-5 px-[15px] shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 text-ui whitespace-nowrap text-foreground outline-none hover:text-link focus-visible:text-link data-[state=active]:text-link data-[state=active]:shadow-[inset_0_-3px_0_var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

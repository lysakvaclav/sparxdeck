import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Blueprint card used as a section: white surface with a hairline elevation, an
 * optional header bar (title, small description, actions) and content below.
 */

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative min-w-0 rounded-lg bg-card text-card-foreground shadow-elevation-0",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  actions,
  children,
  ...props
}: React.ComponentProps<"div"> & { actions?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2.5 px-[15px] py-1.5 shadow-[0_1px_0_var(--border)]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("truncate text-ui font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-ui-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-[15px]", className)} {...props} />;
}

/** Action row at the bottom of a card (forms): right-aligned buttons over a divider. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2.5 px-[15px] py-2.5 shadow-[inset_0_1px_0_var(--border)] sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

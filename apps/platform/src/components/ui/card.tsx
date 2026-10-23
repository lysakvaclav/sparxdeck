import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Card used as a section: white surface with a soft border and rounded
 * corners, an optional header (title, small description, actions) over a
 * divider, and content below. Content is clipped to the corners (a table's
 * header band too) with a little room for focus rings.
 */

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative min-w-0 overflow-clip rounded-lg bg-card text-card-foreground shadow-elevation-1 [overflow-clip-margin:3px]",
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
        "flex min-h-14 items-center gap-3 px-5 py-2.5 shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("truncate text-[0.9375rem] font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-ui-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Action row at the bottom of a card (forms): right-aligned buttons over a divider. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2.5 px-5 py-4 shadow-[inset_0_1px_0_var(--border)] sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

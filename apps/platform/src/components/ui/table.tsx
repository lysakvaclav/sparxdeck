import * as React from "react";
import Link from "next/link";
import { CaretDownIcon, CaretUpIcon, DoubleCaretVerticalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * Airy table: muted header labels on a light band, horizontal dividers only,
 * 48px rows with a soft hover. A row links to a detail page through `RowLink`
 * (a stretched link in the first cell), so the whole row is clickable and accessible.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full scrollbar-thin overflow-x-auto">
      <table
        className={cn("w-full border-separate border-spacing-0 text-ui", className)}
        {...props}
      />
    </div>
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-muted", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "relative transition-colors [&:has([data-row-link]:focus-visible)]:bg-selected [&:has([data-row-link]:hover)]:bg-accent/70",
        className,
      )}
      {...props}
    />
  );
}

const cellBorders = "shadow-[inset_0_-1px_0_var(--border)]";

function TableHeaderCell({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 px-3 text-start align-middle text-ui-sm font-medium whitespace-nowrap text-muted-foreground first:ps-5 last:pe-5",
        cellBorders,
        className,
      )}
      {...props}
    />
  );
}

/** Column header that sorts the list (a link that sets ?sort=). */
function SortableHeader({
  href,
  active,
  direction,
  children,
  className,
}: {
  href: string;
  active: boolean;
  direction: "asc" | "desc";
  children: React.ReactNode;
  className?: string;
}) {
  const Caret = active
    ? direction === "asc"
      ? CaretUpIcon
      : CaretDownIcon
    : DoubleCaretVerticalIcon;
  return (
    <TableHeaderCell
      className={className}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {children}
        <Caret className={cn(active ? "text-link" : "text-subtle")} />
      </Link>
    </TableHeaderCell>
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "h-12 px-3 align-middle first:ps-5 last:pe-5 pointer-coarse:h-14",
        cellBorders,
        "[tr:last-child>&]:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

/** The row's main link; its hit area covers the whole row. */
function RowLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-row-link=""
      className={cn(
        "font-medium text-link outline-none after:absolute after:inset-0 after:content-[''] hover:underline",
        className,
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  SortableHeader,
  TableCell,
  RowLink,
};

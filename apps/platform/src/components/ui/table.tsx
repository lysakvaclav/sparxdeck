import * as React from "react";
import Link from "next/link";
import { CaretDownIcon, CaretUpIcon, DoubleCaretVerticalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { ScrollX } from "./scroll-x";

/*
 * Table: bold column labels, 48px rows, hairlines under the rows and between
 * columns, row hover. A row links to a detail page through `RowLink` (a
 * stretched link in the first cell), so the whole row is clickable and accessible.
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    // Keyboard-scrollable when wider than the screen; clips to a card's corners.
    <ScrollX className="w-full scrollbar-thin rounded-[inherit]">
      <table
        className={cn("w-full border-separate border-spacing-0 text-ui", className)}
        {...props}
      />
    </ScrollX>
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-background", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "relative transition-colors [&:has([data-row-link]:focus-visible)]:bg-selected [&:has([data-row-link]:hover)]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

// A hairline under every row and between columns (none after the last).
const cellBorders =
  "border-e border-border shadow-[inset_0_-1px_0_var(--border)] last:border-e-0";

function TableHeaderCell({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 px-4 text-start align-middle text-ui font-semibold whitespace-nowrap text-foreground",
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
          "inline-flex items-center gap-1 rounded-sm hover:text-link",
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
        "h-12 px-4 align-middle pointer-coarse:h-12",
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
        "text-link outline-none after:absolute after:inset-0 after:content-[''] hover:underline",
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

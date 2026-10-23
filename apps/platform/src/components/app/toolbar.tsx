"use client";

import * as React from "react";
import { CaretDownIcon, type IconComponent } from "@/components/icons";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * Toolbar: icon buttons in a 36px rounded box with a small label underneath. Scrolls sideways on narrow screens. Buttons can be
 * toggles (`active`) or menu triggers (`menu`); related tools share a group.
 */

const box =
  "surface-button relative flex size-9 items-center justify-center rounded-md transition-[background-color,box-shadow] duration-150 [&_svg]:text-[var(--btn-icon)]";
const boxIdle =
  "group-hover:bg-[var(--btn-bg-hover)] group-active:bg-[var(--btn-bg-active)] group-active:shadow-[var(--btn-shadow-active)]";
const boxPressed =
  "bg-tint-primary shadow-[inset_0_0_0_1px_var(--tint-primary-border)] [&_svg]:text-link";
const boxDisabled =
  "group-disabled:bg-[var(--btn-disabled-bg)] group-disabled:shadow-[inset_0_0_0_1px_var(--border)] group-disabled:[&_svg]:text-[var(--btn-disabled-fg)]";

export function Toolbar({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      className={cn(
        "relative z-[5] flex shrink-0 scrollbar-thin items-start gap-1.5 overflow-x-auto bg-background px-4 pt-2 pb-1.5 shadow-[inset_0_-1px_0_var(--border)] sm:px-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return <div aria-hidden className="mx-2 mt-0.5 h-12 w-px shrink-0 bg-border" />;
}

export function ToolbarSpacer() {
  return <div aria-hidden className="min-w-3 flex-1" />;
}

type ToolbarButtonProps = Omit<React.ComponentProps<"button">, "children"> & {
  icon: IconComponent;
  label: string;
  /** Pressed state for toggles. */
  active?: boolean;
  /** Shows a caret: the button opens a menu. */
  menu?: boolean;
  /** Keyboard shortcut shown in the tooltip, e.g. "Ctrl+Z". */
  shortcut?: string;
};

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ icon: Icon, label, active, menu, shortcut, className, ...props }, ref) {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-pressed={active === undefined || menu ? undefined : active}
        className={cn(
          "group flex min-w-[52px] shrink-0 flex-col items-center gap-1 rounded-md px-0.5 text-ui-xs text-muted-foreground outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:text-[var(--btn-disabled-fg)]",
          className,
        )}
        {...props}
      >
        <span className={cn(box, active ? boxPressed : boxIdle, boxDisabled)}>
          <Icon />
          {menu && <CaretDownIcon size={10} className="absolute end-px bottom-px size-2.5" />}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </button>
    );
    return shortcut ? (
      <Tooltip label={`${label} (${shortcut})`} side="bottom">
        {button}
      </Tooltip>
    ) : (
      button
    );
  },
);

/** Two or more icon buttons sharing one label ("Tools": pan | select). */
export function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 flex-col items-center gap-1 px-0.5"
    >
      <div className="flex">{children}</div>
      <span className="text-ui-xs whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  );
}

/** Icon button inside a ToolbarGroup: a toggle when `active` is given, else an action. */
export function ToolbarToggle({
  icon: Icon,
  label,
  active,
  shortcut,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  icon: IconComponent;
  label: string;
  active?: boolean;
  shortcut?: string;
}) {
  return (
    <Tooltip label={shortcut ? `${label} (${shortcut})` : label} side="bottom">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "group relative outline-none not-first:-ms-px focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed [&:not(:first-child):not(:last-child)>span]:rounded-none first:[&>span]:rounded-e-none last:[&>span]:rounded-s-none",
          className,
        )}
        {...props}
      >
        <span className={cn(box, active ? boxPressed : boxIdle, boxDisabled)}>
          <Icon />
        </span>
      </button>
    </Tooltip>
  );
}

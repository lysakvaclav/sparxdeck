"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { CaretRightIcon, SmallTickIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// Blueprint menu: 5px padding, 30px items with a grey icon, hover tint.
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const contentClass =
  "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[180px] overflow-y-auto rounded-md bg-popover p-[5px] text-popover-foreground shadow-elevation-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1";

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(contentClass, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const itemClass =
  "relative flex min-h-[30px] cursor-pointer items-center gap-[7px] rounded-sm px-[7px] text-ui outline-none select-none pointer-coarse:min-h-11 data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--btn-disabled-fg)] data-[highlighted]:bg-accent [&_svg]:shrink-0 [&_svg]:text-[var(--btn-icon)] data-[disabled]:[&_svg]:opacity-60";

function DropdownMenuItem({
  className,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { shortcut?: string }) {
  return (
    <DropdownMenuPrimitive.Item className={cn(itemClass, className)} {...props}>
      {/* A lone child keeps asChild items (links) valid: Slot needs exactly one element. */}
      {shortcut ? (
        <>
          {children}
          <span className="ms-auto ps-4 text-ui-sm text-muted-foreground">{shortcut}</span>
        </>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.Item>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemClass, "ps-[30px]", className)}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator className="absolute start-[7px] flex items-center">
        <SmallTickIcon />
      </DropdownMenuPrimitive.ItemIndicator>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(itemClass, "ps-[30px]", className)} {...props}>
      <DropdownMenuPrimitive.ItemIndicator className="absolute start-[7px] flex items-center">
        <SmallTickIcon />
      </DropdownMenuPrimitive.ItemIndicator>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(itemClass, "data-[state=open]:bg-accent", className)}
      {...props}
    >
      {children}
      <CaretRightIcon className="ms-auto rtl:rotate-180" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent className={cn(contentClass, className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-[7px] pt-2 pb-1 text-ui font-semibold", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("mx-[5px] my-[5px] h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};

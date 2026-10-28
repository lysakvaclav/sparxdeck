"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { BracesIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  VARIABLE_GROUPS,
  variableToken,
  type VariableKey,
} from "@/lib/protocol-template/variables";

// Variables of a protocol template (part 22, stage C), chosen from a menu
// rather than typed, so they are spelt right.

/** The name of a variable's group and of the variable, in the app's language. */
export function useVariableNames() {
  const t = useTranslations("protocolTemplates.variables");
  const text = t as unknown as (key: string) => string;
  return {
    group: (group: string) => text(`groups.${group}`),
    variable: (key: string) => {
      const [group, name] = key.split(".");
      return text(`names.${group}.${name}`);
    },
  };
}

export function VariableMenu({ onPick, label }: { onPick: (token: string) => void; label?: string }) {
  const t = useTranslations("protocolTemplates.variables");
  const named = useVariableNames();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={label ? "iconSm" : "sm"}
          aria-label={label ?? t("insert")}
          title={t("insert")}
        >
          <BracesIcon />
          {!label && t("insertShort")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-72 overflow-y-auto">
        {Object.entries(VARIABLE_GROUPS).map(([group, names]) => (
          <DropdownMenuGroup key={group}>
            <DropdownMenuLabel>{named.group(group)}</DropdownMenuLabel>
            {names.map((name) => {
              const key = `${group}.${name}` as VariableKey;
              return (
                <DropdownMenuItem key={key} onSelect={() => onPick(variableToken(key))}>
                  <span className="min-w-0 flex-1">{named.variable(key)}</span>
                  <code className="text-ui-sm text-muted-foreground">{variableToken(key)}</code>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A one-line text field with the variable menu beside it; a variable goes in at the caret. */
export function VariableInput({
  id,
  label,
  hint,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("protocolTemplates.variables");
  const input = useRef<HTMLInputElement>(null);
  const insert = (token: string) => {
    const element = input.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`.slice(0, maxLength);
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="flex items-end gap-1.5">
      <Field id={id} label={label} hint={hint} className="min-w-0 flex-1">
        <Input
          ref={input}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <div className={hint ? "mb-[22px] pointer-coarse:mb-[22px]" : undefined}>
        <VariableMenu onPick={insert} label={t("insertInto", { field: label })} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// The fields of the template editor's property panel. Every change goes to the
// template at once (it is saved as a draft); a number only once it is within
// its limits, so the template stays valid while it is typed.

export function TextControl({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      {multiline ? (
        <Textarea
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={6}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function NumberControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  integer = false,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const t = useTranslations("protocolTemplates.properties");
  const [text, setText] = useState(String(value));
  // A change from elsewhere (undo, another block) shows here.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  const parsed = Number(text.replace(",", "."));
  const valid =
    text.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max &&
    (!integer || Number.isInteger(parsed));
  return (
    <Field
      id={id}
      label={label}
      suffix={unit}
      error={valid ? undefined : t(integer ? "outOfRangeWhole" : "outOfRange", { min, max })}
    >
      <Input
        inputMode={integer ? "numeric" : "decimal"}
        className="w-24"
        value={text}
        step={step}
        onChange={(event) => {
          setText(event.target.value);
          const next = Number(event.target.value.replace(",", "."));
          if (
            event.target.value.trim() !== "" && Number.isFinite(next) && next >= min && next <= max &&
            (!integer || Number.isInteger(next))
          )
            onChange(next);
        }}
        onBlur={() => {
          if (!valid) setText(String(value));
        }}
      />
    </Field>
  );
}

export function CheckControl({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-8 cursor-pointer items-center gap-2 text-ui pointer-coarse:min-h-11"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span>{label}</span>
    </label>
  );
}

export function SelectControl<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: V;
  options: readonly { value: V; label: string; disabled?: boolean }[];
  onChange: (value: V) => void;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <NativeSelect value={value} onChange={(event) => onChange(event.target.value as V)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** A group of choices out of a fixed list, kept in the list's order. */
export function ChoiceList<V extends string>({
  id,
  legend,
  all,
  chosen,
  labels,
  onChange,
}: {
  id: string;
  legend: string;
  all: readonly V[];
  chosen: readonly V[];
  labels: (value: V) => string;
  onChange: (chosen: V[]) => void;
}) {
  return (
    <fieldset className="space-y-0.5">
      <legend className="mb-1 text-ui">{legend}</legend>
      {all.map((value) => (
        <CheckControl
          key={value}
          id={`${id}-${value}`}
          label={labels(value)}
          checked={chosen.includes(value)}
          onChange={(checked) =>
            onChange(all.filter((item) => (item === value ? checked : chosen.includes(item))))
          }
        />
      ))}
    </fieldset>
  );
}

/** A small whole number in a row (a column's width): kept while typed, applied when in range. */
export function InlineNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    if (Number(text) !== value) setText(String(value));
  }
  const parsed = Number(text);
  const valid = Number.isInteger(parsed) && parsed >= min && parsed <= max;
  return (
    <Input
      aria-label={label}
      aria-invalid={valid ? undefined : true}
      className="w-14"
      inputMode="numeric"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value);
        if (Number.isInteger(next) && next >= min && next <= max) onChange(next);
      }}
      onBlur={() => {
        if (!valid) setText(String(value));
      }}
    />
  );
}

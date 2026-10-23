import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Text shown right after the control, e.g. a unit ("days"). */
  suffix?: React.ReactNode;
  children: React.ReactElement<ControlProps>;
};

/** Form group: label, control, helper or error text, wired for screen readers. */
function Field({ id, label, hint, error, className, suffix, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  });
  return (
    <div className={cn("space-y-1.5 [.brand_&]:space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {suffix ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {control}
          <span className="text-ui text-muted-foreground">{suffix}</span>
        </div>
      ) : (
        control
      )}
      {error ? (
        <p id={`${id}-error`} className="text-ui-sm text-destructive-text [.brand_&]:text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-ui-sm text-muted-foreground [.brand_&]:text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Field };

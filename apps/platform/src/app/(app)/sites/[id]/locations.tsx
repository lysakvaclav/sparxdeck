"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  EditIcon,
  MoreIcon,
  TrashIcon,
} from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ActionResult, ErrorCode } from "@/lib/errors";
import { locationNameSchema } from "@/lib/validation";
import { createLocation, deleteLocation, renameLocation, reorderLocations } from "../actions";

type Location = { id: string; name: string };

/**
 * A site's locations in route order. Managers add, rename, delete and move them
 * up or down (applied immediately, saved in the background, reverted on error).
 * The parent remounts this with a new key whenever the server data changes.
 */
export function Locations({
  siteId,
  initial,
  editable,
}: {
  siteId: string;
  initial: Location[];
  editable: boolean;
}) {
  const t = useTranslations("locations");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void, onError?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess?.();
      else {
        onError?.();
        setError(result.fieldErrors?.name ?? result.error);
      }
    });
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    run(
      () =>
        reorderLocations(
          siteId,
          next.map((item) => item.id),
        ),
      undefined,
      () => setItems(previous),
    );
  }

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <ol className="overflow-hidden rounded-lg shadow-elevation-0">
          {items.map((location, index) => (
            <li
              key={location.id}
              className="flex min-h-11 items-center gap-2.5 bg-card py-0.5 ps-4 pe-1 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none even:bg-muted pointer-coarse:min-h-14"
            >
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-node-location px-1 text-ui-xs text-white tabular-nums">
                {index + 1}
              </span>
              {editing === location.id ? (
                <NameForm
                  id={`location-${location.id}`}
                  label={t("renameLabel", { name: location.name })}
                  initial={location.name}
                  submitLabel={t("rename")}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name) =>
                    run(
                      () => renameLocation(location.id, { name }),
                      () => setEditing(null),
                    )
                  }
                />
              ) : (
                <>
                  <span className="min-w-0 flex-1 break-words">{location.name}</span>
                  {editable && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("moveUp", { name: location.name })}
                        disabled={pending || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("moveDown", { name: location.name })}
                        disabled={pending || index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={t("actions", { name: location.name })}
                            disabled={pending}
                          >
                            <MoreIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(location.id)}>
                            <EditIcon />
                            {t("rename")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive-text [&_svg]:text-destructive-text"
                            onSelect={() => setDeleting(location)}
                          >
                            <TrashIcon />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md bg-muted px-4 py-4 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}

      {error && !deleting && <Alert variant="error">{tErr(error)}</Alert>}

      {editable && (
        <NameForm
          id="location-new"
          label={t("name")}
          placeholder={t("namePlaceholder")}
          submitLabel={t("add")}
          icon
          pending={pending}
          clearOnSubmit
          onSubmit={(name, clear) => run(() => createLocation(siteId, { name }), clear)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setError(undefined);
          }
        }}
        title={t("deleteTitle")}
        description={t("deleteBody", { name: deleting?.name ?? "" })}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={() => {
          const target = deleting;
          if (target)
            run(
              () => deleteLocation(target.id),
              () => setDeleting(null),
            );
        }}
      >
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </ConfirmDialog>
    </div>
  );
}

/** Single-field form for a location name (add and rename). */
function NameForm({
  id,
  label,
  initial = "",
  placeholder,
  submitLabel,
  icon = false,
  pending,
  clearOnSubmit = false,
  onSubmit,
  onCancel,
}: {
  id: string;
  label: string;
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  icon?: boolean;
  pending: boolean;
  clearOnSubmit?: boolean;
  onSubmit: (name: string, clear: () => void) => void;
  onCancel?: () => void;
}) {
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState<ErrorCode>();

  return (
    <form
      noValidate
      className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = locationNameSchema.safeParse({ name: value });
        if (!parsed.success) {
          setInvalid(parsed.error.issues[0]?.message as ErrorCode);
          return;
        }
        setInvalid(undefined);
        onSubmit(parsed.data.name, () => clearOnSubmit && setValue(""));
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          autoFocus={Boolean(onCancel)}
          maxLength={200}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel) onCancel();
          }}
        />
        {invalid && (
          <p id={`${id}-error`} className="text-ui-sm text-destructive-text">
            {tErr(invalid)}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        )}
        <Button type="submit" variant={onCancel ? "primary" : "outline"} disabled={pending}>
          {icon && <AddIcon />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

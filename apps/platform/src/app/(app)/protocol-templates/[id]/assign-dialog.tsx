"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PeopleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setProtocolTemplateAssignments } from "../actions";

// Which customers and device types a template is for (part 22, stage D).
// A protocol uses its customer's template, else its device type's (when the
// inspection is all one type), else the company's default. A customer or a
// type has one template: choosing it here takes it from the other one.

export type AssignOption = {
  id: string;
  name: string;
  /** Assigned to this template. */
  mine: boolean;
  /** The other template it is assigned to now. */
  elsewhere: string | null;
};

function OptionList({
  legend,
  options,
  chosen,
  onToggle,
  idPrefix,
}: {
  legend: string;
  options: AssignOption[];
  chosen: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  idPrefix: string;
}) {
  const t = useTranslations("protocolTemplates.assign");
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg shadow-[inset_0_0_0_1px_var(--border)]">
        {options.map((option) => (
          <li key={option.id}>
            <label htmlFor={`${idPrefix}-${option.id}`} className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 text-ui pointer-coarse:min-h-11">
              <Checkbox
                id={`${idPrefix}-${option.id}`}
                checked={chosen.has(option.id)}
                onCheckedChange={(value) => onToggle(option.id, value === true)}
              />
              <span className="min-w-0 flex-1">{option.name}</span>
              {option.elsewhere && !option.mine && (
                <span className="text-ui-sm text-muted-foreground">{t("now", { template: option.elsewhere })}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function AssignDialog({
  templateId,
  customers,
  deviceTypes,
  disabled,
}: {
  templateId: string;
  customers: AssignOption[];
  deviceTypes: AssignOption[];
  disabled: boolean;
}) {
  const t = useTranslations("protocolTemplates.assign");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chosenCustomers, setChosenCustomers] = useState(() => new Set(customers.filter((c) => c.mine).map((c) => c.id)));
  const [chosenTypes, setChosenTypes] = useState(() => new Set(deviceTypes.filter((d) => d.mine).map((d) => d.id)));
  const [pending, start] = useTransition();
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? customers.filter((customer) => customer.name.toLocaleLowerCase().includes(query)) : customers;
  }, [customers, search]);
  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };
  const count = customers.filter((c) => c.mine).length + deviceTypes.filter((d) => d.mine).length;

  const save = () =>
    start(async () => {
      const result = await setProtocolTemplateAssignments(templateId, [...chosenCustomers], [...chosenTypes]);
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      toast(t("saved"), "success");
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)} title={disabled ? t("needsPublished") : undefined}>
        <PeopleIcon />
        {count > 0 ? t("buttonCount", { count }) : t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} icon={PeopleIcon} closeLabel={tCommon("close")}>
        <div className="space-y-4">
          <p className="text-ui text-muted-foreground">{t("explain")}</p>
          <section className="space-y-2" aria-labelledby="assign-customers">
            <h3 id="assign-customers" className="text-ui font-semibold">
              {t("customers")}
            </h3>
            {customers.length === 0 ? (
              <p className="text-ui text-muted-foreground">{t("noCustomers")}</p>
            ) : (
              <>
                <label htmlFor="assign-search" className="sr-only">
                  {t("search")}
                </label>
                <Input id="assign-search" placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} />
                <OptionList
                  legend={t("customers")}
                  options={shown}
                  chosen={chosenCustomers}
                  idPrefix="assign-customer"
                  onToggle={(id, on) => setChosenCustomers((set) => toggle(set, id, on))}
                />
              </>
            )}
          </section>
          <section className="space-y-2" aria-labelledby="assign-types">
            <h3 id="assign-types" className="text-ui font-semibold">
              {t("deviceTypes")}
            </h3>
            <p className="text-ui-sm text-muted-foreground">{t("deviceTypesHint")}</p>
            <OptionList
              legend={t("deviceTypes")}
              options={deviceTypes}
              chosen={chosenTypes}
              idPrefix="assign-type"
              onToggle={(id, on) => setChosenTypes((set) => toggle(set, id, on))}
            />
          </section>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button disabled={pending} onClick={save}>
              {t("save")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

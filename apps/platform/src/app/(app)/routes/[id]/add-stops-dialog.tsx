"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AddIcon, OfficeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { sortSites, type SiteMapRow } from "@/lib/site-map";
import { cn } from "@/lib/utils";
import { STATUS_STYLE } from "../../map/site-map-canvas";

/** Lower case without accents: "Lipová" is found by "lipova". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The company's buildings to add to a route (part 23): most urgent first, as on
 * the map of buildings; ones already in the route are marked, the limit counted.
 */
export function AddStopsDialog({
  sites,
  inRoute,
  left,
  max,
  onAdd,
}: {
  sites: SiteMapRow[];
  inRoute: ReadonlySet<string>;
  /** How many more stops fit. */
  left: number;
  max: number;
  onAdd: (siteIds: string[]) => Promise<boolean>;
}) {
  const t = useTranslations("routes");
  const tMap = useTranslations("siteMap");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const sorted = useMemo(() => sortSites(sites, locale), [sites, locale]);
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return sorted;
    return sorted.filter((site) => {
      const text = fold([site.name, site.customer_name, site.address].filter(Boolean).join(" "));
      return words.every((word) => text.includes(word));
    });
  }, [sorted, query]);

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => (on ? [...current, id] : current.filter((item) => item !== id)));

  return (
    <>
      <Button
        size="sm"
        disabled={left <= 0}
        title={left <= 0 ? t("stops.full", { max }) : undefined}
        onClick={() => {
          setChosen([]);
          setQuery("");
          setOpen(true);
        }}
      >
        <AddIcon />
        {t("stops.add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("add.title")} icon={OfficeIcon} closeLabel={tCommon("close")}>
        <form
          className="space-y-2.5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const ok = await onAdd(chosen);
            setPending(false);
            if (ok) setOpen(false);
          }}
        >
          <label htmlFor="add-stops-search" className="sr-only">
            {t("add.search")}
          </label>
          <Input
            id="add-stops-search"
            type="search"
            autoFocus
            placeholder={t("add.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="text-ui-sm text-muted-foreground" aria-live="polite">
            {t("add.left", { count: Math.max(0, left - chosen.length) })}
          </p>
          <ul className="max-h-[50vh] scrollbar-thin overflow-y-auto rounded-lg shadow-[inset_0_0_0_1px_var(--border)]">
            {shown.length === 0 && <li className="p-2.5 text-ui text-muted-foreground">{t("add.none")}</li>}
            {shown.map((site) => {
              const already = inRoute.has(site.site_id);
              const checked = already || chosen.includes(site.site_id);
              const full = !checked && chosen.length >= left;
              return (
                <li key={site.site_id} className="shadow-[inset_0_-1px_0_var(--border)] last:shadow-none">
                  <label
                    className={cn(
                      "flex items-start gap-2.5 px-2.5 py-2 pointer-coarse:min-h-14",
                      already || full ? "cursor-default" : "cursor-pointer hover:bg-accent",
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      disabled={already || full}
                      onCheckedChange={(value) => toggle(site.site_id, value === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{site.name}</span>
                      <span className="block truncate text-ui-sm text-muted-foreground">
                        {[site.customer_name, site.address].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end text-ui-sm">
                      <span className="flex items-center gap-1">
                        <span aria-hidden="true" style={{ color: STATUS_STYLE[site.status].color }}>
                          {STATUS_STYLE[site.status].glyph}
                        </span>
                        {tMap(`status.${site.status}`)}
                      </span>
                      {already ? (
                        <span className="text-muted-foreground">{t("add.inRoute")}</span>
                      ) : (
                        site.latitude === null && <span className="text-muted-foreground">{t("add.noPoint")}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || chosen.length === 0}>
              {t("add.submit", { count: chosen.length })}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

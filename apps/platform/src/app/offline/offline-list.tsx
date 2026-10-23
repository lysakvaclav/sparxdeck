"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRightIcon, RefreshIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { devicesWithDrafts, readOps } from "@/lib/client/check-drafts";
import { listPacks } from "@/lib/client/offline-store";
import { queuedPhotoInspections } from "@/lib/client/photo-queue";

type Entry = {
  id: string;
  siteName: string;
  customerName: string | null;
  fetchedAt: string;
  waiting: number;
};

/** The inspections saved in this phone; each opens without a signal. */
export function OfflineList() {
  const t = useTranslations("offline");
  const format = useFormatter();
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [packs, photos] = await Promise.all([listPacks(), queuedPhotoInspections()]);
      if (cancelled) return;
      setEntries(
        packs.map(({ pack }) => ({
          id: pack.inspection.id,
          siteName: pack.inspection.siteName,
          customerName: pack.inspection.customerName,
          fetchedAt: pack.fetchedAt,
          waiting:
            devicesWithDrafts(pack.inspection.id).length +
            readOps(pack.inspection.id).length +
            (photos[pack.inspection.id] ?? 0),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        {entries === null ? null : entries.length === 0 ? (
          <p className="px-[15px] py-4 text-ui text-muted-foreground">{t("none")}</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                {/* A full page load: the service worker serves the saved page. */}
                <a
                  href={`/inspections/${entry.id}`}
                  className="flex min-h-14 items-center gap-3 px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)] hover:bg-[rgb(191_204_214/0.3)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{entry.siteName}</span>
                    <span className="block truncate text-ui-sm text-muted-foreground">
                      {[
                        entry.customerName,
                        t("savedAt", {
                          time: format.dateTime(new Date(entry.fetchedAt), {
                            dateStyle: "short",
                            timeStyle: "short",
                          }),
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {entry.waiting > 0 && (
                      <span className="block text-ui-sm text-warning-text">
                        {t("waiting", { count: entry.waiting })}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="shrink-0 text-subtle rtl:rotate-180" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshIcon />
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </>
  );
}

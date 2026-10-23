"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { UndoIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { undoImport } from "./actions";

export type ImportHistoryItem = {
  id: string;
  fileName: string;
  createdAt: string;
  by: string | null;
  customers: number;
  sites: number;
  devices: number;
  undoneAt: string | null;
};

/** Past imports; one that nobody has worked with yet can be undone. */
export function ImportHistory({ items }: { items: ImportHistoryItem[] }) {
  const t = useTranslations("import.history");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [undoing, setUndoing] = useState<ImportHistoryItem | null>(null);
  const [pending, startTransition] = useTransition();
  const when = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  function confirm() {
    const item = undoing;
    if (!item) return;
    startTransition(async () => {
      const result = await undoImport(item.id);
      setUndoing(null);
      if (!result.ok) {
        toast(tErr(result.error), "danger");
        return;
      }
      toast(t("undoDone", { file: item.fileName }), "success");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")} <span className="font-normal text-muted-foreground">({items.length})</span>
        </CardTitle>
      </CardHeader>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-ui text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>{t("table.date")}</TableHeaderCell>
              <TableHeaderCell>{t("table.file")}</TableHeaderCell>
              <TableHeaderCell className="hidden md:table-cell">{t("table.by")}</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">
                {t("table.result")}
              </TableHeaderCell>
              <TableHeaderCell className="text-end">
                <span className="sr-only">{t("undo")}</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">{when(item.createdAt)}</TableCell>
                <TableCell className="max-w-0">
                  <span className="block truncate">{item.fileName}</span>
                  <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                    {t("result", {
                      customers: item.customers,
                      sites: item.sites,
                      devices: item.devices,
                    })}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  {item.by ?? "—"}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {t("result", {
                    customers: item.customers,
                    sites: item.sites,
                    devices: item.devices,
                  })}
                </TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  {item.undoneAt ? (
                    <Badge>{t("undone", { date: when(item.undoneAt) })}</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setUndoing(item)}>
                      <UndoIcon />
                      {t("undo")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={undoing !== null}
        onOpenChange={(open) => !open && !pending && setUndoing(null)}
        title={t("undoTitle")}
        description={t("undoBody", { file: undoing?.fileName ?? "" })}
        confirmLabel={t("undoConfirm")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </Card>
  );
}

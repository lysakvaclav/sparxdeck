"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CrossIcon,
  ListDetailViewIcon,
  MaximizeIcon,
  MinimizeIcon,
  SearchIcon,
  ThIcon,
} from "@/components/icons";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { DueCell } from "@/components/app/device-badges";
import {
  ancestors,
  NODE_KINDS,
  normalize,
  type Graph,
  type GraphNode,
  type NodeKind,
} from "@/lib/graph";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type BottomTab = "preview" | "objects";

const LIST_LIMIT = 500;
const MIN_HEIGHT = 140;

/**
 * Panel under the map, as in Foundry's lineage view: "Preview" shows the selected
 * object's contents as a table, "Objects" lists every object with its state.
 * Resizable by dragging its top edge; can be maximised.
 */
export function BottomPanel({
  graph,
  node,
  hidden,
  visible,
  tab,
  onTab,
  height,
  onHeight,
  maximized,
  onToggleMaximize,
  onClose,
  onFocus,
}: {
  graph: Graph;
  node: GraphNode | undefined;
  hidden: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  tab: BottomTab;
  onTab: (tab: BottomTab) => void;
  height: number;
  onHeight: (height: number) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  onFocus: (id: string) => void;
}) {
  const t = useTranslations("graph.bottom");
  const tGraph = useTranslations("graph");
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  const tabs: { id: BottomTab; label: string; icon: typeof ThIcon }[] = [
    { id: "preview", label: t("preview"), icon: ThIcon },
    { id: "objects", label: t("objects"), icon: ListDetailViewIcon },
  ];

  return (
    <section
      ref={panelRef}
      aria-label={t("label")}
      className="relative flex shrink-0 flex-col bg-background shadow-[0_-1px_0_var(--border),0_-2px_6px_rgb(16_22_26/0.08)]"
      style={{ height: maximized ? "72%" : height }}
    >
      {!maximized && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("resize")}
          tabIndex={0}
          className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize focus-visible:bg-primary/30"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { startY: event.clientY, startHeight: height };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const parent = panelRef.current?.parentElement?.clientHeight ?? 800;
            const next = drag.current.startHeight - (event.clientY - drag.current.startY);
            onHeight(Math.round(Math.min(parent - 120, Math.max(MIN_HEIGHT, next))));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") onHeight(height + 20);
            if (event.key === "ArrowDown") onHeight(Math.max(MIN_HEIGHT, height - 20));
          }}
        />
      )}
      <div
        role="tablist"
        className="flex h-[34px] shrink-0 items-stretch bg-muted shadow-[inset_0_-1px_0_var(--border)]"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTab(item.id)}
            className={cn(
              "flex items-center gap-[7px] px-3.5 text-ui shadow-[inset_-1px_0_0_var(--border)] transition-colors",
              tab === item.id
                ? "bg-background text-foreground shadow-[inset_-1px_0_0_var(--border),inset_0_2px_0_var(--primary)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className={tab === item.id ? "text-link" : undefined} />
            {item.label}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-0.5 pe-1">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={maximized ? t("restore") : t("maximize")}
            onClick={onToggleMaximize}
          >
            {maximized ? <MinimizeIcon /> : <MaximizeIcon />}
          </Button>
          <Button variant="ghost" size="iconSm" aria-label={t("close")} onClick={onClose}>
            <CrossIcon />
          </Button>
        </div>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 scrollbar-thin overflow-auto">
        {tab === "preview" ? (
          <Preview graph={graph} node={node} onFocus={onFocus} />
        ) : (
          <ObjectList
            graph={graph}
            hidden={hidden}
            visible={visible}
            onFocus={onFocus}
            kindLabel={(kind) => tGraph(`kinds.${kind}`)}
          />
        )}
      </div>
    </section>
  );
}

function Preview({
  graph,
  node,
  onFocus,
}: {
  graph: Graph;
  node: GraphNode | undefined;
  onFocus: (id: string) => void;
}) {
  const t = useTranslations("graph.bottom");
  if (!node) {
    return <p className="px-[15px] py-8 text-center text-muted-foreground">{t("noSelection")}</p>;
  }
  const children = node.childIds.map((id) => graph.nodes.get(id)!).filter(Boolean);
  if (children.length === 0) {
    return (
      <p className="px-[15px] py-8 text-center text-muted-foreground">
        {t("noChildren", { name: node.label })}
      </p>
    );
  }
  // A building holds locations and devices without a location: one table per kind.
  const groups = NODE_KINDS.map((kind) => ({
    kind,
    rows: children.filter((child) => child.kind === kind),
  })).filter((group) => group.rows.length > 0);
  return groups.map((group) => (
    <KindTable
      key={group.kind}
      graph={graph}
      kind={group.kind}
      rows={group.rows}
      onFocus={onFocus}
    />
  ));
}

function KindTable({
  graph,
  kind,
  rows,
  onFocus,
}: {
  graph: Graph;
  kind: NodeKind;
  rows: GraphNode[];
  onFocus: (id: string) => void;
}) {
  const t = useTranslations("graph.bottom");
  const tCommon = useTranslations("common");
  const tGraph = useTranslations("graph");
  const field = (child: GraphNode, key: string) =>
    child.fields.find((entry) => entry.key === key)?.value?.replaceAll("\n", " ") ?? null;
  const countOf = (child: GraphNode, childKind: NodeKind) =>
    child.childIds.filter((id) => graph.nodes.get(id)?.kind === childKind).length;
  const empty = <span className="text-subtle">—</span>;
  const type = OBJECT_TYPES[kind];

  return (
    <Table>
      <TableHead className="sticky top-0 z-[1]">
        <tr>
          {kind === "location" && (
            <TableHeaderCell className="w-16 text-end">{t("columns.order")}</TableHeaderCell>
          )}
          <TableHeaderCell>
            {kind === "device" ? t("columns.label") : t("columns.name")}
          </TableHeaderCell>
          {kind === "site" && (
            <>
              <TableHeaderCell>{t("columns.address")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.access")}</TableHeaderCell>
              <TableHeaderCell className="text-end">{t("columns.locations")}</TableHeaderCell>
            </>
          )}
          {(kind === "site" || kind === "location") && (
            <TableHeaderCell className="text-end">{t("columns.devices")}</TableHeaderCell>
          )}
          {kind === "device" && (
            <>
              <TableHeaderCell>{t("columns.serial")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.nextDue")}</TableHeaderCell>
            </>
          )}
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((child, index) => (
          <TableRow
            key={child.id}
            className="cursor-pointer hover:bg-[rgb(191_204_214/0.3)]"
            onClick={() => onFocus(child.id)}
          >
            {kind === "location" && (
              <TableCell className="text-end text-muted-foreground tabular-nums">
                {index + 1}
              </TableCell>
            )}
            <TableCell className="max-w-0 min-w-48">
              <span className="flex min-w-0 items-center gap-2">
                <type.icon className={type.text} />
                <span className="truncate">{child.label}</span>
              </span>
            </TableCell>
            {kind === "site" && (
              <>
                <TableCell className="max-w-0 min-w-48 truncate">
                  {field(child, "address") ?? empty}
                </TableCell>
                <TableCell className="max-w-0 min-w-48 truncate text-muted-foreground">
                  {field(child, "accessNotes") ?? empty}
                </TableCell>
                <TableCell className="w-24 text-end tabular-nums">
                  {countOf(child, "location")}
                </TableCell>
              </>
            )}
            {(kind === "site" || kind === "location") && (
              <TableCell className="w-24 text-end tabular-nums">
                {countOf(child, "device")}
              </TableCell>
            )}
            {kind === "device" && (
              <>
                <TableCell className="max-w-0 min-w-40 truncate font-mono text-ui-sm">
                  {field(child, "serialNumber") ?? (
                    <span className="font-sans text-ui text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="w-56">
                  <DueCell
                    status={(field(child, "status") ?? "active") as DeviceStatus}
                    nextDue={field(child, "nextDue")}
                    state={child.due ?? "never"}
                  />
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
      <caption className="caption-bottom px-[15px] py-2 text-start text-ui-sm text-muted-foreground">
        {tGraph(`kindsPlural.${kind}`)}: {tCommon("results", { count: rows.length })}
      </caption>
    </Table>
  );
}

function ObjectList({
  graph,
  hidden,
  visible,
  onFocus,
  kindLabel,
}: {
  graph: Graph;
  hidden: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  onFocus: (id: string) => void;
  kindLabel: (kind: GraphNode["kind"]) => string;
}) {
  const t = useTranslations("graph.bottom");
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const needle = normalize(filter.trim());
    const all: GraphNode[] = [];
    const walk = (id: string) => {
      const node = graph.nodes.get(id)!;
      if (!needle || node.searchText.includes(needle)) all.push(node);
      for (const child of node.childIds) walk(child);
    };
    for (const root of graph.roots) walk(root);
    return all;
  }, [graph, filter]);

  const state = (node: GraphNode) => {
    if (hidden.has(node.id) || ancestors(graph, node.id).some((id) => hidden.has(id)))
      return "hidden";
    return visible.has(node.id) ? "visible" : "collapsed";
  };

  return (
    <>
      <div className="sticky start-0 top-0 z-[2] flex items-center gap-3 bg-background px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t("filter")}
            placeholder={t("filter")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="ps-[30px] [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {rows.length > LIST_LIMIT && (
          <span className="text-ui-sm text-muted-foreground">
            {t("more", { count: LIST_LIMIT, total: rows.length })}
          </span>
        )}
      </div>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell className="w-28">{t("columns.type")}</TableHeaderCell>
            <TableHeaderCell>{t("columns.name")}</TableHeaderCell>
            <TableHeaderCell>{t("columns.parent")}</TableHeaderCell>
            <TableHeaderCell className="w-28 text-end">{t("columns.children")}</TableHeaderCell>
            <TableHeaderCell className="w-32">{t("columns.state")}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.slice(0, LIST_LIMIT).map((node) => {
            const type = OBJECT_TYPES[node.kind];
            const current = state(node);
            const parent = node.parentId ? graph.nodes.get(node.parentId) : undefined;
            return (
              <TableRow
                key={node.id}
                className="cursor-pointer hover:bg-[rgb(191_204_214/0.3)]"
                onClick={() => onFocus(node.id)}
              >
                <TableCell>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <type.icon className={type.text} />
                    {kindLabel(node.kind)}
                  </span>
                </TableCell>
                <TableCell className="max-w-0 min-w-48 truncate">{node.label}</TableCell>
                <TableCell className="max-w-0 min-w-40 truncate text-muted-foreground">
                  {parent?.label ?? "—"}
                </TableCell>
                <TableCell className="text-end tabular-nums">{node.childIds.length}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      current === "visible"
                        ? "success"
                        : current === "hidden"
                          ? "warning"
                          : "default"
                    }
                  >
                    {t(`states.${current}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

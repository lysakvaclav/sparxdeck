"use client";

import { useMemo, useState, type RefObject } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import {
  CaretRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CrossIcon,
  DuplicateIcon,
  EditIcon,
  ExpandAllIcon,
  EyeOffIcon,
  EyeOpenIcon,
  FilterListIcon,
  KeyCommandIcon,
  LocateIcon,
  SearchIcon,
  ShareIcon,
} from "@/components/icons";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  COLOR_SWATCHES,
  DUE_GROUPS,
  NODE_KINDS,
  ancestors,
  descendants,
  groupColor,
  nodeColor,
  normalize,
  type ColorMode,
  type ColorOverrides,
  type FieldFormat,
  type Graph,
  type GraphNode,
  type NodeKind,
} from "@/lib/graph";
import { DEVICE_STATUSES } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate, isIsoDate } from "@/lib/due";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

function TypeIcon({
  kind,
  color,
  className,
}: {
  kind: NodeKind;
  color?: string;
  className?: string;
}) {
  const type = OBJECT_TYPES[kind];
  return (
    <type.icon
      className={cn(!color && type.text, className)}
      style={color ? { color } : undefined}
    />
  );
}

/** Copies a value and confirms it in a toast. */
function useCopy() {
  const t = useTranslations("graph.inspector");
  const toast = useToast();
  return async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(t("copied"), "success");
    } catch {
      toast(t("copyFailed"));
    }
  };
}

// ---------------------------------------------------------------------------
// Find bar
// ---------------------------------------------------------------------------

export function FindBar({
  inputRef,
  query,
  total,
  index,
  onQuery,
  onStep,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  total: number;
  index: number;
  onQuery: (value: string) => void;
  onStep: (by: 1 | -1) => void;
  onClose: () => void;
}) {
  const t = useTranslations("graph.find");
  return (
    <div
      role="search"
      className="absolute start-2.5 top-2.5 z-10 flex w-[min(25rem,calc(100%-1.25rem))] items-center gap-0.5 rounded-md bg-popover p-[5px] shadow-elevation-3"
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="graph-find" className="sr-only">
          {t("placeholder")}
        </label>
        <Input
          ref={inputRef}
          id="graph-find"
          autoFocus
          value={query}
          maxLength={100}
          placeholder={t("placeholder")}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onStep(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          className="ps-[30px] pe-16"
        />
        <span
          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-ui-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {query.trim()
            ? total === 0
              ? t("none")
              : t("results", { current: index >= 0 ? index + 1 : 0, total })
            : ""}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("previous")}
        disabled={!total}
        onClick={() => onStep(-1)}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("next")}
        disabled={!total}
        onClick={() => onStep(1)}
      >
        <ChevronDownIcon />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("close")} onClick={onClose}>
        <CrossIcon />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend with colour editor
// ---------------------------------------------------------------------------

type LegendGroup = {
  key: string;
  label: string;
  color: string;
  count: number;
  ids: () => string[];
};

export function GraphLegend({
  graph,
  colorMode,
  overrides,
  selectedCount,
  hiddenCount,
  visibleCount,
  onSelectGroup,
  onShowAll,
  onColor,
  onResetColors,
}: {
  graph: Graph;
  colorMode: ColorMode;
  overrides: ColorOverrides;
  selectedCount: number;
  hiddenCount: number;
  visibleCount: number;
  onSelectGroup: (ids: string[]) => void;
  onShowAll: () => void;
  onColor: (group: string, color: string) => void;
  onResetColors: () => void;
}) {
  const t = useTranslations("graph");
  const [editing, setEditing] = useState(false);

  const groups = useMemo<LegendGroup[]>(() => {
    const colorOf = (key: string) =>
      overrides[`${colorMode}:${key}`] ?? groupColor(graph, key, colorMode);
    if (colorMode === "due") {
      const byGroup = (group: string) =>
        [...graph.nodes.values()].filter((n) => (n.due ?? "none") === group).map((n) => n.id);
      return DUE_GROUPS.map((group) => ({
        key: group,
        label: t(`dueGroups.${group}`),
        color: colorOf(group),
        count: byGroup(group).length,
        ids: () => byGroup(group),
      }));
    }
    if (colorMode === "type") {
      return NODE_KINDS.map((kind) => ({
        key: kind,
        label: t(`kindsPlural.${kind}`),
        color: colorOf(kind),
        count: graph.counts[kind],
        ids: () => [...graph.nodes.values()].filter((n) => n.kind === kind).map((n) => n.id),
      }));
    }
    return graph.roots.map((id) => ({
      key: id,
      label: graph.nodes.get(id)!.label,
      color: colorOf(id),
      count: 1 + descendants(graph, id).length,
      ids: () => [id, ...descendants(graph, id)],
    }));
  }, [graph, colorMode, overrides, t]);

  const customized = Object.keys(overrides).some((key) => key.startsWith(`${colorMode}:`));

  return (
    <div
      className="absolute end-2.5 top-2.5 z-10 w-[min(380px,calc(100%-1.25rem))] rounded-md bg-popover shadow-elevation-2"
      aria-label={t("toolbar.legend")}
      role="region"
    >
      <ul className="grid max-h-60 scrollbar-thin grid-cols-2 gap-x-3 overflow-y-auto px-3 pt-2.5 pb-1.5">
        {groups.map((group) => (
          <li key={group.key} className="flex min-w-0 items-center gap-2">
            {editing ? (
              <Popover.Root>
                <Popover.Trigger
                  aria-label={t("legend.pickColor", { name: group.label })}
                  className="flex size-4 shrink-0 items-center justify-center rounded-[3px] shadow-[inset_0_0_0_1px_rgb(16_22_26/0.2)] outline-offset-2 hover:ring-2 hover:ring-primary/40"
                  style={{ background: group.color }}
                />
                <Popover.Portal>
                  <Popover.Content
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    className="z-50 grid grid-cols-8 gap-1.5 rounded-md bg-popover p-2.5 shadow-elevation-3"
                  >
                    {COLOR_SWATCHES.map((swatch) => (
                      <Popover.Close
                        key={swatch}
                        aria-label={swatch}
                        onClick={() => onColor(group.key, swatch)}
                        className={cn(
                          "size-5 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(16_22_26/0.2)] hover:scale-110",
                          swatch === group.color &&
                            "ring-2 ring-primary ring-offset-1 ring-offset-popover",
                        )}
                        style={{ background: swatch }}
                      />
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : (
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(16_22_26/0.2)]"
                style={{ background: group.color }}
              />
            )}
            <button
              type="button"
              title={t("legend.hint")}
              onClick={() => onSelectGroup(group.ids())}
              className="flex h-[26px] min-w-0 flex-1 items-center gap-1 rounded-sm text-start text-ui hover:text-link"
            >
              <span className="min-w-0 truncate">{group.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">({group.count})</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2.5 text-ui-sm">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
          className="flex items-center gap-1 text-link hover:underline"
        >
          {editing ? t("legend.doneEditing") : t("legend.editColors")}
          <CaretRightIcon
            className={cn("size-3 transition-transform", editing ? "-rotate-90" : "rotate-90")}
          />
        </button>
        {editing && customized && (
          <button type="button" onClick={onResetColors} className="text-link hover:underline">
            {t("legend.resetColors")}
          </button>
        )}
        <span className="ms-auto flex flex-wrap items-center gap-x-3 text-muted-foreground">
          <span>{t("legend.visible", { count: visibleCount, total: graph.nodes.size })}</span>
          {selectedCount > 0 && (
            <span className="text-warning-text">
              {t("legend.selected", { count: selectedCount })}
            </span>
          )}
          {hiddenCount > 0 && (
            <span className="flex items-center gap-1">
              {t("legend.hidden", { count: hiddenCount })}
              <button type="button" onClick={onShowAll} className="text-link hover:underline">
                {t("legend.showAll")}
              </button>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object tree (left panel)
// ---------------------------------------------------------------------------

export function GraphTree({
  graph,
  hidden,
  selected,
  onFocus,
  onShow,
  onShowAll,
  onClose,
}: {
  graph: Graph;
  hidden: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  onFocus: (id: string) => void;
  onShow: (id: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("graph");
  const [filter, setFilter] = useState("");
  const [kinds, setKinds] = useState<ReadonlySet<NodeKind>>(() => new Set(NODE_KINDS));
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  // While filtering (text or types): matching objects and the path to them, all expanded.
  const filtered = useMemo(() => {
    const needle = normalize(filter.trim());
    const allKinds = kinds.size === NODE_KINDS.length;
    if (!needle && allKinds) return null;
    const keep = new Set<string>();
    for (const node of graph.nodes.values()) {
      if (!kinds.has(node.kind)) continue;
      if (needle && !node.searchText.includes(needle)) continue;
      keep.add(node.id);
      for (const id of ancestors(graph, node.id)) keep.add(id);
    }
    return keep;
  }, [graph, filter, kinds]);

  const isOpen = (id: string) => (filtered ? true : open.has(id));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const subtitle = (node: GraphNode) => {
    const parts = [node.subtitle];
    if (node.kind === "customer")
      parts.push(t("node.childrenCustomer", { count: node.childIds.length }));
    return parts.filter(Boolean).join(" · ");
  };

  const renderNode = (node: GraphNode, level: number): React.ReactNode => {
    if (filtered && !filtered.has(node.id)) return null;
    const children = node.childIds.map((id) => graph.nodes.get(id)!);
    const expanded = isOpen(node.id);
    const isHidden = hidden.has(node.id);
    const isSelected = selected.has(node.id);
    const twoLine = node.kind === "customer";
    return (
      <li
        key={node.id}
        role="treeitem"
        aria-expanded={children.length ? expanded : undefined}
        aria-selected={isSelected}
      >
        <div
          className={cn(
            "group flex items-center gap-1 pe-2.5",
            twoLine ? "min-h-[38px] py-[3px]" : "min-h-[26px] pointer-coarse:min-h-11",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "hover:bg-[rgb(191_204_214/0.4)] dark:hover:bg-[rgb(92_112_128/0.3)]",
          )}
          style={{ paddingInlineStart: `${4 + level * 18}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              aria-label={
                expanded
                  ? t("tree.collapse", { name: node.label })
                  : t("tree.expand", { name: node.label })
              }
              onClick={() => toggle(node.id)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-sm",
                isSelected ? "text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CaretRightIcon
                className={cn(
                  "transition-transform duration-100 rtl:rotate-180",
                  expanded && "rotate-90 rtl:rotate-90",
                )}
              />
            </button>
          ) : (
            <span aria-hidden className="size-5 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onFocus(node.id)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-[7px] text-start outline-none",
              isHidden && "opacity-55",
            )}
          >
            <TypeIcon kind={node.kind} className={cn(isSelected && "text-white!")} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate", twoLine && "font-semibold")}>{node.label}</span>
              {twoLine && subtitle(node) && (
                <span
                  className={cn(
                    "block truncate text-ui-sm",
                    isSelected ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {subtitle(node)}
                </span>
              )}
            </span>
            {isHidden && <EyeOffIcon title={t("tree.hidden")} className="shrink-0" />}
          </button>
        </div>
        {children.length > 0 && expanded && (
          <ul role="group">{children.map((child) => renderNode(child, level + 1))}</ul>
        )}
      </li>
    );
  };

  const roots = graph.roots.map((id) => graph.nodes.get(id)!);
  const anyMatch = !filtered || filtered.size > 0;
  const hiddenNodes = [...hidden]
    .map((id) => graph.nodes.get(id))
    .filter((n): n is GraphNode => !!n);

  return (
    <aside
      aria-label={t("tree.title")}
      className="absolute inset-y-0 start-0 z-30 flex w-[min(300px,88%)] flex-col bg-background shadow-elevation-3 lg:static lg:z-auto lg:w-[280px] lg:shadow-[inset_-1px_0_0_var(--border)]"
    >
      <div className="flex shrink-0 items-center gap-1.5 p-2.5 pb-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t("tree.search")}
            placeholder={t("tree.search")}
            value={filter}
            maxLength={100}
            onChange={(event) => setFilter(event.target.value)}
            className="ps-[30px] [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={kinds.size < NODE_KINDS.length ? "primary" : "ghost"}
              size="icon"
              aria-label={t("tree.filterKinds")}
            >
              <FilterListIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("tree.filterKinds")}</DropdownMenuLabel>
            {NODE_KINDS.map((kind) => (
              <DropdownMenuCheckboxItem
                key={kind}
                checked={kinds.has(kind)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  setKinds((current) => {
                    const next = new Set(current);
                    if (checked) next.add(kind);
                    else if (next.size > 1) next.delete(kind);
                    return next;
                  })
                }
              >
                <TypeIcon kind={kind} />
                {t(`kindsPlural.${kind}`)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t("tree.close")}
          onClick={onClose}
        >
          <CrossIcon />
        </Button>
      </div>
      <Tabs defaultValue="objects" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-2.5">
          <TabsTrigger value="objects">
            {t("tree.tabObjects")}
            <span className="text-muted-foreground">({graph.nodes.size})</span>
          </TabsTrigger>
          <TabsTrigger value="hidden">
            {t("tree.tabHidden")}
            <span className="text-muted-foreground">({hiddenNodes.length})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="objects" className="min-h-0 flex-1 scrollbar-thin overflow-y-auto py-1">
          {anyMatch ? (
            <ul role="tree" aria-label={t("tree.title")}>
              {roots.map((root) => renderNode(root, 0))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-muted-foreground">{t("tree.empty")}</p>
          )}
        </TabsContent>
        <TabsContent value="hidden" className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
          {hiddenNodes.length > 0 ? (
            <>
              <div className="flex justify-end px-2.5 py-1.5 shadow-[inset_0_-1px_0_var(--border)]">
                <Button variant="outline" size="sm" onClick={onShowAll}>
                  <EyeOpenIcon />
                  {t("tree.showAll")}
                </Button>
              </div>
              <ul>
                {hiddenNodes.map((node) => (
                  <li
                    key={node.id}
                    className="flex min-h-[34px] items-center gap-[7px] ps-2.5 pe-1.5 shadow-[inset_0_-1px_0_var(--border)]"
                  >
                    <TypeIcon kind={node.kind} />
                    <span className="min-w-0 flex-1 truncate">{node.label}</span>
                    <Button variant="ghost" size="sm" onClick={() => onShow(node.id)}>
                      {t("tree.show")}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-3 py-6 text-center text-muted-foreground">{t("tree.hiddenEmpty")}</p>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Inspector (right panel)
// ---------------------------------------------------------------------------

export function GraphInspector({
  graph,
  node,
  selected,
  canEdit,
  colorMode,
  overrides,
  onFocus,
  onLocate,
  onClose,
  onHide,
  onExpand,
}: {
  graph: Graph;
  node: GraphNode | undefined;
  selected: ReadonlySet<string>;
  canEdit: boolean;
  colorMode: ColorMode;
  overrides: ColorOverrides;
  onFocus: (id: string) => void;
  onLocate: () => void;
  onClose: () => void;
  onHide: () => void;
  onExpand: () => void;
}) {
  const t = useTranslations("graph");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("devices.status");
  const format = useFormatter();
  const copy = useCopy();
  const [filter, setFilter] = useState("");

  const frame =
    "absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-xl bg-background shadow-elevation-4 lg:static lg:max-h-none lg:w-[340px] lg:rounded-none lg:shadow-[inset_1px_0_0_var(--border)]";

  if (!node) {
    const byKind = NODE_KINDS.map((kind) => ({
      kind,
      count: [...selected].filter((id) => graph.nodes.get(id)?.kind === kind).length,
    })).filter((entry) => entry.count > 0);
    return (
      <aside aria-label={t("inspector.title")} className={frame}>
        <div className="flex min-h-[50px] shrink-0 items-center gap-2 ps-[15px] pe-[5px] shadow-[inset_0_-1px_0_var(--border)]">
          <h2 className="min-w-0 flex-1 truncate">
            {t("inspector.multiple", { count: selected.size })}
          </h2>
          <Button variant="ghost" size="icon" aria-label={t("inspector.close")} onClick={onClose}>
            <CrossIcon />
          </Button>
        </div>
        <div className="space-y-3 p-[15px]">
          <ul className="space-y-1.5">
            {byKind.map(({ kind, count }) => (
              <li key={kind} className="flex items-center gap-2">
                <TypeIcon kind={kind} />
                <span className="flex-1">{t(`kindsPlural.${kind}`)}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
          <p className="text-ui-sm text-muted-foreground">{t("inspector.multipleHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onExpand}>
              <ExpandAllIcon />
              {t("toolbar.expandSelected")}
            </Button>
            <Button variant="outline" size="sm" onClick={onHide}>
              <EyeOffIcon />
              {t("toolbar.hide")}
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  const parent = node.parentId ? graph.nodes.get(node.parentId) : undefined;
  const children = node.childIds.map((id) => graph.nodes.get(id)!).filter(Boolean);
  const needle = normalize(filter.trim());
  const fields = node.fields.filter(
    (field) =>
      !needle ||
      normalize(t(`fields.${field.key}`)).includes(needle) ||
      normalize(field.value ?? "").includes(needle),
  );
  const editHref =
    node.kind === "customer"
      ? `/customers/${node.id}/edit`
      : node.kind === "site"
        ? `/sites/${node.id}/edit`
        : node.kind === "device"
          ? `/devices/${node.id}/edit`
          : null;
  const color = nodeColor(graph, node.id, colorMode, overrides);
  const dateTime = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const fieldValue = (key: string, value: string, kind?: FieldFormat) => {
    if (kind === "date" && isIsoDate(value))
      return format.dateTime(calendarDate(value), CALENDAR_FORMAT);
    if (kind === "status" && (DEVICE_STATUSES as readonly string[]).includes(value))
      return tStatus(value as DeviceStatus);
    if (kind === "mono") return <span className="font-mono text-ui-sm">{value}</span>;
    if (key === "email")
      return (
        <a className="text-link hover:underline" href={`mailto:${value}`}>
          {value}
        </a>
      );
    if (key === "phone")
      return (
        <a className="text-link hover:underline" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
          {value}
        </a>
      );
    if (key === "companyId" || key === "vatId")
      return <span className="font-mono text-ui-sm">{value}</span>;
    return value;
  };

  return (
    <aside aria-label={t("inspector.title")} className={frame} data-testid="graph-inspector">
      <div className="flex min-h-[50px] shrink-0 items-center gap-2.5 ps-[15px] pe-[5px]">
        <TypeIcon kind={node.kind} color={color} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-ui" title={node.label}>
            {node.label}
          </h2>
          <p className="truncate text-ui-sm text-muted-foreground">
            {t(`kinds.${node.kind}`)}
            {parent && ` · ${parent.label}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label={t("inspector.close")} onClick={onClose}>
          <CrossIcon />
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 px-[15px] pb-2.5">
        <Button asChild size="sm">
          <Link href={node.href}>
            <ShareIcon />
            {t("inspector.open")}
          </Link>
        </Button>
        {canEdit && editHref && (
          <Button asChild variant="outline" size="sm">
            <Link href={editHref}>
              <EditIcon />
              {tCommon("edit")}
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onLocate}>
          <LocateIcon />
          {t("inspector.locate")}
        </Button>
      </div>

      <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="justify-between gap-3">
          <TabsTrigger value="properties">
            {t("inspector.properties")}
            <span className="text-muted-foreground">({node.fields.length})</span>
          </TabsTrigger>
          <TabsTrigger value="relations">
            {t("inspector.relations")}
            <span className="text-muted-foreground">({children.length + (parent ? 1 : 0)})</span>
          </TabsTrigger>
          <TabsTrigger value="details">{t("inspector.details")}</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
          <div className="p-2.5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label={t("inspector.filter")}
                placeholder={t("inspector.filter")}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="ps-[30px] [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
          </div>
          {fields.length > 0 ? (
            <dl className="shadow-[inset_0_1px_0_var(--border)]">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="group flex items-start gap-2 px-[15px] py-[7px] shadow-[inset_0_-1px_0_var(--border)]"
                >
                  <div className="min-w-0 flex-1">
                    <dt className="font-semibold">{t(`fields.${field.key}`)}</dt>
                    <dd className="mt-0.5 break-words whitespace-pre-line">
                      {field.value ? (
                        fieldValue(field.key, field.value, field.format)
                      ) : (
                        <span className="text-subtle">{tCommon("notSet")}</span>
                      )}
                    </dd>
                  </div>
                  {field.value && (
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={t("inspector.copy", { name: t(`fields.${field.key}`) })}
                      onClick={() => copy(field.value!)}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                    >
                      <DuplicateIcon />
                    </Button>
                  )}
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-[15px] py-6 text-center text-muted-foreground">
              {t("inspector.noMatch")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="relations" className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
          {parent && (
            <section className="py-1.5 shadow-[inset_0_-1px_0_var(--border)]">
              <h3 className="px-[15px] py-1 text-ui-sm font-semibold text-muted-foreground">
                {t("inspector.parent")}
              </h3>
              <RelationRow
                node={parent}
                color={nodeColor(graph, parent.id, colorMode, overrides)}
                onFocus={onFocus}
                kindLabel={t(`kinds.${parent.kind}`)}
              />
            </section>
          )}
          <section className="py-1.5">
            <h3 className="px-[15px] py-1 text-ui-sm font-semibold text-muted-foreground">
              {t("inspector.children")} ({children.length})
            </h3>
            {children.length > 0 ? (
              <ul>
                {children.map((child) => (
                  <li key={child.id}>
                    <RelationRow
                      node={child}
                      color={nodeColor(graph, child.id, colorMode, overrides)}
                      onFocus={onFocus}
                      kindLabel={t(`kinds.${child.kind}`)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-[15px] py-2 text-muted-foreground">{t("inspector.noChildren")}</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="details" className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 p-[15px]">
            <dt className="text-muted-foreground">{t("details.type")}</dt>
            <dd>
              <Badge>{t(`kinds.${node.kind}`)}</Badge>
            </dd>
            {parent && (
              <>
                <dt className="text-muted-foreground">{t("details.parent")}</dt>
                <dd className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onFocus(parent.id)}
                    className="truncate text-link hover:underline"
                  >
                    {parent.label}
                  </button>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("details.children")}</dt>
            <dd className="tabular-nums">{children.length}</dd>
            <dt className="text-muted-foreground">{t("details.created")}</dt>
            <dd>{dateTime(node.createdAt)}</dd>
            <dt className="text-muted-foreground">{t("details.updated")}</dt>
            <dd>{dateTime(node.updatedAt)}</dd>
            <dt className="self-center text-muted-foreground">{t("details.id")}</dt>
            <dd className="min-w-0">
              <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-background py-0.5 ps-2 pe-0.5 shadow-[inset_0_0_0_1px_var(--border-strong)]">
                <code className="truncate font-mono text-ui-sm">{node.id.slice(0, 18)}…</code>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={t("details.copyId")}
                  onClick={() => copy(node.id)}
                >
                  <DuplicateIcon />
                </Button>
              </span>
            </dd>
          </dl>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function RelationRow({
  node,
  color,
  kindLabel,
  onFocus,
}: {
  node: GraphNode;
  color: string;
  kindLabel: string;
  onFocus: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      className="flex min-h-[34px] w-full items-center gap-[7px] px-[15px] text-start transition-colors hover:bg-[rgb(191_204_214/0.3)] pointer-coarse:min-h-11"
    >
      <TypeIcon kind={node.kind} color={color} />
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      <span className="shrink-0 text-ui-sm text-muted-foreground">{kindLabel}</span>
      {node.childIds.length > 0 && (
        <Badge variant="outline" className="shrink-0 tabular-nums">
          ⇔ {node.childIds.length}
        </Badge>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-background px-1.5 font-mono text-ui-sm shadow-[0_0_0_1px_rgb(16_22_26/0.1),0_1px_1px_rgb(16_22_26/0.2)]"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("graph.shortcuts");
  const tCommon = useTranslations("common");
  const sections: { title: string; items: { label: string; keys: string[] }[] }[] = [
    {
      title: t("sectionMap"),
      items: [
        { label: t("find"), keys: ["Ctrl", "F"] },
        { label: t("undo"), keys: ["Ctrl", "Z"] },
        { label: t("redo"), keys: ["Ctrl", "Y"] },
        { label: t("pan"), keys: ["H"] },
        { label: t("boxSelect"), keys: ["V"] },
        { label: t("help"), keys: ["?"] },
      ],
    },
    {
      title: t("sectionSelection"),
      items: [
        { label: t("select"), keys: [t("click")] },
        { label: t("addToSelection"), keys: ["Ctrl", t("click")] },
        { label: t("selectAll"), keys: ["Ctrl", "A"] },
        { label: t("hide"), keys: ["Delete"] },
        { label: t("clear"), keys: ["Esc"] },
        { label: t("open"), keys: [t("doubleClick")] },
      ],
    },
    {
      title: t("sectionView"),
      items: [
        { label: t("zoom"), keys: [t("mouseWheel")] },
        { label: t("move"), keys: [t("drag")] },
      ],
    },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      icon={KeyCommandIcon}
      closeLabel={tCommon("close")}
    >
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-1.5">{section.title}</h3>
            <ul className="rounded-md bg-card shadow-elevation-0">
              {section.items.map((item) => (
                <li
                  key={item.label}
                  className="flex min-h-9 items-center justify-between gap-3 px-3 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
                >
                  <span>{item.label}</span>
                  <Keys keys={item.keys} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

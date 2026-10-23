"use client";

import { createContext, memo, useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ShareIcon,
} from "@/components/icons";
import { OBJECT_TYPES } from "@/components/app/object-types";
import type { DueState } from "@/lib/due";
import { DUE_COLOR, type NodeKind } from "@/lib/graph";
import { cn } from "@/lib/utils";

export type GraphNodeData = {
  label: string;
  subtitle: string | null;
  kind: NodeKind;
  kindLabel: string;
  color: string;
  textColor: string;
  /** Children not hidden from the view. */
  childCount: number;
  expanded: boolean;
  /** Outside the selected lineage: drawn faded. */
  dimmed: boolean;
  /** Matches the current search. */
  match: boolean;
  /** The current search result being shown. */
  current: boolean;
  hasParent: boolean;
  toggleLabel: string;
  parentLabel: string;
  openLabel: string;
  /** Cards: "3 buildings" under the title. */
  footer: string;
  /** The object's due state (devices: their own; others: the most urgent below). */
  due: DueState | null;
  /** Mark overdue and soon devices with a dot (when the colours don't show it already). */
  showDueDot: boolean;
};

export type GraphFlowNode = Node<GraphNodeData>;

/** Actions nodes trigger (kept out of node data so it stays serialisable and stable). */
export const GraphActionsContext = createContext<{
  toggle: (id: string) => void;
  focusParent: (id: string) => void;
  open: (id: string) => void;
}>({ toggle: () => {}, focusParent: () => {}, open: () => {} });

function ring(data: GraphNodeData, selected: boolean) {
  return cn(
    "transition-[opacity,box-shadow] duration-150",
    data.dimmed && "opacity-35",
    selected
      ? "shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--primary)]"
      : data.current
        ? "shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--highlight)]"
        : data.match && "shadow-[0_0_0_2px_var(--canvas),0_0_0_3px_var(--highlight)]",
  );
}

const hiddenHandle = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";

/** Red or orange dot on a device that is overdue or due soon. */
function DueDot({ data }: { data: GraphNodeData }) {
  if (!data.showDueDot || data.kind !== "device") return null;
  if (data.due !== "overdue" && data.due !== "soon") return null;
  return (
    <span
      aria-hidden
      className="ms-px me-0.5 size-2 shrink-0 rounded-full shadow-[0_0_0_1.5px_#ffffff]"
      style={{ background: DUE_COLOR[data.due] }}
    />
  );
}

/** Small white circle with the number of children, as on Foundry's lineage nodes. */
function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -end-[6px] -top-[7px] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-white px-[3px] text-[9px] leading-none font-semibold text-[#1b2533] shadow-[0_0_0_1px_rgb(16_24_40/0.25)]"
    >
      {count}
    </span>
  );
}

/** "›" at the right edge: shows or hides the node's children. */
function ExpandChevron({ id, data }: { id: string; data: GraphNodeData }) {
  const { toggle } = useContext(GraphActionsContext);
  if (data.childCount === 0) return <span aria-hidden className="w-1.5 shrink-0" />;
  return (
    <button
      type="button"
      aria-label={data.toggleLabel}
      aria-expanded={data.expanded}
      onClick={(event) => {
        event.stopPropagation();
        toggle(id);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="nodrag nopan flex h-full w-4 shrink-0 items-center justify-center rounded-e-[2px] opacity-85 hover:bg-black/20 hover:opacity-100 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-white"
    >
      {data.expanded ? (
        <ChevronLeftIcon className="size-3 rtl:rotate-180" />
      ) : (
        <ChevronRightIcon className="size-3 rtl:rotate-180" />
      )}
    </button>
  );
}

/** "‹" at the left edge: jumps to the parent object. */
function ParentChevron({ id, data }: { id: string; data: GraphNodeData }) {
  const { focusParent } = useContext(GraphActionsContext);
  if (!data.hasParent) return <span aria-hidden className="w-1.5 shrink-0" />;
  return (
    <button
      type="button"
      aria-label={data.parentLabel}
      onClick={(event) => {
        event.stopPropagation();
        focusParent(id);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="nodrag nopan flex h-full w-3.5 shrink-0 items-center justify-center rounded-s-[2px] opacity-70 hover:bg-black/20 hover:opacity-100 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-white"
    >
      <ChevronLeftIcon className="size-3 rtl:rotate-180" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lineage style
// ---------------------------------------------------------------------------

function CustomerNodeView({ id, data, selected }: NodeProps<GraphFlowNode>) {
  const Icon = OBJECT_TYPES.customer.icon;
  return (
    <div className={cn("relative h-full w-full rounded-[4px]", ring(data, selected))}>
      <div className="flex h-4 items-center justify-center rounded-t-[4px] bg-node-header">
        <Icon className="size-2.5 text-white/85" />
      </div>
      <div
        className="flex h-5 items-center rounded-b-[4px]"
        style={{ background: data.color, color: data.textColor }}
      >
        <span aria-hidden className="w-1.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate px-0.5 text-[11px] leading-none font-medium">
          {data.label}
        </span>
        <ExpandChevron id={id} data={data} />
      </div>
      <CountBadge count={data.childCount} />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={hiddenHandle}
      />
    </div>
  );
}

function BarNodeView({ id, data, selected }: NodeProps<GraphFlowNode>) {
  return (
    <div
      className={cn("relative flex h-full w-full items-center rounded-[4px]", ring(data, selected))}
      style={{ background: data.color, color: data.textColor }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={hiddenHandle}
      />
      <ParentChevron id={id} data={data} />
      <DueDot data={data} />
      <span className="min-w-0 flex-1 truncate px-0.5 text-[11px] leading-none">{data.label}</span>
      <ExpandChevron id={id} data={data} />
      <CountBadge count={data.childCount} />
      {data.kind !== "device" && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          className={hiddenHandle}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card style
// ---------------------------------------------------------------------------

function CardNodeView({ id, data, selected }: NodeProps<GraphFlowNode>) {
  const { toggle, open } = useContext(GraphActionsContext);
  const Icon = OBJECT_TYPES[data.kind].icon;
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-md bg-card text-card-foreground shadow-elevation-1",
        ring(data, selected),
      )}
    >
      {data.kind !== "customer" && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={false}
          className={hiddenHandle}
        />
      )}
      <div aria-hidden className="h-[3px]" style={{ background: data.color }} />
      <div className="flex items-start gap-2 px-2 pt-1.5">
        <Icon className="mt-px" style={{ color: data.color }} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[12px] leading-4 font-semibold">
            <span className="truncate">{data.label}</span>
            <DueDot data={data} />
          </p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {data.subtitle ?? data.kindLabel}
          </p>
        </div>
        <button
          type="button"
          aria-label={data.openLabel}
          onClick={(event) => {
            event.stopPropagation();
            open(id);
          }}
          className="nodrag nopan -me-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--btn-icon)] hover:bg-accent"
        >
          <ShareIcon className="size-3" />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[18px] items-center justify-between ps-2 text-[11px] text-muted-foreground shadow-[inset_0_1px_0_var(--border)]">
        <span className="truncate">{data.footer}</span>
        {data.childCount > 0 && (
          <button
            type="button"
            aria-label={data.toggleLabel}
            aria-expanded={data.expanded}
            onClick={(event) => {
              event.stopPropagation();
              toggle(id);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            className="nodrag nopan flex h-full w-6 items-center justify-center hover:bg-accent"
          >
            {data.expanded ? (
              <ChevronUpIcon className="size-3" />
            ) : (
              <ChevronDownIcon className="size-3" />
            )}
          </button>
        )}
      </div>
      {data.kind !== "device" && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          className={hiddenHandle}
        />
      )}
    </div>
  );
}

export const LINEAGE_NODE_TYPES = {
  customer: memo(CustomerNodeView),
  site: memo(BarNodeView),
  location: memo(BarNodeView),
  device: memo(BarNodeView),
};

export const CARD_NODE_TYPES = {
  customer: memo(CardNodeView),
  site: memo(CardNodeView),
  location: memo(CardNodeView),
  device: memo(CardNodeView),
};

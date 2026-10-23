"use client";

import "@xyflow/react/dist/base.css";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import {
  AlignmentLeftIcon,
  AlignmentTopIcon,
  CaretDownIcon,
  DiagramTreeIcon,
  EraserIcon,
  ExpandAllIcon,
  EyeOffIcon,
  EyeOpenIcon,
  FlowsIcon,
  GridViewIcon,
  HorizontalDistributionIcon,
  LayoutAutoIcon,
  LocateIcon,
  MoveIcon,
  PanelTableIcon,
  RedoIcon,
  SearchIcon,
  SelectIcon,
  SelectionIcon,
  TintIcon,
  UndoIcon,
  VerticalDistributionIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomToFitIcon,
} from "@/components/icons";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpacer,
  ToolbarToggle,
} from "@/components/app/toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  autoLayout,
  buildGraph,
  defaultView,
  lineage,
  nodeColor,
  nodeSize,
  readableText,
  resolvePositions,
  reveal,
  sanitizeView,
  searchNodes,
  visibleIds,
  type ColorMode,
  type ColorOverrides,
  type GraphData,
  type GraphNode,
  type NodeStyle,
  type Point,
  type ViewState,
} from "@/lib/graph";
import { cn } from "@/lib/utils";
import { BottomPanel, type BottomTab } from "./graph-bottom";
import { GraphMenus, type PanelToggles } from "./graph-menus";
import {
  CARD_NODE_TYPES,
  GraphActionsContext,
  LINEAGE_NODE_TYPES,
  type GraphFlowNode,
} from "./graph-nodes";
import { FindBar, GraphInspector, GraphLegend, GraphTree, ShortcutsDialog } from "./graph-panels";

type Props = {
  data: GraphData;
  organizationId: string;
  canEdit: boolean;
  focusId: string | null;
};

type Tool = "pan" | "select";
type Prefs = {
  tool: Tool;
  colorMode: ColorMode;
  nodeStyle: NodeStyle;
  colors: ColorOverrides;
  legend: boolean;
  tree: boolean;
  flow: boolean;
  bottom: boolean;
  bottomTab: BottomTab;
  bottomHeight: number;
};

// ---------------------------------------------------------------------------
// Undo / redo of the view (expanded, hidden, moved nodes)
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 100;

type History = { past: ViewState[]; present: ViewState; future: ViewState[] };
type HistoryAction =
  | { type: "commit"; view: ViewState }
  /** Like commit, computed from the latest view (for handlers that can run twice per render). */
  | { type: "update"; update: (view: ViewState) => ViewState }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "update":
      return historyReducer(state, { type: "commit", view: action.update(state.present) });
    case "commit":
      if (action.view === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.view,
        future: [],
      };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
  }
}

// ---------------------------------------------------------------------------
// Saved view per organization (this browser only)
// ---------------------------------------------------------------------------

const storageKey = (organizationId: string) => `sparxdeck.graph.v1.${organizationId}`;

function readStored(organizationId: string): { view?: Partial<ViewState>; prefs?: Partial<Prefs> } {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(organizationId)) ?? "{}");
  } catch {
    return {};
  }
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

export default function GraphWorkspace(props: Props) {
  return (
    <ReactFlowProvider>
      <Workspace {...props} />
    </ReactFlowProvider>
  );
}

function Workspace({ data, organizationId, canEdit, focusId }: Props) {
  const t = useTranslations("graph");
  const tDue = useTranslations("devices.due");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const { resolvedTheme } = useTheme();
  const rf = useReactFlow<GraphFlowNode>();
  const graph = useMemo(() => buildGraph(data), [data]);

  // Initial state: the saved view, with the focused object (?focus=) revealed.
  const [initial] = useState(() => {
    const stored = readStored(organizationId);
    const prefs = stored.prefs ?? {};
    const desktop = isDesktop();
    let view = sanitizeView(graph, stored.view) ?? defaultView(graph);
    const focus = focusId && graph.nodes.has(focusId) ? focusId : null;
    if (focus) view = reveal(graph, view, focus);
    const colors: ColorOverrides = {};
    for (const [key, value] of Object.entries(prefs.colors ?? {})) {
      if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) colors[key] = value;
    }
    const initialPrefs: Prefs = {
      tool: prefs.tool === "select" ? "select" : "pan",
      colorMode: (["customer", "due"] as const).find((mode) => mode === prefs.colorMode) ?? "type",
      nodeStyle: prefs.nodeStyle === "cards" ? "cards" : "lineage",
      colors,
      legend: prefs.legend ?? desktop,
      tree: desktop && (prefs.tree ?? true),
      flow: prefs.flow ?? false,
      bottom: desktop && (prefs.bottom ?? false),
      bottomTab: prefs.bottomTab === "objects" ? "objects" : "preview",
      bottomHeight:
        typeof prefs.bottomHeight === "number" && prefs.bottomHeight >= 140
          ? Math.min(prefs.bottomHeight, 900)
          : 240,
    };
    return { view, prefs: initialPrefs, focus };
  });

  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.view,
    future: [],
  });
  const view = history.present;
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initial.focus ? [initial.focus] : []),
  );
  const [live, setLive] = useState<Record<string, Point>>({});
  const liveRef = useRef<Record<string, Point>>({});
  const boxSelecting = useRef(false);
  const [tool, setTool] = useState<Tool>(initial.prefs.tool);
  const [colorMode, setColorMode] = useState<ColorMode>(initial.prefs.colorMode);
  const [nodeStyle, setNodeStyle] = useState<NodeStyle>(initial.prefs.nodeStyle);
  const [colors, setColors] = useState<ColorOverrides>(initial.prefs.colors);
  const [legendOpen, setLegendOpen] = useState(initial.prefs.legend);
  const [treeOpen, setTreeOpen] = useState(initial.prefs.tree);
  const [flow, setFlow] = useState(initial.prefs.flow);
  const [bottomOpen, setBottomOpen] = useState(initial.prefs.bottom);
  const [bottomTab, setBottomTab] = useState<BottomTab>(initial.prefs.bottomTab);
  const [bottomHeight, setBottomHeight] = useState(initial.prefs.bottomHeight);
  const [bottomMax, setBottomMax] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Remember the view and preferences in this browser.
  useEffect(() => {
    try {
      const prefs: Prefs = {
        tool,
        colorMode,
        nodeStyle,
        colors,
        legend: legendOpen,
        tree: treeOpen,
        flow,
        bottom: bottomOpen,
        bottomTab,
        bottomHeight,
      };
      window.localStorage.setItem(storageKey(organizationId), JSON.stringify({ view, prefs }));
    } catch {
      // Storage full or disabled: the map still works, it just won't be remembered.
    }
  }, [
    organizationId,
    view,
    tool,
    colorMode,
    nodeStyle,
    colors,
    legendOpen,
    treeOpen,
    flow,
    bottomOpen,
    bottomTab,
    bottomHeight,
  ]);

  // The address carries the selected object (?focus=), so it can be shared or reloaded.
  const singleId = selected.size === 1 ? [...selected][0]! : null;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (singleId) url.searchParams.set("focus", singleId);
    else url.searchParams.delete("focus");
    const next = url.pathname + url.search;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }, [singleId]);

  // ---------------------------------------------------------------------------
  // Derived layout
  // ---------------------------------------------------------------------------

  const expanded = useMemo(() => new Set(view.expanded), [view.expanded]);
  const hidden = useMemo(() => new Set(view.hidden), [view.hidden]);
  const visible = useMemo(() => visibleIds(graph, expanded, hidden), [graph, expanded, hidden]);
  const visibleSet = useMemo(() => new Set(visible), [visible]);
  const positions = useMemo(
    () =>
      resolvePositions(
        graph,
        visible,
        autoLayout(graph, expanded, hidden, nodeStyle),
        view.positions,
      ),
    [graph, visible, expanded, hidden, nodeStyle, view.positions],
  );
  const highlight = useMemo(
    () => (selected.size > 0 ? lineage(graph, selected) : null),
    [graph, selected],
  );
  const matches = useMemo(() => searchNodes(graph, query), [graph, query]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const currentMatch = findIndex >= 0 ? matches[findIndex] : undefined;
  const dark = resolvedTheme === "dark";

  const positionsFor = useCallback(
    (next: ViewState) => {
      if (next === view) return positions;
      const e = new Set(next.expanded);
      const h = new Set(next.hidden);
      const vis = visibleIds(graph, e, h);
      return resolvePositions(graph, vis, autoLayout(graph, e, h, nodeStyle), next.positions);
    },
    [graph, view, positions, nodeStyle],
  );

  /** Cards: what an object contains ("2 locations · 5 devices"), or a device's due state. */
  const footer = useCallback(
    (node: GraphNode) => {
      if (node.kind === "device") return node.due ? tDue(node.due) : t("kinds.device");
      const devices = node.childIds.filter((id) => graph.nodes.get(id)?.kind === "device").length;
      if (node.kind === "customer")
        return t("node.childrenCustomer", { count: node.childIds.length });
      if (node.kind === "location") return t("node.childrenDevices", { count: devices });
      const locations = node.childIds.length - devices;
      return devices > 0 && locations === 0
        ? t("node.childrenDevices", { count: devices })
        : [
            t("node.childrenSite", { count: locations }),
            devices > 0 ? t("node.childrenDevices", { count: devices }) : null,
          ]
            .filter(Boolean)
            .join(" · ");
    },
    [graph, t, tDue],
  );

  const nodes = useMemo<GraphFlowNode[]>(
    () =>
      visible.map((id) => {
        const node = graph.nodes.get(id)!;
        const size = nodeSize(node, nodeStyle);
        const childCount = node.childIds.filter((child) => !hidden.has(child)).length;
        const isExpanded = expanded.has(id);
        const color = nodeColor(graph, id, colorMode, colors);
        const parent = node.parentId ? graph.nodes.get(node.parentId) : undefined;
        return {
          id,
          type: node.kind,
          position: live[id] ?? positions.get(id) ?? { x: 0, y: 0 },
          width: size.width,
          height: size.height,
          selected: selected.has(id),
          ariaLabel: `${t(`kinds.${node.kind}`)}: ${node.label}`,
          data: {
            label: node.label,
            subtitle: node.subtitle,
            kind: node.kind,
            kindLabel: t(`kinds.${node.kind}`),
            color,
            textColor: readableText(color),
            childCount,
            expanded: isExpanded,
            dimmed: highlight ? !highlight.has(id) : false,
            match: matchSet.has(id),
            current: currentMatch === id,
            hasParent: !!parent,
            toggleLabel: isExpanded
              ? t("node.collapse", { name: node.label })
              : t("node.expand", { name: node.label, count: childCount }),
            parentLabel: parent ? t("node.parent", { name: parent.label }) : "",
            openLabel: t("node.open", { name: node.label }),
            footer: footer(node),
            due: node.due,
            showDueDot: colorMode !== "due",
          },
        };
      }),
    [
      graph,
      visible,
      hidden,
      expanded,
      live,
      positions,
      selected,
      highlight,
      matchSet,
      currentMatch,
      colorMode,
      colors,
      nodeStyle,
      footer,
      t,
    ],
  );

  const edges = useMemo<Edge[]>(() => {
    const base = dark ? "#5d6979" : "#a3aebb";
    const accent = dark ? "#8ab0ee" : "#3a67b0";
    return visible.flatMap((id) => {
      const parentId = graph.nodes.get(id)?.parentId;
      if (!parentId || !visibleSet.has(parentId)) return [];
      const lit = highlight ? highlight.has(id) && highlight.has(parentId) : false;
      const faded = highlight !== null && !lit;
      const color = lit ? accent : base;
      return [
        {
          id: `${parentId}->${id}`,
          source: parentId,
          target: id,
          type: "straight",
          animated: flow,
          focusable: false,
          selectable: false,
          zIndex: lit ? 1 : 0,
          style: { stroke: color, strokeWidth: lit ? 1.5 : 1, opacity: faded ? 0.2 : 1 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color },
        },
      ];
    });
  }, [graph, visible, visibleSet, highlight, flow, dark]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const commit = useCallback((next: ViewState) => dispatch({ type: "commit", view: next }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const fitSoon = useCallback(
    (ids?: string[]) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          rf.fitView({
            padding: ids ? 0.35 : 0.1,
            duration: 400,
            maxZoom: ids ? 1.4 : 1,
            nodes: ids?.map((id) => ({ id })),
          }),
        ),
      ),
    [rf],
  );

  /** Shows, selects and centres one object (expanding and un-hiding its path). */
  const focusNode = useCallback(
    (id: string) => {
      const node = graph.nodes.get(id);
      if (!node) return;
      const next = reveal(graph, view, id);
      if (next !== view) commit(next);
      setSelected(new Set([id]));
      const point = positionsFor(next).get(id);
      if (point) {
        const size = nodeSize(node, nodeStyle);
        void rf.setCenter(point.x + size.width / 2, point.y + size.height / 2, {
          zoom: Math.max(rf.getZoom(), 1.1),
          duration: 450,
        });
      }
      if (!isDesktop()) setTreeOpen(false);
    },
    [graph, view, commit, positionsFor, rf, nodeStyle],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(view.expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit({ ...view, expanded: [...next] });
    },
    [view, commit],
  );

  const actions = useMemo(
    () => ({
      toggle,
      focusParent: (id: string) => {
        const parentId = graph.nodes.get(id)?.parentId;
        if (parentId) focusNode(parentId);
      },
      open: (id: string) => {
        const href = graph.nodes.get(id)?.href;
        if (href) router.push(href);
      },
    }),
    [toggle, graph, focusNode, router],
  );

  const setExpandedFor = useCallback(
    (ids: Iterable<string>, open: boolean) => {
      const next = new Set(view.expanded);
      for (const id of ids) {
        if (!graph.nodes.get(id)?.childIds.length) continue;
        if (open) next.add(id);
        else next.delete(id);
      }
      commit({ ...view, expanded: [...next] });
    },
    [graph, view, commit],
  );

  const expandAll = useCallback(
    () =>
      commit({
        ...view,
        expanded: [...graph.nodes.values()].filter((n) => n.childIds.length).map((n) => n.id),
      }),
    [graph, view, commit],
  );
  const collapseAll = useCallback(() => commit({ ...view, expanded: [] }), [view, commit]);

  const hideSelected = useCallback(() => {
    if (selected.size === 0) return;
    commit({ ...view, hidden: [...new Set([...view.hidden, ...selected])] });
    setSelected(new Set());
  }, [selected, view, commit]);

  const showAll = useCallback(() => commit({ ...view, hidden: [] }), [view, commit]);
  const showOne = useCallback(
    (id: string) => commit({ ...view, hidden: view.hidden.filter((hiddenId) => hiddenId !== id) }),
    [view, commit],
  );

  const relayout = useCallback(() => {
    commit({ ...view, positions: {} });
    fitSoon();
  }, [view, commit, fitSoon]);

  const resetView = useCallback(() => {
    commit(defaultView(graph));
    setSelected(new Set());
    fitSoon();
  }, [graph, commit, fitSoon]);

  const changeStyle = useCallback(
    (style: NodeStyle) => {
      setNodeStyle(style);
      // Moved positions were made for the other node size; start from a clean layout.
      if (Object.keys(view.positions).length) commit({ ...view, positions: {} });
      fitSoon();
    },
    [view, commit, fitSoon],
  );

  const select = useCallback(
    (mode: "all" | "parents" | "children" | "lineage" | "kind" | "none") => {
      let ids: string[] = [];
      if (mode === "all") ids = visible;
      if (mode === "parents") {
        ids = [...selected]
          .map((id) => graph.nodes.get(id)?.parentId)
          .filter((id): id is string => !!id && visibleSet.has(id));
      }
      if (mode === "children") {
        ids = [...selected].flatMap(
          (id) => graph.nodes.get(id)?.childIds.filter((c) => visibleSet.has(c)) ?? [],
        );
      }
      if (mode === "lineage")
        ids = [...lineage(graph, selected)].filter((id) => visibleSet.has(id));
      if (mode === "kind") {
        const kinds = new Set([...selected].map((id) => graph.nodes.get(id)?.kind));
        ids = visible.filter((id) => kinds.has(graph.nodes.get(id)?.kind));
      }
      setSelected(new Set(ids));
    },
    [graph, selected, visible, visibleSet],
  );

  const align = useCallback(
    (mode: "column" | "row" | "vertical" | "horizontal") => {
      const items = [...selected]
        .map((id) => ({ id, point: positions.get(id) }))
        .filter((item): item is { id: string; point: Point } => !!item.point);
      if (items.length < 2) return;
      const next: Record<string, Point> = { ...view.positions };
      if (mode === "column") {
        const x = Math.min(...items.map((i) => i.point.x));
        for (const i of items) next[i.id] = { x, y: i.point.y };
      }
      if (mode === "row") {
        const y = Math.min(...items.map((i) => i.point.y));
        for (const i of items) next[i.id] = { x: i.point.x, y };
      }
      if (mode === "vertical" || mode === "horizontal") {
        const axis = mode === "vertical" ? "y" : "x";
        const sorted = [...items].sort((a, b) => a.point[axis] - b.point[axis]);
        const start = sorted[0]!.point[axis];
        const step = (sorted.at(-1)!.point[axis] - start) / (sorted.length - 1);
        sorted.forEach((i, index) => {
          next[i.id] = { ...i.point, [axis]: start + step * index };
        });
      }
      commit({ ...view, positions: next });
    },
    [selected, positions, view, commit],
  );

  const openFind = useCallback(() => {
    setFindOpen(true);
    requestAnimationFrame(() => findInputRef.current?.select());
  }, []);
  const closeFind = useCallback(() => {
    setFindOpen(false);
    setQuery("");
    setFindIndex(-1);
  }, []);
  const stepFind = useCallback(
    (by: 1 | -1) => {
      if (matches.length === 0) return;
      const index =
        findIndex < 0
          ? by === 1
            ? 0
            : matches.length - 1
          : (findIndex + by + matches.length) % matches.length;
      setFindIndex(index);
      focusNode(matches[index]!);
    },
    [matches, findIndex, focusNode],
  );

  const selectGroup = useCallback(
    (ids: string[]) => setSelected(new Set(ids.filter((id) => visibleSet.has(id)))),
    [visibleSet],
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(tCommon("linkCopied"), "success");
    } catch {
      toast(tCommon("copyFailed"));
    }
  }, [toast, tCommon]);

  const exportPng = useCallback(async () => {
    const element = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!element) return;
    toast(t("menus.exporting"));
    try {
      const { toPng } = await import("html-to-image");
      const bounds = getNodesBounds(rf.getNodes());
      const width = Math.round(Math.min(4096, Math.max(800, bounds.width + 120)));
      const height = Math.round(Math.min(4096, Math.max(500, bounds.height + 120)));
      const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, 0.05);
      const background =
        getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#eef1f5";
      const dataUrl = await toPng(element, {
        backgroundColor: background,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });
      const link = document.createElement("a");
      link.download = `${t("exportFile")}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast(t("menus.exportFailed"));
    }
  }, [rf, toast, t]);

  const setPanel = useCallback((panel: keyof PanelToggles, value: boolean) => {
    if (panel === "tree") setTreeOpen(value);
    if (panel === "legend") setLegendOpen(value);
    if (panel === "bottom") setBottomOpen(value);
    if (panel === "flow") setFlow(value);
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas events
  // ---------------------------------------------------------------------------

  const onNodesChange = useCallback((changes: NodeChange<GraphFlowNode>[]) => {
    const selectChanges: { id: string; selected: boolean }[] = [];
    const moving: Record<string, Point> = {};
    const dropped: string[] = [];
    for (const change of changes) {
      if (change.type === "select") {
        // Clicks are handled in onNodeClick; React Flow's own changes count only for box selection.
        if (boxSelecting.current) selectChanges.push({ id: change.id, selected: change.selected });
      } else if (change.type === "position") {
        if (change.dragging && change.position) moving[change.id] = change.position;
        else if (change.dragging === false) {
          if (change.position) liveRef.current[change.id] = change.position;
          dropped.push(change.id);
        }
      }
    }
    // React Flow can report one gesture in two calls; apply each to the latest state.
    if (selectChanges.length) {
      setSelected((current) => {
        const next = new Set(current);
        for (const { id, selected: on } of selectChanges) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    }
    if (Object.keys(moving).length) {
      liveRef.current = { ...liveRef.current, ...moving };
      setLive(liveRef.current);
    }
    if (dropped.length) {
      const moved = liveRef.current;
      liveRef.current = {};
      setLive({});
      if (Object.keys(moved).length) {
        dispatch({
          type: "update",
          update: (current) => ({ ...current, positions: { ...current.positions, ...moved } }),
        });
      }
    }
  }, []);

  // Keyboard shortcuts (ignored while typing, except Escape and Ctrl+F).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const typing = !!target?.closest("input, textarea, select, [contenteditable='true']");
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "f") {
        event.preventDefault();
        openFind();
        return;
      }
      if (typing) return;
      if (target?.closest("[role='menu'], [role='dialog'], [role='alertdialog']")) return;
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        redo();
      } else if (mod && key === "a") {
        event.preventDefault();
        select("all");
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selected.size) {
          event.preventDefault();
          hideSelected();
        }
      } else if (event.key === "Escape") {
        if (findOpen) closeFind();
        else setSelected(new Set());
      } else if (event.key === "?") {
        setShortcutsOpen(true);
      } else if (!mod && !event.altKey && key === "v") setTool("select");
      else if (!mod && !event.altKey && key === "h") setTool("pan");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFind, closeFind, findOpen, undo, redo, select, selected, hideSelected]);

  const onInit = useCallback(() => {
    const focus = initial.focus;
    if (focus) {
      const node = graph.nodes.get(focus);
      const point = positions.get(focus);
      if (node && point) {
        const size = nodeSize(node, nodeStyle);
        void rf.setCenter(point.x + size.width / 2, point.y + size.height / 2, { zoom: 1.2 });
        return;
      }
    }
    void rf.fitView({ padding: 0.1, maxZoom: 1 });
  }, [initial.focus, graph, positions, rf, nodeStyle]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const single = singleId ? graph.nodes.get(singleId) : undefined;
  const hasSelection = selected.size > 0;
  const colorLabel =
    colorMode === "type"
      ? t("toolbar.colorByType")
      : colorMode === "due"
        ? t("toolbar.colorByDue")
        : t("toolbar.colorByCustomer");

  return (
    <GraphActionsContext.Provider value={actions}>
      <GraphMenus
        panels={{ tree: treeOpen, legend: legendOpen, bottom: bottomOpen, flow }}
        onPanel={setPanel}
        nodeStyle={nodeStyle}
        onNodeStyle={changeStyle}
        colorMode={colorMode}
        onColorMode={setColorMode}
        onExport={exportPng}
        onCopyLink={copyLink}
        onFit={() => void rf.fitView({ padding: 0.1, duration: 300, maxZoom: 1 })}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <Toolbar aria-label={t("toolbar.label")}>
          <ToolbarButton
            icon={DiagramTreeIcon}
            label={t("toolbar.objects")}
            active={treeOpen}
            onClick={() => setTreeOpen((open) => !open)}
          />
          <ToolbarSeparator />
          <ToolbarGroup label={t("toolbar.tools")}>
            <ToolbarToggle
              icon={MoveIcon}
              label={t("toolbar.pan")}
              shortcut="H"
              active={tool === "pan"}
              onClick={() => setTool("pan")}
            />
            <ToolbarToggle
              icon={SelectIcon}
              label={t("toolbar.select")}
              shortcut="V"
              active={tool === "select"}
              onClick={() => setTool("select")}
            />
          </ToolbarGroup>
          <ToolbarButton icon={LayoutAutoIcon} label={t("toolbar.layout")} onClick={relayout} />
          <ToolbarGroup label={t("toolbar.undoRedo")}>
            <ToolbarToggle
              icon={UndoIcon}
              label={t("toolbar.undo")}
              shortcut="Ctrl+Z"
              disabled={history.past.length === 0}
              onClick={undo}
            />
            <ToolbarToggle
              icon={RedoIcon}
              label={t("toolbar.redo")}
              shortcut="Ctrl+Y"
              disabled={history.future.length === 0}
              onClick={redo}
            />
          </ToolbarGroup>
          <Tooltip label={t("toolbar.resetHint")} side="bottom">
            <ToolbarButton icon={EraserIcon} label={t("toolbar.reset")} onClick={resetView} />
          </Tooltip>
          <ToolbarSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton icon={SelectionIcon} label={t("toolbar.selectMenu")} menu />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => select("all")} shortcut="Ctrl+A">
                {t("toolbar.selectAll")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasSelection} onSelect={() => select("parents")}>
                {t("toolbar.selectParents")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasSelection} onSelect={() => select("children")}>
                {t("toolbar.selectChildren")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasSelection} onSelect={() => select("lineage")}>
                {t("toolbar.selectLineage")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasSelection} onSelect={() => select("kind")}>
                {t("toolbar.selectSameKind")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!hasSelection}
                onSelect={() => select("none")}
                shortcut="Esc"
              >
                {t("toolbar.selectNone")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton icon={ExpandAllIcon} label={t("toolbar.expand")} menu />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                disabled={!hasSelection}
                onSelect={() => setExpandedFor(selected, true)}
              >
                {t("toolbar.expandSelected")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasSelection}
                onSelect={() => setExpandedFor(selected, false)}
              >
                {t("toolbar.collapseSelected")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={expandAll}>{t("toolbar.expandAll")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={collapseAll}>{t("toolbar.collapseAll")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton
            icon={SearchIcon}
            label={t("toolbar.find")}
            shortcut="Ctrl+F"
            active={findOpen}
            onClick={() => (findOpen ? closeFind() : openFind())}
          />
          <ToolbarButton
            icon={EyeOffIcon}
            label={t("toolbar.hide")}
            shortcut="Delete"
            disabled={!hasSelection}
            onClick={hideSelected}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton
                icon={GridViewIcon}
                label={t("toolbar.align")}
                menu
                disabled={selected.size < 2}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => align("column")}>
                <AlignmentLeftIcon />
                {t("toolbar.alignColumn")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => align("row")}>
                <AlignmentTopIcon />
                {t("toolbar.alignRow")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => align("vertical")}>
                <VerticalDistributionIcon />
                {t("toolbar.distributeVertical")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => align("horizontal")}>
                <HorizontalDistributionIcon />
                {t("toolbar.distributeHorizontal")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton
            icon={FlowsIcon}
            label={t("toolbar.flow")}
            active={flow}
            onClick={() => setFlow((value) => !value)}
          />
          <ToolbarSpacer />
          <ToolbarButton
            icon={EyeOpenIcon}
            label={t("toolbar.legend")}
            active={legendOpen}
            onClick={() => setLegendOpen((open) => !open)}
          />
          <ToolbarButton
            icon={PanelTableIcon}
            label={t("toolbar.preview")}
            active={bottomOpen}
            onClick={() => setBottomOpen((open) => !open)}
          />
          <DropdownMenu>
            <div className="flex shrink-0 flex-col items-center gap-[3px] px-0.5">
              <DropdownMenuTrigger className="flex h-9 min-w-[150px] items-center gap-2 rounded-md surface-button px-2.5 text-ui outline-none hover:bg-[var(--btn-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]">
                <TintIcon className="text-[var(--btn-icon)]" />
                <span className="flex-1 text-start">{colorLabel}</span>
                <CaretDownIcon className="text-[var(--btn-icon)]" />
              </DropdownMenuTrigger>
              <span className="text-ui-xs whitespace-nowrap text-muted-foreground">
                {t("toolbar.colors")}
              </span>
            </div>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("toolbar.colors")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={colorMode}
                onValueChange={(value) => setColorMode(value as ColorMode)}
              >
                <DropdownMenuRadioItem value="type">
                  {t("toolbar.colorByType")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="customer">
                  {t("toolbar.colorByCustomer")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="due">{t("toolbar.colorByDue")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Toolbar>

        <div className="relative flex min-h-0 flex-1">
          {treeOpen && (
            <>
              <button
                type="button"
                aria-label={t("tree.close")}
                className="absolute inset-0 z-20 bg-[rgb(16_24_40/0.4)] lg:hidden"
                onClick={() => setTreeOpen(false)}
              />
              <GraphTree
                graph={graph}
                hidden={hidden}
                selected={selected}
                onFocus={focusNode}
                onShow={showOne}
                onShowAll={showAll}
                onClose={() => setTreeOpen(false)}
              />
            </>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 bg-canvas" data-testid="graph-canvas">
              <ReactFlow<GraphFlowNode>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeStyle === "cards" ? CARD_NODE_TYPES : LINEAGE_NODE_TYPES}
                onNodesChange={onNodesChange}
                onNodeClick={(event, node) => {
                  const additive = event.shiftKey || event.ctrlKey || event.metaKey;
                  setSelected((current) => {
                    if (!additive) return new Set([node.id]);
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
                onPaneClick={() => setSelected(new Set())}
                onSelectionStart={() => {
                  boxSelecting.current = true;
                }}
                onSelectionEnd={() => {
                  boxSelecting.current = false;
                }}
                onNodeDoubleClick={(_, node) => {
                  const href = graph.nodes.get(node.id)?.href;
                  if (href) router.push(href);
                }}
                onInit={onInit}
                colorMode={dark ? "dark" : "light"}
                panOnDrag={tool === "pan" ? true : [1, 2]}
                selectionOnDrag={tool === "select"}
                selectionMode={SelectionMode.Partial}
                selectionKeyCode="Shift"
                multiSelectionKeyCode={["Meta", "Control"]}
                deleteKeyCode={null}
                nodesConnectable={false}
                edgesFocusable={false}
                elementsSelectable
                minZoom={0.08}
                maxZoom={3}
                onlyRenderVisibleElements={nodes.length > 800}
                // overflow: clip, not hidden: focusing a node near the edge must not scroll the
                // canvas container (the node would slide away from under the pointer).
                className={cn(
                  "overflow-clip!",
                  tool === "select" && "[&_.react-flow__pane]:cursor-crosshair",
                )}
              />

              {findOpen && (
                <FindBar
                  inputRef={findInputRef}
                  query={query}
                  total={matches.length}
                  index={findIndex}
                  onQuery={(value) => {
                    setQuery(value);
                    setFindIndex(-1);
                  }}
                  onStep={stepFind}
                  onClose={closeFind}
                />
              )}

              {legendOpen && (
                <GraphLegend
                  graph={graph}
                  colorMode={colorMode}
                  overrides={colors}
                  selectedCount={selected.size}
                  hiddenCount={view.hidden.length}
                  visibleCount={visible.length}
                  onSelectGroup={selectGroup}
                  onShowAll={showAll}
                  onColor={(group, color) =>
                    setColors((current) => ({ ...current, [`${colorMode}:${group}`]: color }))
                  }
                  onResetColors={() =>
                    setColors((current) =>
                      Object.fromEntries(
                        Object.entries(current).filter(([key]) => !key.startsWith(`${colorMode}:`)),
                      ),
                    )
                  }
                />
              )}

              <ZoomControls
                hasSelection={hasSelection}
                onFit={() => void rf.fitView({ padding: 0.1, duration: 300, maxZoom: 1 })}
                onFocusSelection={() => fitSoon([...selected])}
              />
            </div>

            {bottomOpen && (
              <BottomPanel
                graph={graph}
                node={single}
                hidden={hidden}
                visible={visibleSet}
                tab={bottomTab}
                onTab={setBottomTab}
                height={bottomHeight}
                onHeight={setBottomHeight}
                maximized={bottomMax}
                onToggleMaximize={() => setBottomMax((value) => !value)}
                onClose={() => {
                  setBottomOpen(false);
                  setBottomMax(false);
                }}
                onFocus={focusNode}
              />
            )}
          </div>

          {hasSelection && (
            <GraphInspector
              key={single?.id ?? "multiple"}
              graph={graph}
              node={single}
              selected={selected}
              canEdit={canEdit}
              colorMode={colorMode}
              overrides={colors}
              onFocus={focusNode}
              onLocate={() => fitSoon([...selected])}
              onClose={() => setSelected(new Set())}
              onHide={hideSelected}
              onExpand={() => setExpandedFor(selected, true)}
            />
          )}
        </div>
      </div>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </GraphActionsContext.Provider>
  );
}

function ZoomControls({
  hasSelection,
  onFit,
  onFocusSelection,
}: {
  hasSelection: boolean;
  onFit: () => void;
  onFocusSelection: () => void;
}) {
  const t = useTranslations("graph.zoom");
  const rf = useReactFlow();
  const items = [
    {
      label: t("focusSelection"),
      icon: LocateIcon,
      onClick: onFocusSelection,
      disabled: !hasSelection,
    },
    { label: t("zoomIn"), icon: ZoomInIcon, onClick: () => void rf.zoomIn({ duration: 200 }) },
    { label: t("zoomOut"), icon: ZoomOutIcon, onClick: () => void rf.zoomOut({ duration: 200 }) },
    { label: t("fit"), icon: ZoomToFitIcon, onClick: onFit },
  ];
  return (
    <div className="absolute start-2.5 bottom-2.5 z-10 flex flex-col">
      {items.map((item, index) => (
        <Tooltip key={item.label} label={item.label} side="right">
          <button
            type="button"
            aria-label={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              "relative flex size-9 items-center justify-center surface-button hover:bg-[var(--btn-bg-hover)] focus-visible:z-10 active:bg-[var(--btn-bg-active)] active:[background-image:none] active:shadow-[var(--btn-shadow-active)] disabled:cursor-not-allowed disabled:bg-[var(--btn-disabled-bg)] disabled:[background-image:none] disabled:shadow-none pointer-coarse:size-11 [&_svg]:text-[var(--btn-icon)] disabled:[&_svg]:text-[var(--btn-disabled-fg)]",
              index === 0 && "rounded-t-md",
              index === items.length - 1 && "rounded-b-md",
              index > 0 && "-mt-px",
            )}
          >
            <item.icon />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

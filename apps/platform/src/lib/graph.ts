/*
 * The company's objects as a connected graph: customer → site (building) →
 * location → device (a device without a location hangs on its building), laid
 * out left to right like a lineage view. Pure functions, so the layout, the
 * selection logic and the due-date roll-up are unit-tested; the canvas only
 * renders them.
 */

import { deviceName, formatLabel } from "@/lib/devices";
import { dueState, worstDueState, type DueState, type IsoDate } from "@/lib/due";
import type { DeviceStatus } from "@/lib/supabase/database.types";

export type NodeKind = "customer" | "site" | "location" | "device";

export const NODE_KINDS: readonly NodeKind[] = ["customer", "site", "location", "device"];

export type GraphData = {
  customers: {
    id: string;
    name: string;
    companyId: string | null;
    vatId: string | null;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    billingAddress: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  sites: {
    id: string;
    customerId: string;
    name: string;
    address: string | null;
    accessNotes: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  locations: {
    id: string;
    siteId: string;
    name: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }[];
  devices: {
    id: string;
    siteId: string;
    locationId: string | null;
    labelNumber: number;
    typeName: string;
    serialNumber: string | null;
    status: DeviceStatus;
    nextDueOn: IsoDate | null;
    lastInspectionOn: IsoDate | null;
    createdAt: string;
    updatedAt: string;
  }[];
  /** "Today" in the organization's time zone and its "due soon" threshold. */
  due: { today: IsoDate; soonDays: number };
};

/** Field keys are translation keys under "graph.fields". */
export type FieldKey =
  | "contactPerson"
  | "email"
  | "phone"
  | "companyId"
  | "vatId"
  | "billingAddress"
  | "address"
  | "accessNotes"
  | "notes"
  | "position"
  | "label"
  | "deviceType"
  | "serialNumber"
  | "status"
  | "nextDue"
  | "lastInspection";

/** How the inspector shows a raw field value. */
export type FieldFormat = "date" | "status" | "mono";

export type GraphNode = {
  id: string;
  kind: NodeKind;
  label: string;
  /** Second line in lists and cards (contact, address); null when there is none. */
  subtitle: string | null;
  parentId: string | null;
  childIds: string[];
  depth: number;
  /** The customer this node belongs to. */
  rootId: string;
  fields: { key: FieldKey; value: string | null; format?: FieldFormat }[];
  /** Detail page. */
  href: string;
  /** Extra text that search matches besides the label (IDs, address). */
  searchText: string;
  /**
   * Due state: a device's own (null when it isn't active); for other objects the
   * most urgent state of the active devices under them (null when there are none).
   */
  due: DueState | null;
  createdAt: string;
  updatedAt: string;
};

export type Graph = {
  nodes: Map<string, GraphNode>;
  roots: string[];
  /** Position of each customer in `roots` (for its colour). */
  rootIndex: Map<string, number>;
  counts: Record<NodeKind, number>;
};

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export type ViewState = {
  /** Nodes whose children are shown. */
  expanded: string[];
  /** Nodes removed from the view (with everything under them). */
  hidden: string[];
  /** Positions the user dragged nodes to. */
  positions: Record<string, Point>;
};

/** "lineage": slim coloured bars as in a lineage graph; "cards": white cards with details. */
export type NodeStyle = "lineage" | "cards";

const STYLE: Record<
  NodeStyle,
  { columnWidth: readonly number[]; columnGap: number; rowGap: number; groupGap: number }
> = {
  lineage: { columnWidth: [260, 250, 250, 250], columnGap: 64, rowGap: 8, groupGap: 14 },
  cards: { columnWidth: [224, 224, 224, 224], columnGap: 80, rowGap: 12, groupGap: 22 },
};

const CARD_SIZE: Size = { width: 224, height: 62 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Size of a node on the canvas. Lineage bars fit their label (estimated from its
 * length, the text itself is truncated if longer); cards have one size.
 */
export function nodeSize(node: Pick<GraphNode, "kind" | "label">, style: NodeStyle): Size {
  if (style === "cards") return CARD_SIZE;
  if (node.kind === "customer") {
    return { width: clamp(Math.ceil(node.label.length * 6.4) + 48, 150, 260), height: 36 };
  }
  return { width: clamp(Math.ceil(node.label.length * 6.2) + 42, 110, 250), height: 20 };
}

/** Left edge of each depth's column. */
export function columnX(style: NodeStyle): number[] {
  const { columnWidth, columnGap } = STYLE[style];
  return columnWidth.map((_, index) =>
    columnWidth.slice(0, index).reduce((sum, width) => sum + width + columnGap, 0),
  );
}

/** Above this many objects the map opens with buildings collapsed. */
const EXPAND_ALL_LIMIT = 300;

const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });

/** Lowercase without diacritics, for forgiving search ("lipova" finds "Lipová"). */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const firstLine = (text: string | null) => text?.split("\n")[0]?.trim() || null;

export function buildGraph(data: GraphData): Graph {
  const nodes = new Map<string, GraphNode>();
  const customers = [...data.customers].sort((a, b) => collator.compare(a.name, b.name));
  for (const customer of customers) {
    nodes.set(customer.id, {
      id: customer.id,
      kind: "customer",
      label: customer.name,
      subtitle: customer.contactPerson ?? customer.companyId,
      parentId: null,
      childIds: [],
      depth: 0,
      rootId: customer.id,
      due: null,
      href: `/customers/${customer.id}`,
      searchText: normalize(
        [customer.name, customer.companyId, customer.contactPerson].filter(Boolean).join(" "),
      ),
      fields: [
        { key: "contactPerson", value: customer.contactPerson },
        { key: "email", value: customer.email },
        { key: "phone", value: customer.phone },
        { key: "companyId", value: customer.companyId },
        { key: "vatId", value: customer.vatId },
        { key: "billingAddress", value: customer.billingAddress },
        { key: "notes", value: customer.notes },
      ],
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    });
  }

  const sites = [...data.sites].sort((a, b) => collator.compare(a.name, b.name));
  for (const site of sites) {
    const parent = nodes.get(site.customerId);
    if (!parent) continue;
    parent.childIds.push(site.id);
    nodes.set(site.id, {
      id: site.id,
      kind: "site",
      label: site.name,
      subtitle: firstLine(site.address),
      parentId: parent.id,
      childIds: [],
      depth: 1,
      rootId: parent.id,
      due: null,
      href: `/sites/${site.id}`,
      searchText: normalize([site.name, site.address].filter(Boolean).join(" ")),
      fields: [
        { key: "address", value: site.address },
        { key: "accessNotes", value: site.accessNotes },
        { key: "notes", value: site.notes },
      ],
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    });
  }

  const locations = [...data.locations].sort(
    (a, b) => a.sortOrder - b.sortOrder || collator.compare(a.name, b.name),
  );
  for (const location of locations) {
    const parent = nodes.get(location.siteId);
    if (!parent) continue;
    parent.childIds.push(location.id);
    nodes.set(location.id, {
      id: location.id,
      kind: "location",
      label: location.name,
      subtitle: null,
      parentId: parent.id,
      childIds: [],
      depth: 2,
      rootId: parent.rootId,
      due: null,
      href: `/sites/${parent.id}`,
      searchText: normalize(location.name),
      fields: [{ key: "position", value: String(parent.childIds.length) }],
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    });
  }

  // Devices by label number; on its location, or on the building when it has none.
  const devices = [...data.devices].sort((a, b) => a.labelNumber - b.labelNumber);
  for (const device of devices) {
    const location = device.locationId ? nodes.get(device.locationId) : undefined;
    const parent = location?.parentId === device.siteId ? location : nodes.get(device.siteId);
    if (!parent) continue;
    parent.childIds.push(device.id);
    const label = deviceName(device.typeName, device.labelNumber);
    const due =
      device.status === "active"
        ? dueState(device.nextDueOn, data.due.today, data.due.soonDays)
        : null;
    nodes.set(device.id, {
      id: device.id,
      kind: "device",
      label,
      subtitle: device.serialNumber,
      parentId: parent.id,
      childIds: [],
      depth: parent.depth + 1,
      rootId: parent.rootId,
      due,
      href: `/devices/${device.id}`,
      searchText: normalize(
        [label, formatLabel(device.labelNumber), device.serialNumber].filter(Boolean).join(" "),
      ),
      fields: [
        { key: "label", value: formatLabel(device.labelNumber), format: "mono" },
        { key: "deviceType", value: device.typeName },
        { key: "serialNumber", value: device.serialNumber, format: "mono" },
        { key: "status", value: device.status, format: "status" },
        {
          key: "nextDue",
          value: device.status === "active" ? device.nextDueOn : null,
          format: "date",
        },
        { key: "lastInspection", value: device.lastInspectionOn, format: "date" },
      ],
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    });
    // A building or customer is as urgent as its most urgent device.
    if (due) {
      for (let id: string | null = parent.id; id; id = nodes.get(id)?.parentId ?? null) {
        const ancestor = nodes.get(id)!;
        ancestor.due = ancestor.due ? worstDueState([ancestor.due, due]) : due;
      }
    }
  }

  const counts = { customer: 0, site: 0, location: 0, device: 0 };
  for (const node of nodes.values()) counts[node.kind]++;
  const roots = customers.map((customer) => customer.id);
  return { nodes, roots, rootIndex: new Map(roots.map((id, index) => [id, index])), counts };
}

/** Nodes with children are expanded, unless the company is large (then only customers). */
export function defaultExpanded(graph: Graph): string[] {
  const all = [...graph.nodes.values()].filter((node) => node.childIds.length > 0);
  if (graph.nodes.size <= EXPAND_ALL_LIMIT) return all.map((node) => node.id);
  return all.filter((node) => node.kind === "customer").map((node) => node.id);
}

export function defaultView(graph: Graph): ViewState {
  return { expanded: defaultExpanded(graph), hidden: [], positions: {} };
}

function visibleChildren(graph: Graph, id: string, expanded: Set<string>, hidden: Set<string>) {
  const node = graph.nodes.get(id);
  if (!node || !expanded.has(id)) return [];
  return node.childIds.filter((child) => !hidden.has(child));
}

/** Visible node ids, parents before children (depth-first, in display order). */
export function visibleIds(graph: Graph, expanded: Set<string>, hidden: Set<string>): string[] {
  const result: string[] = [];
  const walk = (id: string) => {
    result.push(id);
    for (const child of visibleChildren(graph, id, expanded, hidden)) walk(child);
  };
  for (const root of graph.roots) if (!hidden.has(root)) walk(root);
  return result;
}

/**
 * Tidy left-to-right tree layout. Every leaf takes a row; a parent sits centred
 * on its children; customers are separated by a small gap. Returns top-left corners.
 */
export function autoLayout(
  graph: Graph,
  expanded: Set<string>,
  hidden: Set<string>,
  style: NodeStyle = "lineage",
): Map<string, Point> {
  const { rowGap, groupGap } = STYLE[style];
  const xs = columnX(style);
  const positions = new Map<string, Point>();
  let cursor = 0;

  const place = (id: string): { center: number; ids: string[] } => {
    const node = graph.nodes.get(id)!;
    const { height } = nodeSize(node, style);
    const start = cursor;
    const children = visibleChildren(graph, id, expanded, hidden);
    let center: number;
    const ids = [id];
    if (children.length === 0) {
      center = cursor + height / 2;
      cursor += height + rowGap;
    } else {
      const placed = children.map(place);
      for (const child of placed) ids.push(...child.ids);
      center = (placed[0]!.center + placed.at(-1)!.center) / 2;
      // A parent taller than its children's span must not overlap the row above.
      const overlap = start - (center - height / 2);
      if (overlap > 0) {
        for (const childId of ids.slice(1)) positions.get(childId)!.y += overlap;
        center += overlap;
        cursor += overlap;
      }
      cursor = Math.max(cursor, center + height / 2 + rowGap);
    }
    positions.set(id, { x: xs[node.depth] ?? 0, y: center - height / 2 });
    return { center, ids };
  };

  for (const root of graph.roots) {
    if (hidden.has(root)) continue;
    place(root);
    cursor += groupGap;
  }
  return positions;
}

/**
 * Final positions: a dragged node stays where it was put; any other node keeps
 * its offset from its parent, so a moved subtree travels with its parent.
 */
export function resolvePositions(
  graph: Graph,
  visible: string[],
  auto: Map<string, Point>,
  overrides: Record<string, Point>,
): Map<string, Point> {
  const result = new Map<string, Point>();
  for (const id of visible) {
    const own = auto.get(id);
    if (!own) continue;
    const override = overrides[id];
    if (override) {
      result.set(id, override);
      continue;
    }
    const parentId = graph.nodes.get(id)?.parentId;
    const parentFinal = parentId ? result.get(parentId) : undefined;
    const parentAuto = parentId ? auto.get(parentId) : undefined;
    result.set(
      id,
      parentFinal && parentAuto
        ? { x: parentFinal.x + own.x - parentAuto.x, y: parentFinal.y + own.y - parentAuto.y }
        : own,
    );
  }
  return result;
}

export function ancestors(graph: Graph, id: string): string[] {
  const result: string[] = [];
  let parent = graph.nodes.get(id)?.parentId ?? null;
  while (parent) {
    result.push(parent);
    parent = graph.nodes.get(parent)?.parentId ?? null;
  }
  return result;
}

export function descendants(graph: Graph, id: string): string[] {
  const result: string[] = [];
  const stack = [...(graph.nodes.get(id)?.childIds ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    result.push(next);
    stack.push(...(graph.nodes.get(next)?.childIds ?? []));
  }
  return result;
}

/** The selected nodes with everything above and below them (what stays lit). */
export function lineage(graph: Graph, ids: Iterable<string>): Set<string> {
  const result = new Set<string>();
  for (const id of ids) {
    if (!graph.nodes.has(id)) continue;
    result.add(id);
    for (const other of ancestors(graph, id)) result.add(other);
    for (const other of descendants(graph, id)) result.add(other);
  }
  return result;
}

/** Ids whose label or details contain the query, in display order. */
export function searchNodes(graph: Graph, query: string): string[] {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const result: string[] = [];
  const walk = (id: string) => {
    const node = graph.nodes.get(id)!;
    if (node.searchText.includes(needle)) result.push(id);
    for (const child of node.childIds) walk(child);
  };
  for (const root of graph.roots) walk(root);
  return result;
}

/** View state that makes `id` visible: its ancestors expanded and nothing on the path hidden. */
export function reveal(graph: Graph, view: ViewState, id: string): ViewState {
  const path = ancestors(graph, id);
  const expanded = new Set(view.expanded);
  let changed = false;
  for (const ancestor of path) {
    if (!expanded.has(ancestor)) {
      expanded.add(ancestor);
      changed = true;
    }
  }
  const onPath = new Set([id, ...path]);
  const hidden = view.hidden.filter((hiddenId) => !onPath.has(hiddenId));
  if (!changed && hidden.length === view.hidden.length) return view;
  return { ...view, expanded: [...expanded], hidden };
}

/** Drops ids that no longer exist (e.g. a customer deleted since the view was saved). */
export function sanitizeView(
  graph: Graph,
  view: Partial<ViewState> | null | undefined,
): ViewState | null {
  if (!view || !Array.isArray(view.expanded) || !Array.isArray(view.hidden)) return null;
  const positions: Record<string, Point> = {};
  for (const [id, point] of Object.entries(view.positions ?? {})) {
    if (graph.nodes.has(id) && Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
      positions[id] = { x: point.x, y: point.y };
    }
  }
  return {
    expanded: view.expanded.filter((id) => typeof id === "string" && graph.nodes.has(id)),
    hidden: view.hidden.filter((id) => typeof id === "string" && graph.nodes.has(id)),
    positions,
  };
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Distinct colours for "colour by customer" (Blueprint's core palette). */
export const CUSTOMER_PALETTE = [
  "#137cbd",
  "#0f9960",
  "#96622d",
  "#7157d9",
  "#db3737",
  "#00b3a4",
  "#d9822b",
  "#1f4b99",
  "#c22762",
  "#238c2c",
  "#8f398f",
  "#a67908",
] as const;

/** Swatches offered by the colour editor. */
export const COLOR_SWATCHES = [
  "#137cbd",
  "#1f4b99",
  "#00b3a4",
  "#0f9960",
  "#238c2c",
  "#87a629",
  "#d99e0b",
  "#d9822b",
  "#96622d",
  "#db3737",
  "#c22762",
  "#8f398f",
  "#7157d9",
  "#5c7080",
  "#394b59",
  "#182026",
] as const;

export type ColorMode = "type" | "customer" | "due";

/**
 * Legend groups of the "due" mode: the states of active devices, then "none" for
 * what isn't tracked (inactive devices, objects without active devices).
 */
export const DUE_GROUPS = ["overdue", "soon", "ok", "never", "none"] as const;
export type DueGroup = (typeof DUE_GROUPS)[number];

export const DUE_COLOR: Record<DueGroup, string> = {
  overdue: "#d14343",
  soon: "#d98a1f",
  ok: "#1a7f52",
  never: "#5d6979",
  none: "#a7b4c4",
};

/** Colours chosen in the legend's editor, keyed by `${mode}:${group}`. */
export type ColorOverrides = Record<string, string>;

export const KIND_COLOR: Record<NodeKind, string> = {
  customer: "var(--node-customer)",
  site: "var(--node-site)",
  location: "var(--node-location)",
  device: "var(--node-device)",
};

/** The legend group a node belongs to: its type, its customer, or its due state. */
export function colorGroup(graph: Graph, id: string, mode: ColorMode): string {
  const node = graph.nodes.get(id);
  if (!node) return "";
  if (mode === "type") return node.kind;
  if (mode === "due") return node.due ?? "none";
  return node.rootId;
}

/** Default colour of a legend group. */
export function groupColor(graph: Graph, group: string, mode: ColorMode): string {
  if (mode === "type") return KIND_COLOR[group as NodeKind] ?? KIND_COLOR.customer;
  if (mode === "due") return DUE_COLOR[group as DueGroup] ?? DUE_COLOR.none;
  const index = graph.rootIndex.get(group) ?? 0;
  return CUSTOMER_PALETTE[index % CUSTOMER_PALETTE.length]!;
}

export function nodeColor(
  graph: Graph,
  id: string,
  mode: ColorMode,
  overrides: ColorOverrides = {},
): string {
  const group = colorGroup(graph, id, mode);
  return overrides[`${mode}:${group}`] ?? groupColor(graph, group, mode);
}

/** White or dark text, whichever reads better on the colour (CSS variables count as dark). */
export function readableText(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
  return luminance > 0.36 ? "#182026" : "#ffffff";
}

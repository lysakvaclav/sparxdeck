import {
  BriefcaseIcon,
  CalendarIcon,
  ClipboardIcon,
  CogIcon,
  DataLineageIcon,
  FlameIcon,
  FormIcon,
  HomeIcon,
  IssueIcon,
  LayersIcon,
  PeopleIcon,
  type IconComponent,
} from "@/components/icons";

/** Sidebar sections; the heading of each is "nav.group…" (none for the first). */
export type NavGroup = "main" | "work" | "records" | "admin";

export type NavItem = {
  href: string;
  /** Key under "nav" in messages. */
  label:
    | "dashboard"
    | "inspections"
    | "calendar"
    | "defects"
    | "customers"
    | "devices"
    | "plans"
    | "graph"
    | "deviceTypes"
    | "team"
    | "settings";
  icon: IconComponent;
  /** Section of the desktop sidebar. */
  group: NavGroup;
  /** Icon colour in the page header (light and dark surfaces). */
  headerTone: string;
  /** Other path prefixes that belong to this item (a site's page is under Customers). */
  also?: readonly string[];
  /** Pages under another item's prefix that belong here instead (a plan of a site). */
  match?: RegExp;
  /** On phones: a tab of the bottom bar, or an entry of its "More" menu. */
  phone: "tab" | "more";
};

/** A floor plan of a building: under /sites, but part of Floor plans. */
const SITE_PLAN = /^\/sites\/[^/]+\/plans(\/|$)/;

// Phones keep field work in the tab bar; the rest is under "More".
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "dashboard",
    icon: HomeIcon,
    group: "main",
    headerTone: "text-[#5c7080] dark:text-[#a7b6c2]",
    phone: "tab",
  },
  {
    href: "/inspections",
    label: "inspections",
    icon: FormIcon,
    group: "work",
    headerTone: "text-[#00a396] dark:text-[#2ee6d6]",
    phone: "tab",
  },
  {
    href: "/calendar",
    label: "calendar",
    icon: CalendarIcon,
    group: "work",
    headerTone: "text-[#728c23] dark:text-[#b6d94c]",
    phone: "more",
  },
  {
    href: "/defects",
    label: "defects",
    icon: IssueIcon,
    group: "work",
    headerTone: "text-[#db3737] dark:text-[#ff7373]",
    phone: "tab",
  },
  {
    href: "/customers",
    label: "customers",
    icon: BriefcaseIcon,
    group: "records",
    headerTone: "text-[#137cbd] dark:text-[#48aff0]",
    also: ["/sites"],
    phone: "more",
  },
  {
    href: "/devices",
    label: "devices",
    icon: FlameIcon,
    group: "records",
    headerTone: "text-[#db2c6f] dark:text-[#f5498b]",
    phone: "tab",
  },
  {
    href: "/plans",
    label: "plans",
    icon: LayersIcon,
    group: "records",
    headerTone: "text-[#d99e0b] dark:text-[#ffc940]",
    match: SITE_PLAN,
    phone: "more",
  },
  {
    href: "/graph",
    label: "graph",
    icon: DataLineageIcon,
    group: "records",
    headerTone: "text-[#d9822b] dark:text-[#f29d49]",
    phone: "more",
  },
  {
    href: "/device-types",
    label: "deviceTypes",
    icon: ClipboardIcon,
    group: "admin",
    headerTone: "text-[#7157d9] dark:text-[#ad99ff]",
    phone: "more",
  },
  {
    href: "/team",
    label: "team",
    icon: PeopleIcon,
    group: "admin",
    headerTone: "text-[#0f9960] dark:text-[#3dcc91]",
    phone: "more",
  },
  {
    href: "/settings",
    label: "settings",
    icon: CogIcon,
    group: "admin",
    headerTone: "text-[#5c7080] dark:text-[#a7b6c2]",
    phone: "more",
  },
];

/** The header icon and colour of a section, by its nav label. */
export function appIcon(label: NavItem["label"]) {
  const item = NAV_ITEMS.find((entry) => entry.label === label)!;
  return { icon: item.icon, tone: item.headerTone };
}

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "also" | "match">) {
  if (item.href === "/") return pathname === "/";
  if (item.match?.test(pathname)) return true;
  // A page claimed by another item's pattern isn't this item's too.
  if (
    NAV_ITEMS.some(
      (other) => other !== item && other.href !== item.href && other.match?.test(pathname),
    )
  )
    return false;
  return [item.href, ...(item.also ?? [])].some((prefix) => matches(pathname, prefix));
}

/** Cookie that remembers a folded sidebar ("0"); it shows labels otherwise. */
export const RAIL_COOKIE = "sd_rail";

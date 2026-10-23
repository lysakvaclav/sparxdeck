import {
  BriefcaseIcon,
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

export type NavItem = {
  href: string;
  /** Key under "nav" in messages. */
  label:
    | "dashboard"
    | "inspections"
    | "defects"
    | "customers"
    | "devices"
    | "plans"
    | "graph"
    | "deviceTypes"
    | "team"
    | "settings";
  icon: IconComponent;
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
    headerTone: "text-[#5d6979] dark:text-[#a7b4c4]",
    phone: "tab",
  },
  {
    href: "/inspections",
    label: "inspections",
    icon: FormIcon,
    headerTone: "text-[#0f8a80] dark:text-[#3fd0c2]",
    phone: "tab",
  },
  {
    href: "/defects",
    label: "defects",
    icon: IssueIcon,
    headerTone: "text-[#d14343] dark:text-[#f08a8a]",
    phone: "tab",
  },
  {
    href: "/customers",
    label: "customers",
    icon: BriefcaseIcon,
    headerTone: "text-[#3a67b0] dark:text-[#8ab0ee]",
    also: ["/sites"],
    phone: "more",
  },
  {
    href: "/devices",
    label: "devices",
    icon: FlameIcon,
    headerTone: "text-[#c8326b] dark:text-[#f27aa6]",
    phone: "tab",
  },
  {
    href: "/plans",
    label: "plans",
    icon: LayersIcon,
    headerTone: "text-[#b7860b] dark:text-[#f2c14e]",
    match: SITE_PLAN,
    phone: "more",
  },
  {
    href: "/graph",
    label: "graph",
    icon: DataLineageIcon,
    headerTone: "text-[#cf6f1d] dark:text-[#f2a65e]",
    phone: "more",
  },
  {
    href: "/device-types",
    label: "deviceTypes",
    icon: ClipboardIcon,
    headerTone: "text-[#6d4fc4] dark:text-[#b3a1f5]",
    phone: "more",
  },
  {
    href: "/team",
    label: "team",
    icon: PeopleIcon,
    headerTone: "text-[#1a7f52] dark:text-[#5cc995]",
    phone: "more",
  },
  {
    href: "/settings",
    label: "settings",
    icon: CogIcon,
    headerTone: "text-[#5d6979] dark:text-[#a7b4c4]",
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

/** Cookie that remembers whether the desktop rail shows labels. */
export const RAIL_COOKIE = "sd_rail";

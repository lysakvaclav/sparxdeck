import {
  BriefcaseIcon,
  ClipboardIcon,
  CogIcon,
  DataLineageIcon,
  FlameIcon,
  FormIcon,
  HomeIcon,
  IssueIcon,
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
    | "graph"
    | "deviceTypes"
    | "team"
    | "settings";
  icon: IconComponent;
  /** Icon colour on the dark rail (each app has its own, as in Foundry). */
  railTone: string;
  /** Icon colour in the page header (light and dark surfaces). */
  headerTone: string;
  /** Other path prefixes that belong to this item (a site's page is under Customers). */
  also?: readonly string[];
  /** On phones: a tab of the bottom bar, or an entry of its "More" menu. */
  phone: "tab" | "more";
};

// Phones keep field work in the tab bar; the rest is under "More".
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "dashboard",
    icon: HomeIcon,
    railTone: "text-[#a7b6c2]",
    headerTone: "text-[#5c7080] dark:text-[#a7b6c2]",
    phone: "tab",
  },
  {
    href: "/inspections",
    label: "inspections",
    icon: FormIcon,
    railTone: "text-[#2ee6d6]",
    headerTone: "text-[#00a396] dark:text-[#2ee6d6]",
    phone: "tab",
  },
  {
    href: "/defects",
    label: "defects",
    icon: IssueIcon,
    railTone: "text-[#ff7373]",
    headerTone: "text-[#db3737] dark:text-[#ff7373]",
    phone: "tab",
  },
  {
    href: "/customers",
    label: "customers",
    icon: BriefcaseIcon,
    railTone: "text-[#48aff0]",
    headerTone: "text-[#137cbd] dark:text-[#48aff0]",
    also: ["/sites"],
    phone: "more",
  },
  {
    href: "/devices",
    label: "devices",
    icon: FlameIcon,
    railTone: "text-[#f5498b]",
    headerTone: "text-[#db2c6f] dark:text-[#f5498b]",
    phone: "tab",
  },
  {
    href: "/graph",
    label: "graph",
    icon: DataLineageIcon,
    railTone: "text-[#f29d49]",
    headerTone: "text-[#d9822b] dark:text-[#f29d49]",
    phone: "more",
  },
  {
    href: "/device-types",
    label: "deviceTypes",
    icon: ClipboardIcon,
    railTone: "text-[#ad99ff]",
    headerTone: "text-[#7157d9] dark:text-[#ad99ff]",
    phone: "more",
  },
  {
    href: "/team",
    label: "team",
    icon: PeopleIcon,
    railTone: "text-[#3dcc91]",
    headerTone: "text-[#0f9960] dark:text-[#3dcc91]",
    phone: "more",
  },
  {
    href: "/settings",
    label: "settings",
    icon: CogIcon,
    railTone: "text-[#a7b6c2]",
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

export function isActive(pathname: string, item: Pick<NavItem, "href" | "also">) {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.also ?? [])].some((prefix) => matches(pathname, prefix));
}

/** Cookie that remembers whether the desktop rail shows labels. */
export const RAIL_COOKIE = "sd_rail";

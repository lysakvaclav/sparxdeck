import {
  BriefcaseIcon,
  FlameIcon,
  MapMarkerIcon,
  OfficeIcon,
  type IconComponent,
} from "@/components/icons";
import type { NodeKind } from "@/lib/graph";

/** Icon and colour of each object type, shared by lists, headers and the map. */
export const OBJECT_TYPES: Record<NodeKind, { icon: IconComponent; text: string; bg: string }> = {
  customer: { icon: BriefcaseIcon, text: "text-node-customer", bg: "bg-node-customer" },
  site: { icon: OfficeIcon, text: "text-node-site", bg: "bg-node-site" },
  location: { icon: MapMarkerIcon, text: "text-node-location", bg: "bg-node-location" },
  device: { icon: FlameIcon, text: "text-node-device", bg: "bg-node-device" },
};

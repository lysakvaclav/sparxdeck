import { createElement } from "react";
import type { IconComponent, IconProps } from "@/components/icons";
import type { NodeKind } from "@/lib/graph";

/**
 * The mark of an object type: a small square in the type's colour (the current
 * text colour), drawn where an icon would be. Pictures are kept for the sidebar.
 */
function createMark(name: string): IconComponent {
  function Mark({ size = 16, title, className, ...props }: IconProps) {
    return createElement(
      "svg",
      {
        "data-mark": name,
        viewBox: "0 0 16 16",
        width: size,
        height: size,
        fill: "currentColor",
        role: title ? "img" : undefined,
        "aria-label": title,
        "aria-hidden": title ? undefined : true,
        focusable: "false",
        className: ["shrink-0", className].filter(Boolean).join(" "),
        ...props,
      },
      createElement("rect", { x: 3, y: 3, width: 10, height: 10, rx: 2.5 }),
    );
  }
  Mark.displayName = `${name}-mark`;
  return Mark;
}

/** Mark and colour of each object type, shared by lists, headers and the map. */
export const OBJECT_TYPES: Record<NodeKind, { icon: IconComponent; text: string; bg: string }> = {
  customer: { icon: createMark("customer"), text: "text-node-customer", bg: "bg-node-customer" },
  site: { icon: createMark("site"), text: "text-node-site", bg: "bg-node-site" },
  location: { icon: createMark("location"), text: "text-node-location", bg: "bg-node-location" },
  device: { icon: createMark("device"), text: "text-node-device", bg: "bg-node-device" },
};

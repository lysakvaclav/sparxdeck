import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The workspace text sizes (text-ui-*) and elevations (shadow-elevation-*) from
// globals.css must be known to tailwind-merge, or it mistakes them for colours
// and drops them when a colour class follows.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["ui-lg", "ui", "ui-sm", "ui-xs"] }],
      shadow: [
        { shadow: ["elevation-0", "elevation-1", "elevation-2", "elevation-3", "elevation-4"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

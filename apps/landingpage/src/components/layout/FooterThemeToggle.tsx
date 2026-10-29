"use client";

import { Theme } from "@/components/ui/theme";

export function FooterThemeToggle() {
  return (
    <div>
      <Theme
        size="sm"
        variant="dropdown"
        showLabel
        themes={["light", "dark", "system"]}
        className="button-font"
      />
    </div>
  );
}

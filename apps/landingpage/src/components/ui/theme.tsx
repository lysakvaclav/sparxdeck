"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, SunMedium } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ThemeName = "light" | "dark" | "system";

interface ThemeProps {
  size?: "sm" | "md";
  variant?: "dropdown";
  showLabel?: boolean;
  themes?: ThemeName[];
  className?: string;
}

const themeIcons: Record<ThemeName, React.ReactNode> = {
  light: <SunMedium className="h-3.5 w-3.5" aria-hidden />,
  dark: <Moon className="h-3.5 w-3.5" aria-hidden />,
  system: <Monitor className="h-3.5 w-3.5" aria-hidden />,
};

const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function Theme({
  size = "md",
  variant = "dropdown",
  showLabel = false,
  themes = ["light", "dark", "system"],
  className,
}: ThemeProps) {
  const { theme, setTheme } = useTheme();
  const current = (theme ?? "system") as ThemeName;

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid hydration mismatches between server and client for theme icon
    return null;
  }

  const buttonClasses = cn(
    "inline-flex min-h-9 items-center gap-2 rounded-full border border-line-strong px-3 text-xs text-muted hover:text-strong",
    "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-soft)]",
    size === "sm" ? "h-8" : "h-9 text-xs",
    className,
  );

  if (variant !== "dropdown") {
    // Fallback: still render dropdown, variant is kept for API compatibility
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={buttonClasses}>
          {themeIcons[current]}
          {showLabel && <span>{themeLabels[current]}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-header-hover-zone="true">
        {themes.map((name) => (
          <DropdownMenuItem
            key={name}
            onClick={() => setTheme(name)}
            className={cn(
              "flex items-center gap-2 text-xs",
              name === current
                ? "bg-[var(--color-primary-soft)] text-[var(--color-text-strong)]"
                : "text-[var(--color-text-main)]",
            )}
          >
            {themeIcons[name]}
            <span>{themeLabels[name]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

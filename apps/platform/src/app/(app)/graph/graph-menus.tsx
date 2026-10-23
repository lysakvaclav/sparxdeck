"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  CaretDownIcon,
  ExportIcon,
  KeyCommandIcon,
  LinkIcon,
  ZoomToFitIcon,
} from "@/components/icons";
import { PAGE_MENUS_SLOT } from "@/components/app/slots";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColorMode, NodeStyle } from "@/lib/graph";

export type PanelToggles = {
  tree: boolean;
  legend: boolean;
  bottom: boolean;
  flow: boolean;
};

function MenuButton({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger className="flex h-5 items-center gap-0.5 rounded-sm px-[7px] text-ui-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--focus)] data-[state=open]:bg-accent data-[state=open]:text-foreground">
      {label}
      <CaretDownIcon className="size-3" />
    </DropdownMenuTrigger>
  );
}

/**
 * Application menus under the page title (File, View, Help), as in Foundry. Drawn
 * into the header's menu row through a portal; the header itself is rendered on
 * the server.
 */
export function GraphMenus({
  panels,
  onPanel,
  nodeStyle,
  onNodeStyle,
  colorMode,
  onColorMode,
  onExport,
  onCopyLink,
  onFit,
  onShortcuts,
}: {
  panels: PanelToggles;
  onPanel: (panel: keyof PanelToggles, value: boolean) => void;
  nodeStyle: NodeStyle;
  onNodeStyle: (style: NodeStyle) => void;
  colorMode: ColorMode;
  onColorMode: (mode: ColorMode) => void;
  onExport: () => void;
  onCopyLink: () => void;
  onFit: () => void;
  onShortcuts: () => void;
}) {
  const t = useTranslations("graph.menus");
  // The workspace renders only in the browser (no SSR), after the header exists.
  const [target] = useState(() => document.querySelector(PAGE_MENUS_SLOT));
  if (!target) return null;

  return createPortal(
    <div className="flex items-center">
      <DropdownMenu>
        <MenuButton label={t("file")} />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onExport}>
            <ExportIcon />
            {t("exportPng")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyLink}>
            <LinkIcon />
            {t("copyLink")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <MenuButton label={t("view")} />
        <DropdownMenuContent align="start" className="min-w-[220px]">
          <DropdownMenuLabel>{t("panels")}</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={panels.tree}
            onCheckedChange={(value) => onPanel("tree", value)}
          >
            {t("tree")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={panels.legend}
            onCheckedChange={(value) => onPanel("legend", value)}
          >
            {t("legend")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={panels.bottom}
            onCheckedChange={(value) => onPanel("bottom", value)}
          >
            {t("bottom")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={panels.flow}
            onCheckedChange={(value) => onPanel("flow", value)}
          >
            {t("flow")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("nodeStyle")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={nodeStyle}
            onValueChange={(value) => onNodeStyle(value as NodeStyle)}
          >
            <DropdownMenuRadioItem value="lineage">{t("styleLineage")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="cards">{t("styleCards")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("colors")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={colorMode}
            onValueChange={(value) => onColorMode(value as ColorMode)}
          >
            <DropdownMenuRadioItem value="type">{t("colorByType")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="customer">{t("colorByCustomer")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="due">{t("colorByDue")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onFit}>
            <ZoomToFitIcon />
            {t("fit")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <MenuButton label={t("help")} />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onShortcuts} shortcut="?">
            <KeyCommandIcon />
            {t("shortcuts")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>,
    target,
  );
}

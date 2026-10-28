"use client";

import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { ACCENT_MIN_CONTRAST, contrastOnWhite } from "@/lib/protocol-template/requirements";
import {
  DATE_STYLES,
  FONTS,
  LANGUAGES,
  TEMPLATE_LIMITS,
  type ProtocolTemplate,
} from "@/lib/protocol-template/schema";
import { CheckControl, NumberControl, SelectControl, TextControl } from "./controls";
import { VariableMenu } from "./variable-menu";

// The page, the look and the footer of a protocol template (part 22, stages
// B and C): orientation and margins, language and dates, font and text size,
// the accent colour, tables, and the footer.

const MARGINS = ["top", "right", "bottom", "left"] as const;
/** The day the date formats are shown on. */
const EXAMPLE_DAY = new Date(Date.UTC(2026, 9, 13, 12));

export function PageProperties({
  template,
  onChange,
}: {
  template: ProtocolTemplate;
  onChange: (template: ProtocolTemplate, field: string) => void;
}) {
  const t = useTranslations("protocolTemplates.page");
  const appLocale = useLocale();
  const { page, style, footer } = template;
  const language = template.language ?? "organization";
  const dateStyle = template.format?.date ?? "medium";
  const table = style.table ?? { borders: "rows" as const, zebra: false };
  const accent = style.accent ?? null;
  const readable = !accent || contrastOnWhite(accent) >= ACCENT_MIN_CONTRAST;
  const example = (value: (typeof DATE_STYLES)[number]) =>
    new Intl.DateTimeFormat(language === "organization" ? appLocale : language, {
      dateStyle: value,
      timeZone: "UTC",
    }).format(EXAMPLE_DAY);
  return (
    <>
      <SelectControl
        id="page-language"
        label={t("language")}
        value={language}
        options={LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
        onChange={(value) =>
          onChange({ ...template, language: value === "organization" ? undefined : value }, "language")
        }
        hint={t("languageHint")}
      />
      <SelectControl
        id="page-date"
        label={t("dateFormat")}
        value={dateStyle}
        options={DATE_STYLES.map((value) => ({ value, label: example(value) }))}
        onChange={(date) =>
          onChange({ ...template, format: date === "medium" ? undefined : { date } }, "format.date")
        }
      />
      <SelectControl
        id="page-orientation"
        label={t("orientation")}
        value={page.orientation}
        options={(["portrait", "landscape"] as const).map((value) => ({ value, label: t(`orientations.${value}`) }))}
        onChange={(orientation) => onChange({ ...template, page: { ...page, orientation } }, "page.orientation")}
      />
      <fieldset className="grid grid-cols-2 gap-x-4 gap-y-3">
        <legend className="col-span-2 mb-1 text-ui">{t("margins")}</legend>
        {MARGINS.map((side) => (
          <NumberControl
            key={side}
            id={`page-margin-${side}`}
            label={t(`margin.${side}`)}
            unit="mm"
            value={page.margins[side]}
            min={5}
            max={40}
            onChange={(value) =>
              onChange({ ...template, page: { ...page, margins: { ...page.margins, [side]: value } } }, `page.margin.${side}`)
            }
          />
        ))}
      </fieldset>
      <SelectControl
        id="page-font"
        label={t("font")}
        value={style.font}
        options={FONTS.map((value) => ({ value, label: t(`fonts.${value}`) }))}
        onChange={(font) => onChange({ ...template, style: { ...style, font } }, "style.font")}
        hint={t("fontHint")}
      />
      <NumberControl
        id="page-size"
        label={t("textSize")}
        unit="pt"
        step={0.5}
        value={style.size}
        min={7}
        max={12}
        onChange={(size) => onChange({ ...template, style: { ...style, size } }, "style.size")}
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-ui">{t("accent")}</legend>
        <CheckControl
          id="page-accent-on"
          label={t("accentOn")}
          checked={accent !== null}
          onChange={(on) =>
            onChange({ ...template, style: { ...style, accent: on ? "#29333c" : undefined } }, "style.accent")
          }
        />
        {accent && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t("accentPicker")}
              value={accent.toLowerCase()}
              className="h-8 w-12 cursor-pointer rounded-md border border-border bg-transparent pointer-coarse:h-11"
              onChange={(event) =>
                onChange({ ...template, style: { ...style, accent: event.target.value } }, "style.accent")
              }
            />
            <Input
              aria-label={t("accentHex")}
              className="w-28 font-mono"
              maxLength={7}
              defaultValue={accent}
              key={accent}
              onChange={(event) => {
                if (/^#[0-9a-fA-F]{6}$/.test(event.target.value))
                  onChange({ ...template, style: { ...style, accent: event.target.value } }, "style.accent");
              }}
            />
          </div>
        )}
        {accent && !readable && (
          <p role="alert" className="text-ui-sm text-destructive-text">
            {t("accentLow", { ratio: contrastOnWhite(accent).toFixed(1) })}
          </p>
        )}
        <p className="text-ui-sm text-muted-foreground">{t("accentHint")}</p>
      </fieldset>
      <SelectControl
        id="page-table-borders"
        label={t("tableBorders")}
        value={table.borders}
        options={(["rows", "grid", "none"] as const).map((value) => ({ value, label: t(`tableBorderOptions.${value}`) }))}
        onChange={(borders) =>
          onChange({ ...template, style: { ...style, table: { ...table, borders } } }, "style.table.borders")
        }
      />
      <CheckControl
        id="page-table-zebra"
        label={t("tableZebra")}
        checked={table.zebra}
        onChange={(zebra) => onChange({ ...template, style: { ...style, table: { ...table, zebra } } }, "style.table.zebra")}
      />
      <SelectControl
        id="page-footer"
        label={t("footerText")}
        value={footer.text}
        options={(["organization", "custom", "none"] as const).map((value) => ({ value, label: t(`footerTexts.${value}`) }))}
        onChange={(text) => onChange({ ...template, footer: { ...footer, text } }, "footer.text")}
        hint={footer.text === "organization" ? t("footerOrganizationHint") : undefined}
      />
      {footer.text === "custom" && (
        <div className="space-y-1.5">
          <TextControl
            id="page-footer-custom"
            label={t("footerCustom")}
            multiline
            value={footer.custom}
            maxLength={TEMPLATE_LIMITS.text}
            onChange={(custom) => onChange({ ...template, footer: { ...footer, custom } }, "footer.custom")}
          />
          <VariableMenu
            onPick={(token) =>
              onChange(
                { ...template, footer: { ...footer, custom: `${footer.custom}${token}`.slice(0, TEMPLATE_LIMITS.text) } },
                "footer.custom",
              )
            }
          />
        </div>
      )}
      <CheckControl
        id="page-numbers"
        label={t("pageNumbers")}
        checked={footer.pageNumbers}
        onChange={(pageNumbers) => onChange({ ...template, footer: { ...footer, pageNumbers } }, "footer.pageNumbers")}
      />
    </>
  );
}

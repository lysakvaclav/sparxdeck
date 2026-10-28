"use client";

import { useTranslations } from "next-intl";
import { TEMPLATE_LIMITS, type ProtocolTemplate } from "@/lib/protocol-template/schema";
import { CheckControl, NumberControl, SelectControl, TextControl } from "./controls";

// The page and the footer of a protocol template (part 22, stage B). Fonts,
// colours and the template's language come with stage C.

const MARGINS = ["top", "right", "bottom", "left"] as const;

export function PageProperties({
  template,
  onChange,
}: {
  template: ProtocolTemplate;
  onChange: (template: ProtocolTemplate, field: string) => void;
}) {
  const t = useTranslations("protocolTemplates.page");
  const { page, style, footer } = template;
  return (
    <>
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
      <SelectControl
        id="page-footer"
        label={t("footerText")}
        value={footer.text}
        options={(["organization", "custom", "none"] as const).map((value) => ({ value, label: t(`footerTexts.${value}`) }))}
        onChange={(text) => onChange({ ...template, footer: { ...footer, text } }, "footer.text")}
        hint={footer.text === "organization" ? t("footerOrganizationHint") : undefined}
      />
      {footer.text === "custom" && (
        <TextControl
          id="page-footer-custom"
          label={t("footerCustom")}
          multiline
          value={footer.custom}
          maxLength={TEMPLATE_LIMITS.text}
          onChange={(custom) => onChange({ ...template, footer: { ...footer, custom } }, "footer.custom")}
        />
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

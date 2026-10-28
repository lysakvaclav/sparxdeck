"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddIcon, ArrowDownIcon, ArrowUpIcon, LockIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { richToText, textToRich } from "@/lib/protocol-template/editor";
import {
  COMPANY_FIELDS,
  CUSTOMER_FIELDS,
  DEVICE_COLUMNS,
  FACTS,
  GALLERY_SOURCES,
  LOGO_POSITIONS,
  SIGNATURE_ROLES,
  TEMPLATE_LIMITS,
  type BlockOf,
  type DeviceColumnKey,
  type TemplateBlock,
} from "@/lib/protocol-template/schema";
import { CheckControl, ChoiceList, InlineNumber, NumberControl, SelectControl, TextControl } from "./controls";

// The properties of the selected block (part 22, stage B).

/** The protocol's own headings, shown where a block keeps the default one. */
export type Placeholders = {
  title: string;
  summary: string;
  devices: string;
  checklist: string;
  defects: string;
  gallery: string;
  notes: string;
  signatures: Record<"technician" | "customer" | "other", string>;
  columns: Record<DeviceColumnKey, string>;
};

type Change = (block: TemplateBlock, field: string) => void;

const move = <T,>(list: readonly T[], index: number, step: number) => {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + step, 0, item!);
  return next;
};

function TitleField({
  block,
  placeholder,
  onChange,
  label,
}: {
  block: TemplateBlock & { title: string | null };
  placeholder: string;
  onChange: Change;
  label?: string;
}) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <TextControl
      id={`${block.id}-title`}
      label={label ?? t("title")}
      hint={t("titleHint")}
      value={block.title ?? ""}
      placeholder={placeholder}
      maxLength={TEMPLATE_LIMITS.title}
      onChange={(value) => onChange({ ...block, title: value === "" ? null : value } as TemplateBlock, "title")}
    />
  );
}

function ColumnsEditor({
  id,
  legend,
  columns,
  names,
  onChange,
}: {
  id: string;
  legend: string;
  columns: { key: DeviceColumnKey; width: number }[];
  names: Record<DeviceColumnKey, string>;
  onChange: (columns: { key: DeviceColumnKey; width: number }[], field: string) => void;
}) {
  const t = useTranslations("protocolTemplates.properties");
  const unused = DEVICE_COLUMNS.filter((key) => !columns.some((column) => column.key === key));
  const total = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-ui">{legend}</legend>
      <p className="text-ui-sm text-muted-foreground">{t("columnsHint")}</p>
      <ol className="space-y-1.5">
        {columns.map((column, index) => (
          <li key={column.key} className="flex items-center gap-1.5">
            <NativeSelect
              aria-label={t("columnFor", { index: index + 1 })}
              className="min-w-0 flex-1"
              value={column.key}
              onChange={(event) =>
                onChange(
                  columns.map((item, i) =>
                    i === index ? { ...item, key: event.target.value as DeviceColumnKey } : item,
                  ),
                  `${id}.key`,
                )
              }
            >
              {DEVICE_COLUMNS.filter((key) => key === column.key || unused.includes(key)).map((key) => (
                <option key={key} value={key}>
                  {names[key]}
                </option>
              ))}
            </NativeSelect>
            <InlineNumber
              label={t("widthFor", { name: names[column.key] })}
              value={column.width}
              min={3}
              max={80}
              onChange={(width) =>
                onChange(
                  columns.map((item, i) => (i === index ? { ...item, width } : item)),
                  `${id}.${column.key}.width`,
                )
              }
            />
            <span className="w-10 text-end text-ui-sm text-muted-foreground tabular-nums" aria-hidden>
              {Math.round((column.width * 100) / total)} %
            </span>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={t("columnUp", { name: names[column.key] })}
              disabled={index === 0}
              onClick={() => onChange(move(columns, index, -1), `${id}.order`)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={t("columnDown", { name: names[column.key] })}
              disabled={index === columns.length - 1}
              onClick={() => onChange(move(columns, index, 1), `${id}.order`)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={t("columnRemove", { name: names[column.key] })}
              disabled={columns.length === 1}
              onClick={() => onChange(columns.filter((_, i) => i !== index), `${id}.remove`)}
            >
              <TrashIcon />
            </Button>
          </li>
        ))}
      </ol>
      {unused.length > 0 && columns.length < TEMPLATE_LIMITS.columns && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...columns, { key: unused[0]!, width: 12 }], `${id}.add`)}
        >
          <AddIcon />
          {t("columnAdd")}
        </Button>
      )}
    </fieldset>
  );
}

function HeaderProperties({ block, onChange, placeholders }: { block: BlockOf<"header">; onChange: Change; placeholders: Placeholders }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <p className="flex items-start gap-2 text-ui text-muted-foreground">
        <LockIcon className="mt-0.5 shrink-0" />
        {t("headerLocked")}
      </p>
      <TitleField block={block} placeholder={placeholders.title} onChange={onChange} label={t("documentTitle")} />
      <CheckControl
        id={`${block.id}-logo`}
        label={t("logoShow")}
        checked={block.logo.show}
        onChange={(show) => onChange({ ...block, logo: { ...block.logo, show } }, "logo.show")}
      />
      {block.logo.show && (
        <>
          <SelectControl
            id={`${block.id}-logo-position`}
            label={t("logoPosition")}
            value={block.logo.position}
            options={LOGO_POSITIONS.map((value) => ({ value, label: t(`logoPositions.${value}`) }))}
            onChange={(position) => onChange({ ...block, logo: { ...block.logo, position } }, "logo.position")}
          />
          <NumberControl
            id={`${block.id}-logo-height`}
            label={t("logoHeight")}
            unit="mm"
            value={block.logo.heightMm}
            min={6}
            max={40}
            onChange={(heightMm) => onChange({ ...block, logo: { ...block.logo, heightMm } }, "logo.height")}
          />
        </>
      )}
      <ChoiceList
        id={`${block.id}-company`}
        legend={t("companyFields")}
        all={COMPANY_FIELDS}
        chosen={block.company}
        labels={(value) => t(`companyField.${value}`)}
        onChange={(company) => onChange({ ...block, company }, "company")}
      />
      <CheckControl
        id={`${block.id}-date`}
        label={t("headerDate")}
        checked={block.date}
        onChange={(date) => onChange({ ...block, date }, "date")}
      />
    </>
  );
}

function PartiesProperties({ block, onChange }: { block: BlockOf<"parties">; onChange: Change }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <CheckControl
        id={`${block.id}-customer`}
        label={t("customerShow")}
        checked={block.customer.show}
        onChange={(show) => onChange({ ...block, customer: { ...block.customer, show } }, "customer.show")}
      />
      {block.customer.show && (
        <ChoiceList
          id={`${block.id}-customer-fields`}
          legend={t("customerFields")}
          all={CUSTOMER_FIELDS}
          chosen={block.customer.fields}
          labels={(value) => t(`customerField.${value}`)}
          onChange={(fields) => onChange({ ...block, customer: { ...block.customer, fields } }, "customer.fields")}
        />
      )}
      <CheckControl
        id={`${block.id}-site`}
        label={t("siteShow")}
        checked={block.site.show}
        onChange={(show) => onChange({ ...block, site: { ...block.site, show } }, "site.show")}
      />
      {block.site.show && (
        <CheckControl
          id={`${block.id}-site-address`}
          label={t("siteAddress")}
          checked={block.site.address}
          onChange={(address) => onChange({ ...block, site: { ...block.site, address } }, "site.address")}
        />
      )}
      <ChoiceList
        id={`${block.id}-facts`}
        legend={t("facts")}
        all={FACTS}
        chosen={block.facts}
        labels={(value) => t(`fact.${value}`)}
        onChange={(facts) => onChange({ ...block, facts }, "facts")}
      />
      <p className="text-ui-sm text-muted-foreground">{t("emptyHint")}</p>
    </>
  );
}

function DevicesProperties({ block, onChange, placeholders }: { block: BlockOf<"devices">; onChange: Change; placeholders: Placeholders }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <TitleField block={block} placeholder={placeholders.devices} onChange={onChange} />
      <CheckControl
        id={`${block.id}-summary`}
        label={t("devicesSummary")}
        checked={block.summary}
        onChange={(summary) => onChange({ ...block, summary }, "summary")}
      />
      <CheckControl
        id={`${block.id}-details`}
        label={t("devicesDetails")}
        checked={block.details}
        onChange={(details) => onChange({ ...block, details }, "details")}
      />
      <ColumnsEditor
        id={`${block.id}-columns`}
        legend={t("columns")}
        columns={block.columns}
        names={placeholders.columns}
        onChange={(columns, field) => onChange({ ...block, columns }, field)}
      />
      <CheckControl
        id={`${block.id}-scan-layout`}
        label={t("columnsWithScan")}
        checked={block.columnsWithScan !== null}
        onChange={(own) =>
          onChange(
            {
              ...block,
              columnsWithScan: own
                ? [...block.columns.filter((column) => column.key !== "scan"), { key: "scan", width: 13 }]
                : null,
            },
            "columnsWithScan",
          )
        }
      />
      {block.columnsWithScan ? (
        <ColumnsEditor
          id={`${block.id}-scan-columns`}
          legend={t("columnsWithScanLegend")}
          columns={block.columnsWithScan}
          names={placeholders.columns}
          onChange={(columnsWithScan, field) => onChange({ ...block, columnsWithScan }, field)}
        />
      ) : (
        <p className="text-ui-sm text-muted-foreground">{t("columnsWithScanHint")}</p>
      )}
    </>
  );
}

function DefectsProperties({ block, onChange, placeholders }: { block: BlockOf<"defects">; onChange: Change; placeholders: Placeholders }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <TitleField block={block} placeholder={placeholders.defects} onChange={onChange} />
      <NumberControl
        id={`${block.id}-photos`}
        label={t("photosPerDefect")}
        integer
        value={block.photos.perDefect}
        min={0}
        max={TEMPLATE_LIMITS.photosPerDefect}
        onChange={(perDefect) => onChange({ ...block, photos: { ...block.photos, perDefect } }, "photos.count")}
      />
      {block.photos.perDefect > 0 && (
        <NumberControl
          id={`${block.id}-photo-width`}
          label={t("photoWidth")}
          unit="mm"
          value={block.photos.widthMm}
          min={15}
          max={80}
          onChange={(widthMm) => onChange({ ...block, photos: { ...block.photos, widthMm } }, "photos.width")}
        />
      )}
      <SelectControl
        id={`${block.id}-empty`}
        label={t("whenEmpty")}
        value={block.whenEmpty}
        options={(["text", "hide"] as const).map((value) => ({ value, label: t(`whenEmptyOption.${value}`) }))}
        onChange={(whenEmpty) => onChange({ ...block, whenEmpty }, "whenEmpty")}
      />
    </>
  );
}

function GalleryProperties({ block, onChange, placeholders }: { block: BlockOf<"gallery">; onChange: Change; placeholders: Placeholders }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <TitleField block={block} placeholder={placeholders.gallery} onChange={onChange} />
      <SelectControl
        id={`${block.id}-source`}
        label={t("gallerySource")}
        value={block.source}
        options={GALLERY_SOURCES.map((value) => ({ value, label: t(`gallerySources.${value}`) }))}
        onChange={(source) => onChange({ ...block, source }, "source")}
      />
      <NumberControl
        id={`${block.id}-per-row`}
        label={t("perRow")}
        integer
        value={block.perRow}
        min={1}
        max={6}
        onChange={(perRow) => onChange({ ...block, perRow }, "perRow")}
      />
      <NumberControl
        id={`${block.id}-max`}
        label={t("galleryMax")}
        integer
        value={block.max}
        min={1}
        max={TEMPLATE_LIMITS.galleryPhotos}
        onChange={(max) => onChange({ ...block, max }, "max")}
      />
      <CheckControl
        id={`${block.id}-captions`}
        label={t("captions")}
        checked={block.captions}
        onChange={(captions) => onChange({ ...block, captions }, "captions")}
      />
    </>
  );
}

function TextProperties({ block, onChange }: { block: BlockOf<"text">; onChange: Change }) {
  const t = useTranslations("protocolTemplates.properties");
  return (
    <>
      <TextControl
        id={`${block.id}-title`}
        label={t("titleOptional")}
        value={block.title ?? ""}
        maxLength={TEMPLATE_LIMITS.title}
        onChange={(value) => onChange({ ...block, title: value === "" ? null : value }, "title")}
      />
      <SelectControl
        id={`${block.id}-variant`}
        label={t("textVariant")}
        value={block.variant}
        options={(["normal", "note"] as const).map((value) => ({ value, label: t(`textVariants.${value}`) }))}
        onChange={(variant) => onChange({ ...block, variant }, "variant")}
      />
      <TextBody block={block} onChange={onChange} />
    </>
  );
}

/**
 * The text of a text block as typed: the field keeps what is written (a space
 * at the end of a line, empty lines), the block gets its paragraphs. A change
 * from elsewhere (undo) replaces the field.
 */
export function TextBody({
  block,
  onChange,
  idPrefix = "",
}: {
  block: BlockOf<"text">;
  onChange: Change;
  /** Another copy of the field on the page (the phone's texts) needs ids of its own. */
  idPrefix?: string;
}) {
  const t = useTranslations("protocolTemplates.properties");
  const [text, setText] = useState(() => richToText(block.content));
  const [shown, setShown] = useState(block.content);
  if (shown !== block.content) {
    setShown(block.content);
    if (JSON.stringify(textToRich(text)) !== JSON.stringify(block.content)) setText(richToText(block.content));
  }
  return (
    <TextControl
      id={`${idPrefix}${block.id}-content`}
      label={t("text")}
      hint={t("textHint")}
      multiline
      value={text}
      maxLength={TEMPLATE_LIMITS.text}
      onChange={(value) => {
        setText(value);
        onChange({ ...block, content: textToRich(value) }, "content");
      }}
    />
  );
}

function TableProperties({ block, onChange }: { block: BlockOf<"table">; onChange: Change }) {
  const t = useTranslations("protocolTemplates.properties");
  const setColumns = (columns: BlockOf<"table">["columns"], rows: string[][], field: string) =>
    onChange({ ...block, columns, rows }, field);
  return (
    <>
      <TextControl
        id={`${block.id}-title`}
        label={t("titleOptional")}
        value={block.title ?? ""}
        maxLength={TEMPLATE_LIMITS.title}
        onChange={(value) => onChange({ ...block, title: value === "" ? null : value }, "title")}
      />
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-ui">{t("tableColumns")}</legend>
        {block.columns.map((column, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              aria-label={t("tableColumnTitle", { index: index + 1 })}
              className="min-w-0 flex-1"
              value={column.title}
              maxLength={TEMPLATE_LIMITS.title}
              onChange={(event) =>
                setColumns(
                  block.columns.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)),
                  block.rows,
                  `column.${index}.title`,
                )
              }
            />
            <InlineNumber
              label={t("tableColumnWidth", { index: index + 1 })}
              value={column.width}
              min={3}
              max={80}
              onChange={(width) =>
                setColumns(
                  block.columns.map((item, i) => (i === index ? { ...item, width } : item)),
                  block.rows,
                  `column.${index}.width`,
                )
              }
            />
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={t("tableColumnRemove", { index: index + 1 })}
              disabled={block.columns.length === 1}
              onClick={() =>
                setColumns(
                  block.columns.filter((_, i) => i !== index),
                  block.rows.map((row) => row.filter((_, i) => i !== index)),
                  "column.remove",
                )
              }
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
        {block.columns.length < TEMPLATE_LIMITS.manualColumns && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setColumns([...block.columns, { title: "", width: 20 }], block.rows.map((row) => [...row, ""]), "column.add")
            }
          >
            <AddIcon />
            {t("tableColumnAdd")}
          </Button>
        )}
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-ui">{t("tableRows")}</legend>
        {block.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-1.5">
            {row.map((cell, cellIndex) => (
              <Input
                key={cellIndex}
                aria-label={t("tableCell", { row: rowIndex + 1, column: block.columns[cellIndex]?.title || cellIndex + 1 })}
                className="min-w-0 flex-1"
                value={cell}
                maxLength={TEMPLATE_LIMITS.cell}
                onChange={(event) =>
                  setColumns(
                    block.columns,
                    block.rows.map((item, r) =>
                      r === rowIndex ? item.map((value, c) => (c === cellIndex ? event.target.value : value)) : item,
                    ),
                    `cell.${rowIndex}.${cellIndex}`,
                  )
                }
              />
            ))}
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={t("tableRowRemove", { index: rowIndex + 1 })}
              onClick={() => setColumns(block.columns, block.rows.filter((_, r) => r !== rowIndex), "row.remove")}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
        {block.rows.length < TEMPLATE_LIMITS.manualRows && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColumns(block.columns, [...block.rows, block.columns.map(() => "")], "row.add")}
          >
            <AddIcon />
            {t("tableRowAdd")}
          </Button>
        )}
      </fieldset>
    </>
  );
}

function SignaturesProperties({ block, onChange, placeholders }: { block: BlockOf<"signatures">; onChange: Change; placeholders: Placeholders }) {
  const t = useTranslations("protocolTemplates.properties");
  const fields = block.fields;
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-ui">{t("signatureFields")}</legend>
        {fields.map((field, index) => (
          <div key={index} className="space-y-1.5 rounded-md p-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
            <div className="flex items-center gap-1.5">
              <NativeSelect
                aria-label={t("signatureRole", { index: index + 1 })}
                className="min-w-0 flex-1"
                value={field.role}
                onChange={(event) =>
                  onChange(
                    {
                      ...block,
                      fields: fields.map((item, i) =>
                        i === index ? { ...item, role: event.target.value as typeof field.role } : item,
                      ),
                    },
                    `field.${index}.role`,
                  )
                }
              >
                {SIGNATURE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`signatureRoles.${role}`)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={t("signatureRemove", { index: index + 1 })}
                disabled={fields.length === 1}
                onClick={() => onChange({ ...block, fields: fields.filter((_, i) => i !== index) }, "field.remove")}
              >
                <TrashIcon />
              </Button>
            </div>
            <Input
              aria-label={t("signatureLabel", { index: index + 1 })}
              value={field.label ?? ""}
              placeholder={placeholders.signatures[field.role]}
              maxLength={TEMPLATE_LIMITS.title}
              onChange={(event) =>
                onChange(
                  {
                    ...block,
                    fields: fields.map((item, i) =>
                      i === index ? { ...item, label: event.target.value === "" ? null : event.target.value } : item,
                    ),
                  },
                  `field.${index}.label`,
                )
              }
            />
          </div>
        ))}
        {fields.length < TEMPLATE_LIMITS.signatures && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...block, fields: [...fields, { role: "other", label: null }] }, "field.add")}
          >
            <AddIcon />
            {t("signatureAdd")}
          </Button>
        )}
      </fieldset>
      <p className="text-ui-sm text-muted-foreground">{t("signatureCustomerHint")}</p>
      <CheckControl
        id={`${block.id}-hint`}
        label={t("signatureHint")}
        checked={block.hint}
        onChange={(hint) => onChange({ ...block, hint }, "hint")}
      />
    </>
  );
}

export function BlockProperties({
  block,
  onChange,
  placeholders,
}: {
  block: TemplateBlock;
  onChange: Change;
  placeholders: Placeholders;
}) {
  const t = useTranslations("protocolTemplates.properties");
  switch (block.type) {
    case "header":
      return <HeaderProperties block={block} onChange={onChange} placeholders={placeholders} />;
    case "parties":
      return <PartiesProperties block={block} onChange={onChange} />;
    case "summary":
      return (
        <>
          <TitleField block={block} placeholder={placeholders.summary} onChange={onChange} />
          <SelectControl
            id={`${block.id}-style`}
            label={t("summaryStyle")}
            value={block.style}
            options={(["sentence", "table"] as const).map((value) => ({ value, label: t(`summaryStyles.${value}`) }))}
            onChange={(style) => onChange({ ...block, style }, "style")}
          />
        </>
      );
    case "devices":
      return <DevicesProperties block={block} onChange={onChange} placeholders={placeholders} />;
    case "checklist":
      return (
        <>
          <TitleField block={block} placeholder={placeholders.checklist} onChange={onChange} />
          <SelectControl
            id={`${block.id}-style`}
            label={t("checklistStyle")}
            value={block.style}
            options={(["compact", "detailed"] as const).map((value) => ({ value, label: t(`checklistStyles.${value}`) }))}
            onChange={(style) => onChange({ ...block, style }, "style")}
          />
        </>
      );
    case "defects":
      return <DefectsProperties block={block} onChange={onChange} placeholders={placeholders} />;
    case "gallery":
      return <GalleryProperties block={block} onChange={onChange} placeholders={placeholders} />;
    case "notes":
      return (
        <>
          <TitleField block={block} placeholder={placeholders.notes} onChange={onChange} />
          <p className="text-ui-sm text-muted-foreground">{t("notesHint")}</p>
        </>
      );
    case "text":
      return <TextProperties block={block} onChange={onChange} />;
    case "table":
      return <TableProperties block={block} onChange={onChange} />;
    case "signatures":
      return <SignaturesProperties block={block} onChange={onChange} placeholders={placeholders} />;
    case "spacer":
      return (
        <NumberControl
          id={`${block.id}-height`}
          label={t("spacerHeight")}
          unit="mm"
          value={block.heightMm}
          min={1}
          max={100}
          onChange={(heightMm) => onChange({ ...block, heightMm }, "height")}
        />
      );
    case "divider":
      return <p className="text-ui text-muted-foreground">{t("dividerHint")}</p>;
    case "pageBreak":
      return <p className="text-ui text-muted-foreground">{t("pageBreakHint")}</p>;
  }
}

import "server-only";
import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer";
import type { ProtocolDeviceRow, ProtocolModel } from "@/lib/protocol";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import type {
  BlockOf,
  DeviceColumnKey,
  Inline,
  ProtocolTemplate,
  RichText,
  TemplateBlock,
} from "@/lib/protocol-template/schema";
import { FONT, renderPdf } from "./fonts";

// The inspection protocol, laid out block by block as its template says
// (part 22). Black on white with grey rules only, so it reads the same from a
// black-and-white printer; results are words, not colours. The default template
// gives the protocol as it looked before templates (tests/protocol-golden).
// Table, Section and the measurements are also used by the summary report
// (src/lib/pdf/protocol-summary.tsx), so the two documents read alike.
//
// Images reach this file only as bytes our server has loaded from the
// company's own storage: a template holds no addresses, so drawing a protocol
// never fetches anything.

export const MM = 72 / 25.4;
export const INK = "#000000";
export const MUTED = "#444444";
export const RULE = "#9a9a9a";
export const SHADE = "#e9e9e9";

/** A4 in points. */
const A4 = { width: 595.28, height: 841.89 };

export type ProtocolLogo = { data: Buffer; format: "png" | "jpg" };

/** Roughly how many lines the footer takes (7 pt over 120 mm is ~110 characters). */
function footerLines(footer: string | null) {
  if (!footer) return 1;
  return footer
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 110)), 0);
}

export const label = { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.3 } as const;

export function Box({ title, name, lines }: { title: string; name: string; lines: string[] }) {
  return (
    <View style={{ flex: 1, paddingRight: 4 * MM }}>
      <Text style={label}>{title.toUpperCase()}</Text>
      <Text style={{ fontSize: 9.5, fontWeight: 700, marginTop: 1 * MM }}>{name}</Text>
      {lines.map((line, index) => (
        <Text key={index} style={{ color: MUTED }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export type Column = { key: string; title: string; width: string };

export function Table<Row>({
  columns,
  rows,
  cell,
  below,
  emphasis,
}: {
  columns: Column[];
  rows: Row[];
  cell: (row: Row, key: string) => string;
  below?: (row: Row) => string[];
  emphasis?: (row: Row, key: string) => boolean;
}) {
  const first = columns[0]?.width ?? "0%";
  return (
    <View>
      {/* Repeated at the top of every page the table continues on. */}
      <View
        fixed
        style={{
          flexDirection: "row",
          backgroundColor: SHADE,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        {columns.map((column) => (
          <Text
            key={column.key}
            style={{
              width: column.width,
              paddingVertical: 1.4 * MM,
              paddingHorizontal: 1.2 * MM,
              fontSize: 7.5,
              fontWeight: 700,
            }}
          >
            {column.title}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => {
        const notes = below?.(row) ?? [];
        return (
          <View
            key={index}
            wrap={false}
            style={{ borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 1.1 * MM }}
          >
            <View style={{ flexDirection: "row" }}>
              {columns.map((column) => (
                <Text
                  key={column.key}
                  style={{
                    width: column.width,
                    paddingHorizontal: 1.2 * MM,
                    fontWeight: emphasis?.(row, column.key) ? 700 : 400,
                  }}
                >
                  {cell(row, column.key)}
                </Text>
              ))}
            </View>
            {notes.map((note, line) => (
              <Text
                key={line}
                style={{
                  marginLeft: first,
                  paddingHorizontal: 1.2 * MM,
                  paddingTop: line === 0 ? 0.6 * MM : 0,
                  fontSize: 7.5,
                  color: MUTED,
                }}
              >
                {note}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 6 * MM }}>
      <Text style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 2 * MM }} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Shares of the line as percentages that fill it ("9%" for 9 of 100). */
export function columnWidths<C extends { width: number }>(columns: C[]): (C & { share: string })[] {
  const sum = columns.reduce((total, column) => total + column.width, 0) || 1;
  return columns.map((column) => ({ ...column, share: `${(column.width * 100) / sum}%` }));
}

/** The device table's columns: the scan column only when the protocol reports scans. */
export function deviceColumns(block: BlockOf<"devices">, withScan: boolean) {
  if (withScan) {
    if (block.columnsWithScan) return block.columnsWithScan;
    return block.columns.some((column) => column.key === "scan")
      ? block.columns
      : [...block.columns, { key: "scan" as DeviceColumnKey, width: 13 }];
  }
  return block.columns.filter((column) => column.key !== "scan");
}

export type ProtocolPhoto = { image: ProtocolLogo; caption: string };

export type ProtocolAssets = {
  logo?: ProtocolLogo | null;
  signature?: ProtocolLogo | null;
  /** Photos per defect, keyed by its raw (untranslated) number, oldest first. */
  defectPhotos?: Map<number, ProtocolLogo[]>;
  /** Photos taken during the checks, with the device's label as their caption. */
  inspectionPhotos?: ProtocolPhoto[];
};

type Context = {
  model: ProtocolModel;
  assets: Required<ProtocolAssets>;
  template: ProtocolTemplate;
  /** The width the content may take, in points. */
  contentWidth: number;
};

// ---------------------------------------------------------------------------
// Formatted text
// ---------------------------------------------------------------------------

function Inlines({ content }: { content: Inline[] }) {
  return content.map((inline, index) => {
    // Italic waits for the italic font (part 22, stage C); until then upright.
    const style = { fontWeight: inline.bold ? 700 : 400 } as const;
    return inline.link ? (
      <Link key={index} src={inline.link} style={{ ...style, color: INK }}>
        {inline.text}
      </Link>
    ) : (
      <Text key={index} style={style}>
        {inline.text}
      </Text>
    );
  });
}

function RichTextView({ content, size }: { content: RichText; size: number }) {
  return content.map((node, index) => {
    const top = index === 0 ? 0 : 1.5 * MM;
    if (node.type === "heading")
      return (
        <Text
          key={index}
          minPresenceAhead={20}
          style={{ fontWeight: 700, fontSize: size + [3, 2, 1][node.level - 1]!, marginTop: top }}
        >
          <Inlines content={node.content} />
        </Text>
      );
    if (node.type === "list")
      return (
        <View key={index} style={{ marginTop: top }}>
          {node.items.map((item, line) => (
            <View key={line} style={{ flexDirection: "row" }} wrap={false}>
              <Text style={{ width: 5 * MM }}>{node.ordered ? `${line + 1}.` : "•"}</Text>
              <Text style={{ flex: 1 }}>
                <Inlines content={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    return (
      <Text key={index} style={{ marginTop: top }}>
        <Inlines content={node.content} />
      </Text>
    );
  });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function HeaderBlock({ block, context }: { block: BlockOf<"header">; context: Context }) {
  const { model, assets } = context;
  const logo = block.logo.show ? assets.logo : null;
  const height = block.logo.heightMm * MM;
  const logoImage = (style: object) =>
    logo && (
      // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img>
      <Image
        src={logo}
        style={{ height, maxWidth: 3 * height, objectFit: "contain", ...style }}
      />
    );
  const company = block.company.flatMap((field) =>
    field === "address" ? model.organization.address : [model.organization[field]],
  );
  const date = model.facts.find((fact) => fact.key === "date");
  return (
    <View>
      {block.logo.position === "center" && (
        <View style={{ alignItems: "center", marginBottom: 3 * MM }}>{logoImage({})}</View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: 4 * MM,
          borderBottomWidth: 1.2,
          borderBottomColor: INK,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
          {block.logo.position === "left" && logoImage({ marginRight: 5 * MM })}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>{model.organization.name}</Text>
            {company.filter(Boolean).map((line, index) => (
              <Text key={index} style={{ color: MUTED, fontSize: 8 }}>
                {line}
              </Text>
            ))}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", marginLeft: 6 * MM }}>
          <Text style={{ fontSize: 15, fontWeight: 700 }}>{block.title || model.title}</Text>
          <Text style={{ ...label, marginTop: 3 * MM }}>{model.numberLabel.toUpperCase()}</Text>
          <Text style={{ fontSize: 13, fontWeight: 700 }}>{model.number}</Text>
          {block.date && date && (
            <>
              <Text style={{ ...label, marginTop: 2 * MM }}>{date.label.toUpperCase()}</Text>
              <Text style={{ fontWeight: 700 }}>{date.value}</Text>
            </>
          )}
        </View>
        {block.logo.position === "right" && logoImage({ marginLeft: 5 * MM })}
      </View>
    </View>
  );
}

function PartiesBlock({ block, context }: { block: BlockOf<"parties">; context: Context }) {
  const { model } = context;
  const customer = block.customer.fields
    .flatMap((field) =>
      field === "billingAddress" ? model.customer.billingAddress : [model.customer[field]],
    )
    .filter(Boolean);
  const facts = block.facts.flatMap((key) => model.facts.filter((fact) => fact.key === key));
  return (
    <View style={{ flexDirection: "row", marginTop: 5 * MM }}>
      {block.customer.show && (
        <Box title={model.customer.label} name={model.customer.name} lines={customer} />
      )}
      {block.site.show && (
        <Box
          title={model.site.label}
          name={model.site.name}
          lines={block.site.address ? model.site.address : []}
        />
      )}
      {facts.length > 0 && (
        <View style={{ flex: 1 }}>
          {facts.map((fact) => (
            <View key={fact.key} style={{ marginBottom: 1.5 * MM }}>
              <Text style={label}>{fact.label.toUpperCase()}</Text>
              <Text style={{ fontWeight: 700 }}>{fact.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SummaryBlock({ block, context }: { block: BlockOf<"summary">; context: Context }) {
  const { model } = context;
  const { counts, countLabels } = model;
  if (block.style === "sentence")
    return (
      <Section title={block.title || model.titles.summary}>
        <Text style={{ fontWeight: 700 }}>{model.result}</Text>
        <Text>{model.summary}</Text>
      </Section>
    );
  const rows = [
    { name: countLabels.result, value: model.result },
    { name: countLabels.total, value: String(counts.total) },
    { name: countLabels.passed, value: String(counts.passed) },
    { name: countLabels.failed, value: String(counts.failed) },
    { name: countLabels.notChecked, value: String(counts.notChecked) },
    { name: countLabels.defects, value: String(counts.defects) },
  ];
  return (
    <Section title={block.title || model.titles.summary}>
      {rows.map((row, index) => (
        <View
          key={row.name}
          wrap={false}
          style={{
            flexDirection: "row",
            borderBottomWidth: 0.5,
            borderBottomColor: RULE,
            paddingVertical: 1.1 * MM,
          }}
        >
          <Text style={{ width: "35%", paddingHorizontal: 1.2 * MM, color: MUTED }}>{row.name}</Text>
          <Text style={{ flex: 1, paddingHorizontal: 1.2 * MM, fontWeight: index === 0 ? 700 : 400 }}>
            {row.value}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function DevicesBlock({ block, context }: { block: BlockOf<"devices">; context: Context }) {
  const { model } = context;
  const columns = columnWidths(deviceColumns(block, !!model.scan)).map((column) => ({
    key: column.key,
    title: model.columns[column.key],
    width: column.share,
  }));
  return (
    <Section title={block.title || model.titles.devices}>
      {block.summary && <Text style={{ marginBottom: 2 * MM }}>{model.summary}</Text>}
      {block.summary && model.scan && (
        <Text style={{ marginBottom: 2 * MM }}>{model.scan.summary}</Text>
      )}
      {model.devices.length > 0 && (
        <Table
          columns={columns}
          rows={model.devices}
          cell={(row, key) => row[key as keyof ProtocolDeviceRow] as string}
          below={block.details ? (row) => row.details : undefined}
          emphasis={(row, key) => key === "label" || (key === "result" && row.failed)}
        />
      )}
      {model.scan && (
        <Text style={{ fontSize: 7, color: MUTED, marginTop: 1.5 * MM }}>
          {model.scan.disclaimer}
        </Text>
      )}
    </Section>
  );
}

function ChecklistBlock({ block, context }: { block: BlockOf<"checklist">; context: Context }) {
  const { model } = context;
  const heading = (device: ProtocolDeviceRow) =>
    [device.label, device.type, device.location !== "—" ? device.location : null]
      .filter(Boolean)
      .join(" · ");
  return (
    <Section title={block.title || model.titles.checklist}>
      {model.devices.map((device, index) =>
        block.style === "compact" ? (
          <View
            key={index}
            wrap={false}
            style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 1.1 * MM }}
          >
            <Text style={{ width: "30%", paddingHorizontal: 1.2 * MM, fontWeight: 700 }}>
              {heading(device)}
            </Text>
            <Text style={{ flex: 1, paddingHorizontal: 1.2 * MM }}>
              {device.answers.length > 0
                ? device.answers.map((answer) => `${answer.question}: ${answer.value}`).join("; ")
                : model.noAnswers}
            </Text>
          </View>
        ) : (
          <View key={index} style={{ marginBottom: 3 * MM }}>
            <Text style={{ fontWeight: 700, marginBottom: 1 * MM }} minPresenceAhead={30}>
              {heading(device)} · {device.result}
            </Text>
            {device.answers.length === 0 && <Text style={{ color: MUTED }}>{model.noAnswers}</Text>}
            {device.answers.map((answer, line) => (
              <View
                key={line}
                wrap={false}
                style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 0.8 * MM }}
              >
                <Text style={{ width: "60%", paddingHorizontal: 1.2 * MM }}>{answer.question}</Text>
                <Text style={{ flex: 1, paddingHorizontal: 1.2 * MM, fontWeight: answer.failed ? 700 : 400 }}>
                  {answer.value}
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </Section>
  );
}

function PhotoGrid({
  photos,
  width,
  gap = 3 * MM,
  captions = true,
}: {
  photos: { key: string; image: ProtocolLogo; caption: string }[];
  width: number;
  gap?: number;
  captions?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 * MM }}>
      {photos.map((photo) => (
        <View key={photo.key} wrap={false} style={{ width, marginRight: gap, marginBottom: gap }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img> */}
          <Image
            src={photo.image}
            style={{ width, height: width * 0.75, objectFit: "cover", borderWidth: 0.5, borderColor: RULE }}
          />
          {captions && (
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 0.5 * MM }}>{photo.caption}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

/** Defect photos with the defect's number as their caption, at most `perDefect` each. */
function defectPhotoList(context: Context, perDefect: number) {
  const { model, assets } = context;
  return [...assets.defectPhotos.entries()].flatMap(([number, images]) =>
    images.slice(0, perDefect).map((image, index) => ({
      key: `${number}-${index}`,
      caption: model.defects.find((defect) => defect.rawNumber === number)?.number ?? "",
      image,
    })),
  );
}

function DefectsBlock({ block, context }: { block: BlockOf<"defects">; context: Context }) {
  const { model } = context;
  if (model.defects.length === 0 && block.whenEmpty === "hide") return null;
  const photos = block.photos.perDefect > 0 ? defectPhotoList(context, block.photos.perDefect) : [];
  return (
    <Section title={block.title || model.titles.defects}>
      {model.defects.length > 0 ? (
        <Table
          columns={[
            { key: "number", title: model.defectColumns.number, width: "12%" },
            { key: "device", title: model.defectColumns.device, width: "10%" },
            { key: "description", title: model.defectColumns.description, width: "60%" },
            { key: "severity", title: model.defectColumns.severity, width: "18%" },
          ]}
          rows={model.defects}
          cell={(row, key) => row[key as keyof typeof row] as string}
          emphasis={(_, key) => key === "number"}
        />
      ) : (
        <Text>{model.noDefects}</Text>
      )}
      {photos.length > 0 && <PhotoGrid photos={photos} width={block.photos.widthMm * MM} />}
    </Section>
  );
}

function GalleryBlock({ block, context }: { block: BlockOf<"gallery">; context: Context }) {
  const { assets } = context;
  const fromChecks =
    block.source === "defects"
      ? []
      : assets.inspectionPhotos.map((photo, index) => ({ key: `i-${index}`, ...photo }));
  const fromDefects =
    block.source === "inspection" ? [] : defectPhotoList(context, Number.MAX_SAFE_INTEGER);
  const photos = [...fromChecks, ...fromDefects].slice(0, block.max);
  if (photos.length === 0) return null;
  const gap = 3 * MM;
  // The last photo of a row keeps its margin; one point of slack keeps rows whole.
  const width = (context.contentWidth - gap * block.perRow - 1) / block.perRow;
  return (
    <Section title={block.title || context.model.titles.gallery}>
      <PhotoGrid photos={photos} width={width} gap={gap} captions={block.captions} />
    </Section>
  );
}

function NotesBlock({ block, context }: { block: BlockOf<"notes">; context: Context }) {
  if (!context.model.notes) return null;
  return (
    <Section title={block.title || context.model.titles.notes}>
      <Text>{context.model.notes}</Text>
    </Section>
  );
}

function TextBlock({ block, context }: { block: BlockOf<"text">; context: Context }) {
  const note = block.variant === "note";
  const size = note ? 7 : context.template.style.size;
  const body = (
    <View style={note ? { fontSize: size, color: MUTED } : undefined}>
      <RichTextView content={block.content} size={size} />
    </View>
  );
  if (block.title) return <Section title={block.title}>{body}</Section>;
  return <View style={{ marginTop: 4 * MM }}>{body}</View>;
}

function TableBlock({ block }: { block: BlockOf<"table"> }) {
  const columns = columnWidths(block.columns).map((column, index) => ({
    key: String(index),
    title: column.title,
    width: column.share,
  }));
  const content = (
    <Table columns={columns} rows={block.rows} cell={(row, key) => row[Number(key)] ?? ""} />
  );
  if (block.title) return <Section title={block.title}>{content}</Section>;
  return <View style={{ marginTop: 4 * MM }}>{content}</View>;
}

function SignaturesBlock({ block, context }: { block: BlockOf<"signatures">; context: Context }) {
  const { model, assets } = context;
  return (
    <View wrap={false} style={{ flexDirection: "row", marginTop: 10 * MM }}>
      {block.fields.map((field, index) => {
        const signer = field.role === "other" ? null : model.signatures[field.role];
        const fieldLabel = field.label || signer?.label || model.signatures.otherLabel;
        return (
          <View
            key={index}
            style={{ flex: 1, marginRight: index < block.fields.length - 1 ? 10 * MM : 0 }}
          >
            <Text style={label}>{fieldLabel.toUpperCase()}</Text>
            <Text style={{ marginTop: 1 * MM, minHeight: 12 }}>
              {[signer?.name, signer?.signedAt].filter(Boolean).join(" · ")}
            </Text>
            <View
              style={{
                height: 14 * MM,
                borderBottomWidth: 0.75,
                borderBottomColor: INK,
                justifyContent: "flex-end",
              }}
            >
              {/* The customer's finger signature, when given, instead of a blank line. */}
              {field.role === "customer" && assets.signature && (
                // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img>
                <Image
                  src={assets.signature}
                  style={{ height: 13 * MM, maxWidth: 55 * MM, objectFit: "contain", objectPositionX: 0 }}
                />
              )}
            </View>
            {block.hint && (
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 * MM }}>{model.signatureHint}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Block({ block, context }: { block: TemplateBlock; context: Context }) {
  switch (block.type) {
    case "header":
      return <HeaderBlock block={block} context={context} />;
    case "parties":
      return <PartiesBlock block={block} context={context} />;
    case "summary":
      return <SummaryBlock block={block} context={context} />;
    case "devices":
      return <DevicesBlock block={block} context={context} />;
    case "checklist":
      return <ChecklistBlock block={block} context={context} />;
    case "defects":
      return <DefectsBlock block={block} context={context} />;
    case "gallery":
      return <GalleryBlock block={block} context={context} />;
    case "notes":
      return <NotesBlock block={block} context={context} />;
    case "text":
      return <TextBlock block={block} context={context} />;
    case "table":
      return <TableBlock block={block} />;
    case "signatures":
      return <SignaturesBlock block={block} context={context} />;
    case "divider":
      return <View style={{ marginTop: 4 * MM, borderBottomWidth: 0.75, borderBottomColor: RULE }} />;
    case "spacer":
      return <View style={{ height: block.heightMm * MM }} />;
    case "pageBreak":
      return <View break />;
  }
}

export function ProtocolDocument({
  model,
  assets = {},
  template = DEFAULT_PROTOCOL_TEMPLATE,
}: {
  model: ProtocolModel;
  assets?: ProtocolAssets;
  template?: ProtocolTemplate;
}) {
  const { margins, orientation } = template.page;
  const landscape = orientation === "landscape";
  const pageWidth = landscape ? A4.height : A4.width;
  const footerText =
    template.footer.text === "organization"
      ? model.footer
      : template.footer.text === "custom"
        ? template.footer.custom.trim() || null
        : null;
  const footer = footerText !== null || template.footer.pageNumbers;
  const context: Context = {
    model,
    template,
    assets: {
      logo: assets.logo ?? null,
      signature: assets.signature ?? null,
      defectPhotos: assets.defectPhotos ?? new Map(),
      inspectionPhotos: assets.inspectionPhotos ?? [],
    },
    contentWidth: pageWidth - (margins.left + margins.right) * MM,
  };
  return (
    <Document
      title={`${model.title} ${model.number}`}
      author={model.organization.name}
      creator="SparxDeck"
      producer="SparxDeck"
      language={model.locale}
    >
      <Page
        size="A4"
        orientation={orientation}
        style={{
          fontFamily: FONT,
          fontSize: template.style.size,
          color: INK,
          paddingTop: margins.top * MM,
          paddingBottom: (margins.bottom + (footer ? footerLines(footerText) * 3.2 : 0)) * MM,
          paddingLeft: margins.left * MM,
          paddingRight: margins.right * MM,
        }}
      >
        {template.blocks
          .filter((block) => !block.hidden)
          .map((block) => (
            <Block key={block.id} block={block} context={context} />
          ))}

        {/* Footer on every page: the company's text and the page number. */}
        {footer && (
          <Text
            fixed
            style={{
              position: "absolute",
              left: margins.left * MM,
              bottom: 9 * MM,
              width: 120 * MM,
              fontSize: 7,
              color: MUTED,
            }}
          >
            {footerText ?? ""}
          </Text>
        )}
        {template.footer.pageNumbers && (
          <Text
            fixed
            style={{
              position: "absolute",
              right: margins.right * MM,
              bottom: 9 * MM,
              width: 55 * MM,
              fontSize: 7,
              color: MUTED,
              textAlign: "right",
            }}
            render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)}
          />
        )}
      </Page>
    </Document>
  );
}

export async function renderProtocolPdf(
  model: ProtocolModel,
  assets: ProtocolAssets = {},
  template: ProtocolTemplate = DEFAULT_PROTOCOL_TEMPLATE,
): Promise<Buffer> {
  return renderPdf(<ProtocolDocument model={model} assets={assets} template={template} />);
}

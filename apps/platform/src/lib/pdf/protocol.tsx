import "server-only";
import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ProtocolModel } from "@/lib/protocol";
import { FONT, registerFonts } from "./fonts";

// The inspection protocol on A4. Black on white with grey rules only, so it
// reads the same from a black-and-white printer; results are words, not colours.
// Table, Section and the measurements are also used by the summary report
// (src/lib/pdf/protocol-summary.tsx), so the two documents read alike.

export const MM = 72 / 25.4;
export const INK = "#000000";
export const MUTED = "#444444";
export const RULE = "#9a9a9a";
export const SHADE = "#e9e9e9";

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

export type ProtocolAssets = {
  logo?: ProtocolLogo | null;
  signature?: ProtocolLogo | null;
  /** Up to a few photos per defect, keyed by its raw (untranslated) number. */
  defectPhotos?: Map<number, ProtocolLogo[]>;
};

export function ProtocolDocument({
  model,
  assets = {},
}: {
  model: ProtocolModel;
  assets?: ProtocolAssets;
}) {
  const { logo = null, signature = null, defectPhotos = new Map<number, ProtocolLogo[]>() } = assets;
  const devices = model.devices;
  const photos = [...defectPhotos.entries()].flatMap(([number, images]) =>
    images.map((image, index) => ({
      key: `${number}-${index}`,
      caption: model.defects.find((defect) => defect.rawNumber === number)?.number ?? "",
      image,
    })),
  );
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
        style={{
          fontFamily: FONT,
          fontSize: 8.5,
          color: INK,
          paddingTop: 14 * MM,
          paddingBottom: (14 + footerLines(model.footer) * 3.2) * MM,
          paddingHorizontal: 15 * MM,
        }}
      >
        {/* Company and the protocol's number. */}
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
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img>
              <Image
                src={logo}
                style={{
                  height: 15 * MM,
                  maxWidth: 45 * MM,
                  objectFit: "contain",
                  marginRight: 5 * MM,
                }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{model.organization.name}</Text>
              {model.organization.lines.map((line, index) => (
                <Text key={index} style={{ color: MUTED, fontSize: 8 }}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", marginLeft: 6 * MM }}>
            <Text style={{ fontSize: 15, fontWeight: 700 }}>{model.title}</Text>
            <Text style={{ ...label, marginTop: 3 * MM }}>{model.numberLabel.toUpperCase()}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700 }}>{model.number}</Text>
          </View>
        </View>

        {/* Who, where, when. */}
        <View style={{ flexDirection: "row", marginTop: 5 * MM }}>
          {model.parties.map((party) => (
            <Box key={party.label} title={party.label} name={party.name} lines={party.lines} />
          ))}
          <View style={{ flex: 1 }}>
            {model.facts.map((fact) => (
              <View key={fact.label} style={{ marginBottom: 1.5 * MM }}>
                <Text style={label}>{fact.label.toUpperCase()}</Text>
                <Text style={{ fontWeight: 700 }}>{fact.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Section title={model.devicesTitle}>
          <Text style={{ marginBottom: 2 * MM }}>{model.summary}</Text>
          {devices.length > 0 && (
            <Table
              columns={[
                { key: "label", title: model.columns.label, width: "9%" },
                { key: "type", title: model.columns.type, width: "23%" },
                { key: "location", title: model.columns.location, width: "19%" },
                { key: "serial", title: model.columns.serial, width: "17%" },
                { key: "result", title: model.columns.result, width: "16%" },
                { key: "nextDue", title: model.columns.nextDue, width: "16%" },
              ]}
              rows={devices}
              cell={(row, key) => row[key as keyof typeof row] as string}
              below={(row) => row.details}
              emphasis={(row, key) => key === "label" || (key === "result" && row.failed)}
            />
          )}
        </Section>

        <Section title={model.defectsTitle}>
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
          {photos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 * MM }}>
              {photos.map((photo) => (
                <View key={photo.key} style={{ width: 28 * MM, marginRight: 3 * MM, marginBottom: 3 * MM }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img> */}
                  <Image
                    src={photo.image}
                    style={{
                      width: 28 * MM,
                      height: 21 * MM,
                      objectFit: "cover",
                      borderWidth: 0.5,
                      borderColor: RULE,
                    }}
                  />
                  <Text style={{ fontSize: 7, color: MUTED, marginTop: 0.5 * MM }}>
                    {photo.caption}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {model.notes && (
          <Section title={model.notesTitle}>
            <Text>{model.notes}</Text>
          </Section>
        )}

        {/* The technician signs on paper; the customer's finger signature (if
            given) is drawn into its box instead of left blank. */}
        <View wrap={false} style={{ flexDirection: "row", marginTop: 10 * MM }}>
          {model.signatures.map((entry, index) => (
            <View key={entry.label} style={{ flex: 1, marginRight: index === 0 ? 10 * MM : 0 }}>
              <Text style={label}>{entry.label.toUpperCase()}</Text>
              <Text style={{ marginTop: 1 * MM, minHeight: 12 }}>
                {[entry.name, entry.signedAt].filter(Boolean).join(" · ")}
              </Text>
              <View
                style={{
                  height: 14 * MM,
                  borderBottomWidth: 0.75,
                  borderBottomColor: INK,
                  justifyContent: "flex-end",
                }}
              >
                {index === 1 && signature && (
                  // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img>
                  <Image
                    src={signature}
                    style={{
                      height: 13 * MM,
                      maxWidth: 55 * MM,
                      objectFit: "contain",
                      objectPositionX: 0,
                    }}
                  />
                )}
              </View>
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 * MM }}>
                {model.signatureHint}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer on every page: the company's text and the page number. */}
        <Text
          fixed
          style={{
            position: "absolute",
            left: 15 * MM,
            bottom: 9 * MM,
            width: 120 * MM,
            fontSize: 7,
            color: MUTED,
          }}
        >
          {model.footer ?? ""}
        </Text>
        <Text
          fixed
          style={{
            position: "absolute",
            right: 15 * MM,
            bottom: 9 * MM,
            width: 55 * MM,
            fontSize: 7,
            color: MUTED,
            textAlign: "right",
          }}
          render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)}
        />
      </Page>
    </Document>
  );
}

export async function renderProtocolPdf(
  model: ProtocolModel,
  assets: ProtocolAssets = {},
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ProtocolDocument model={model} assets={assets} />);
}

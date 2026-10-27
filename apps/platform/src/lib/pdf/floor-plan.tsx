import "server-only";
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { DueState } from "@/lib/due";
import { FONT, renderPdf } from "./fonts";

// A floor plan on A4 (landscape for wide plans) with numbered markers, and the
// list of the devices on it. Marker colours follow the app; the state is also
// written out in the list, so a black-and-white print stays readable.

const MM = 72 / 25.4;
const INK = "#000000";
const MUTED = "#444444";
const RULE = "#9a9a9a";
const SHADE = "#e9e9e9";

const DOT: Record<DueState, string> = {
  overdue: "#db3737",
  soon: "#bf7326",
  ok: "#0f9960",
  never: "#738694",
};

export type FloorPlanPdfModel = {
  title: string;
  planName: string;
  /** Customer, building, address. */
  context: string[];
  organizationName: string;
  generated: string;
  image: { data: Buffer; format: "jpg" | "png"; width: number; height: number };
  markers: { x: number; y: number; label: string; due: DueState }[];
  legend: { due: DueState; label: string; count: number }[];
  devicesTitle: string;
  none: string;
  columns: { label: string; type: string; location: string; nextDue: string; state: string };
  rows: {
    label: string;
    type: string;
    location: string;
    nextDue: string;
    state: string;
    due: DueState;
  }[];
  page: (page: number, pages: number) => string;
};

function Footer({ model }: { model: FloorPlanPdfModel }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 8 * MM,
        left: 12 * MM,
        right: 12 * MM,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 7,
        color: MUTED,
      }}
    >
      <Text>{`${model.organizationName} · ${model.generated}`}</Text>
      <Text render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)} />
    </View>
  );
}

function FloorPlanDocument({ model }: { model: FloorPlanPdfModel }) {
  const landscape = model.image.width >= model.image.height;
  const pageWidth = (landscape ? 297 : 210) * MM;
  const pageHeight = (landscape ? 210 : 297) * MM;
  const margin = 12 * MM;
  const header = 20 * MM;
  const legend = 9 * MM;
  const footer = 12 * MM;
  const room = {
    width: pageWidth - 2 * margin,
    height: pageHeight - margin - header - legend - footer,
  };
  const scale = Math.min(room.width / model.image.width, room.height / model.image.height);
  const box = { width: model.image.width * scale, height: model.image.height * scale };

  const columns = [
    { key: "label", width: "12%" },
    { key: "type", width: "26%" },
    { key: "location", width: "26%" },
    { key: "nextDue", width: "18%" },
    { key: "state", width: "18%" },
  ] as const;

  return (
    <Document title={`${model.title}: ${model.planName}`} author={model.organizationName}>
      <Page
        size="A4"
        orientation={landscape ? "landscape" : "portrait"}
        style={{
          fontFamily: FONT,
          fontSize: 8.5,
          color: INK,
          padding: margin,
          paddingBottom: footer,
        }}
      >
        <View style={{ height: header, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 6 * MM }}>
            <Text style={{ fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.3 }}>
              {model.title.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 700, marginTop: 1 * MM }}>
              {model.planName}
            </Text>
            <Text style={{ color: MUTED, marginTop: 1 * MM }}>{model.context.join(" · ")}</Text>
          </View>
          <Text style={{ color: MUTED }}>{model.organizationName}</Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: box.width,
              height: box.height,
              borderWidth: 0.5,
              borderColor: RULE,
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an <img> */}
            <Image
              src={{ data: model.image.data, format: model.image.format }}
              style={{ width: box.width, height: box.height }}
            />
            {model.markers.map((marker, index) => (
              <View
                key={index}
                style={{
                  position: "absolute",
                  top: marker.y * box.height - 2 * MM,
                  alignItems: "center",
                  // Near the right edge the label goes left of the dot, inside the plan.
                  ...(marker.x > 0.85
                    ? { right: (1 - marker.x) * box.width - 2 * MM, flexDirection: "row-reverse" }
                    : { left: marker.x * box.width - 2 * MM, flexDirection: "row" }),
                }}
              >
                <View
                  style={{
                    width: 4 * MM,
                    height: 4 * MM,
                    borderRadius: 2 * MM,
                    backgroundColor: DOT[marker.due],
                    borderWidth: 0.8,
                    borderColor: "#ffffff",
                  }}
                />
                <Text
                  style={{
                    marginHorizontal: 0.6 * MM,
                    fontSize: 6.5,
                    fontWeight: 700,
                    backgroundColor: "#ffffff",
                    paddingHorizontal: 0.6 * MM,
                    borderWidth: 0.4,
                    borderColor: RULE,
                  }}
                >
                  {marker.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 5 * MM, marginTop: 3 * MM, color: MUTED }}>
          {model.legend.map((item) => (
            <View key={item.due} style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 2.6 * MM,
                  height: 2.6 * MM,
                  borderRadius: 1.3 * MM,
                  backgroundColor: DOT[item.due],
                  marginRight: 1.2 * MM,
                }}
              />
              <Text>{`${item.label} (${item.count})`}</Text>
            </View>
          ))}
        </View>
        <Footer model={model} />
      </Page>

      <Page
        size="A4"
        style={{
          fontFamily: FONT,
          fontSize: 8.5,
          color: INK,
          padding: margin,
          paddingBottom: footer + 4 * MM,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 * MM }}>
          {`${model.devicesTitle} · ${model.planName}`}
        </Text>
        {model.rows.length === 0 ? (
          <Text style={{ color: MUTED }}>{model.none}</Text>
        ) : (
          <View>
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
                  {model.columns[column.key]}
                </Text>
              ))}
            </View>
            {model.rows.map((row, index) => (
              <View
                key={index}
                wrap={false}
                style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE }}
              >
                {columns.map((column) => (
                  <Text
                    key={column.key}
                    style={{
                      width: column.width,
                      paddingVertical: 1.2 * MM,
                      paddingHorizontal: 1.2 * MM,
                      fontWeight:
                        column.key === "label" ||
                        (column.key === "state" && (row.due === "overdue" || row.due === "soon"))
                          ? 700
                          : 400,
                    }}
                  >
                    {row[column.key]}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
        <Footer model={model} />
      </Page>
    </Document>
  );
}

export async function renderFloorPlanPdf(model: FloorPlanPdfModel): Promise<Buffer> {
  return renderPdf(<FloorPlanDocument model={model} />);
}

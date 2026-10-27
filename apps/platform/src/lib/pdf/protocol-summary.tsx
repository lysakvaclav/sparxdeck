import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ProtocolSummaryModel } from "@/lib/protocol-summary";
import { FONT, renderPdf } from "./fonts";
import { INK, MM, MUTED, Section, Table } from "./protocol";

// A compact, unsigned overview across many inspections: one or two lines per
// inspection, not the full per-device detail of a single protocol (that's what
// /inspections/[id]/protocol is for).

function Building({ building, model }: { building: ProtocolSummaryModel["buildings"][number]; model: ProtocolSummaryModel }) {
  return (
    <View wrap={false} style={{ marginTop: 5 * MM }}>
      <Text style={{ fontSize: 10, fontWeight: 700 }}>{building.siteName}</Text>
      {building.customerName && (
        <Text style={{ fontSize: 8, color: MUTED, marginBottom: 1.5 * MM }}>
          {building.customerName}
        </Text>
      )}
      {building.inspections.length > 0 ? (
        <Table
          columns={[
            { key: "date", title: model.inspectionColumns.date, width: "20%" },
            { key: "number", title: model.inspectionColumns.number, width: "25%" },
            { key: "result", title: model.inspectionColumns.result, width: "55%" },
          ]}
          rows={building.inspections}
          cell={(row, key) => row[key as keyof typeof row]}
        />
      ) : (
        <Text style={{ color: MUTED }}>{model.noInspections}</Text>
      )}
      {building.openDefects.length > 0 && (
        <View style={{ marginTop: 2 * MM }}>
          <Table
            columns={[
              { key: "number", title: model.defectColumns.number, width: "12%" },
              { key: "device", title: model.defectColumns.device, width: "10%" },
              { key: "description", title: model.defectColumns.description, width: "48%" },
              { key: "severity", title: model.defectColumns.severity, width: "15%" },
              { key: "since", title: model.defectColumns.since, width: "15%" },
            ]}
            rows={building.openDefects}
            cell={(row, key) => row[key as keyof typeof row]}
            emphasis={(_, key) => key === "number"}
          />
        </View>
      )}
    </View>
  );
}

export function ProtocolSummaryDocument({ model }: { model: ProtocolSummaryModel }) {
  return (
    <Document
      title={model.title}
      author={model.organizationName}
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
          paddingBottom: 14 * MM,
          paddingHorizontal: 15 * MM,
        }}
      >
        <View
          style={{
            paddingBottom: 4 * MM,
            borderBottomWidth: 1.2,
            borderBottomColor: INK,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: 700 }}>{model.organizationName}</Text>
          <Text style={{ fontSize: 15, fontWeight: 700, marginTop: 2 * MM }}>{model.title}</Text>
          <Text style={{ color: MUTED, marginTop: 1 * MM }}>{model.period}</Text>
          <Text style={{ color: MUTED }}>{model.scope}</Text>
        </View>

        <Text style={{ marginTop: 4 * MM }}>{model.summary}</Text>

        <Section title={model.buildingsTitle}>
          {model.buildings.length === 0 ? (
            <Text>{model.noInspections}</Text>
          ) : (
            model.buildings.map((building, index) => (
              <Building key={`${building.siteName}-${index}`} building={building} model={model} />
            ))
          )}
        </Section>

        <Text
          fixed
          style={{ position: "absolute", left: 15 * MM, bottom: 9 * MM, fontSize: 7, color: MUTED }}
        >
          {model.generatedAt}
        </Text>
        <Text
          fixed
          style={{
            position: "absolute",
            right: 15 * MM,
            bottom: 9 * MM,
            fontSize: 7,
            color: MUTED,
          }}
          render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)}
        />
      </Page>
    </Document>
  );
}

export async function renderProtocolSummaryPdf(model: ProtocolSummaryModel): Promise<Buffer> {
  return renderPdf(<ProtocolSummaryDocument model={model} />);
}

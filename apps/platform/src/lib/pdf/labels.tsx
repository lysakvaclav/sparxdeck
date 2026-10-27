import "server-only";
import { Document, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import {
  labelContent,
  placeLabels,
  sheetCount,
  type LabelContent,
  type SheetLayout,
} from "@/lib/labels";
import { QR_QUIET_ZONE, qrMatrix, qrPath } from "@/lib/qr";
import { FONT, renderPdf } from "./fonts";

// A4 sheets of device labels as a vector PDF: crisp QR codes at any printer
// resolution, Czech characters from an embedded font (Noto Sans, OFL).

const MM = 72 / 25.4;
const INK = "#000000";
const MUTED = "#3a3a3a";

export type LabelData = {
  /** Printed label number, e.g. "0012". */
  number: string;
  siteName: string;
  /** What the QR code holds: the label URL. */
  url: string;
};

function Label({
  label,
  organizationName,
  x,
  y,
  layout,
  content,
}: {
  label: LabelData;
  organizationName: string;
  x: number;
  y: number;
  layout: SheetLayout;
  content: LabelContent;
}) {
  const matrix = qrMatrix(label.url);
  const box = matrix.size + QR_QUIET_ZONE * 2;
  const { qr, text } = content;
  return (
    <View
      style={{
        position: "absolute",
        left: x * MM,
        top: y * MM,
        width: layout.labelWidth * MM,
        height: layout.labelHeight * MM,
      }}
    >
      <Svg
        style={{ position: "absolute", left: qr.x * MM, top: qr.y * MM }}
        width={qr.size * MM}
        height={qr.size * MM}
        viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${box} ${box}`}
      >
        <Path d={qrPath(matrix)} fill={INK} />
      </Svg>
      <View
        style={{
          position: "absolute",
          left: text.x * MM,
          top: text.y * MM,
          width: text.width * MM,
          height: text.height * MM,
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              fontWeight: 700,
              fontSize: content.numberSize * MM,
              lineHeight: 1.1,
              color: INK,
              maxLines: 1,
            }}
          >
            {label.number}
          </Text>
          <Text
            style={{
              fontSize: content.nameSize * MM,
              lineHeight: 1.2,
              color: INK,
              marginTop: content.nameSize * 0.35 * MM,
              maxLines: content.nameLines,
              textOverflow: "ellipsis",
            }}
          >
            {label.siteName}
          </Text>
        </View>
        <Text
          style={{
            fontSize: content.footerSize * MM,
            lineHeight: 1.2,
            color: MUTED,
            maxLines: 1,
            textOverflow: "ellipsis",
          }}
        >
          {organizationName}
        </Text>
      </View>
    </View>
  );
}

/** Renders the labels onto as many A4 sheets as needed. */
export async function renderLabelsPdf({
  labels,
  layout,
  startAt,
  organizationName,
  title,
}: {
  labels: LabelData[];
  layout: SheetLayout;
  startAt: number;
  organizationName: string;
  title: string;
}): Promise<Buffer> {
  const placed = placeLabels(layout, labels.length, startAt);
  const pages = sheetCount(layout, labels.length, startAt);
  const content = labelContent(layout.labelWidth, layout.labelHeight);

  return renderPdf(
    <Document title={title} author={organizationName} creator="SparxDeck" producer="SparxDeck">
      {Array.from({ length: pages }, (_, page) => (
        <Page key={page} size="A4" style={{ fontFamily: FONT }}>
          {placed.map((position, index) =>
            position.page === page ? (
              <Label
                key={index}
                label={labels[index]!}
                organizationName={organizationName}
                x={position.x}
                y={position.y}
                layout={layout}
                content={content}
              />
            ) : null,
          )}
        </Page>
      ))}
    </Document>,
  );
}

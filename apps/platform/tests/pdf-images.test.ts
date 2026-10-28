import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pdfImage } from "@/lib/pdf/images";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import { buildProtocol } from "@/lib/protocol";
import { BASE_INPUT, translate } from "./fixtures/protocol-cases";
import { pdfLayout } from "./support/pdf-layout";

// Pictures for PDFs are written anew (src/lib/pdf/images.ts): react-pdf
// skipped a company's JPEG logo without a word because its JFIF header was
// longer than usual (a few apps add "AMPF").

const drawn = async (logo: { data: Buffer; format: "png" | "jpg" }) => {
  const model = buildProtocol(BASE_INPUT, translate("cs"));
  return (await pdfLayout(await renderProtocolPdf(model, { logo }))).flatMap((page) => page.images).length;
};

/** A JPEG whose JFIF header carries 4 more bytes ("AMPF"), as the logo that went missing. */
async function oddJpeg() {
  const base = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#29333c" } })
    .jpeg()
    .toBuffer();
  const jfif = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x14]),
    Buffer.from("JFIF", "latin1"),
    Buffer.from([0x00]),
    Buffer.from([0x01, 0x01, 0x01, 0x01, 0x2c, 0x01, 0x2c, 0x00, 0x00]),
    Buffer.from("AMPF"),
  ]);
  return Buffer.concat([base.subarray(0, 2), jfif, base.subarray(2)]);
}

describe("pictures for PDFs", () => {
  it("draws a JPEG the PDF library alone would skip", async () => {
    const odd = await oddJpeg();
    expect(await drawn({ data: odd, format: "jpg" })).toBe(0);
    const image = await pdfImage(odd);
    expect(image?.format).toBe("jpg");
    expect(await drawn(image!)).toBe(1);
  });

  it("turns a photo upright as the camera recorded it, and shrinks it", async () => {
    const sideways = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#8a9ba8" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const image = await pdfImage(sideways);
    const meta = await sharp(image!.data).metadata();
    expect([meta.width, meta.height]).toEqual([667, 2000]);
  });

  it("keeps transparency as PNG and refuses what isn't a picture", async () => {
    const transparent = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    expect((await pdfImage(transparent))?.format).toBe("png");
    const webp = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#123456" } }).webp().toBuffer();
    expect((await pdfImage(webp))?.format).toBe("jpg");
    expect(await pdfImage(Buffer.from("not a picture"))).toBeNull();
  });
});

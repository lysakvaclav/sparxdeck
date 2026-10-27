import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderProtocolPdf } from "@/lib/pdf/protocol";
import { buildProtocol } from "@/lib/protocol";
import { GOLDEN_CASES, translate } from "./fixtures/protocol-cases";
import { pdfLayout } from "./support/pdf-layout";

// The protocol keeps its look: every text and image of every page sits where
// the reference says. The references were written from the protocol as it was
// before protocol templates (part 22), so the default template must reproduce
// it exactly. PROTOCOL_GOLDEN=write rewrites them (only for an intended change).

const DIR = path.join(__dirname, "fixtures", "protocol-golden");

describe("the protocol's look", () => {
  for (const [name, { input, assets }] of Object.entries(GOLDEN_CASES)) {
    it(`stays the same: ${name}`, async () => {
      const model = buildProtocol(input, translate(input.locale));
      const pdf = await renderProtocolPdf(model, assets ? await assets() : {});
      const layout = await pdfLayout(pdf);
      const file = path.join(DIR, `${name}.json`);
      if (process.env.PROTOCOL_GOLDEN === "write") {
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(layout, null, 1)}\n`);
        if (process.env.PROTOCOL_SAMPLE_DIR)
          fs.writeFileSync(path.join(process.env.PROTOCOL_SAMPLE_DIR, `${name}.pdf`), pdf);
        return;
      }
      const expected = JSON.parse(fs.readFileSync(file, "utf8"));
      expect(layout.length).toBe(expected.length);
      layout.forEach((page, index) => expect(page, `page ${index + 1}`).toEqual(expected[index]));
    });
  }
});

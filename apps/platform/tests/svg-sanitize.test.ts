import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { templateLogoPng } from "@/lib/protocol-template-logo";
import { looksLikeSvg, sanitizeSvg } from "@/lib/svg-sanitize";

// A template's own logo (part 22, stage C): an uploaded SVG is cleaned before
// it is drawn, and every logo is stored as a PNG checked by its content.

const EVIL = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="80" onload="alert(1)">
  <script>alert(document.cookie)</script>
  <style>@import url(https://evil.example/x.css); rect { fill: red }</style>
  <foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>
  <image href="https://evil.example/track.png" width="10" height="10"/>
  <image xlink:href="file:///etc/passwd" width="10" height="10"/>
  <a href="javascript:alert(1)"><rect width="10" height="10"/></a>
  <animate attributeName="x" to="javascript:alert(1)"/>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#29333c"/><stop offset="1" stop-color="#5c7080"/></linearGradient></defs>
  <rect x="0" y="0" width="200" height="80" fill="url(#g)" onclick="alert(2)" style="fill:url(https://evil.example/a)"/>
  <circle cx="40" cy="40" r="30" fill="url(https://evil.example/b)"/>
  <use xlink:href="https://evil.example/sprite.svg#a"/>
  <use href="#g"/>
  <text x="80" y="50" font-size="24" fill="#ffffff">SparxDeck</text>
</svg>`;

describe("SVG logos are cleaned", () => {
  const clean = sanitizeSvg(EVIL)!;

  it("keeps shapes, gradients and text", () => {
    expect(clean).toContain("<rect");
    expect(clean).toContain("linearGradient");
    expect(clean).toContain('fill="url(#g)"');
    expect(clean).toContain(">SparxDeck</text>");
    expect(clean).toContain('<use href="#g"');
  });

  it("drops scripts, handlers, HTML, images, styles, animations and every outside link", () => {
    for (const gone of ["script", "onload", "onclick", "foreignObject", "<image", "<style", "@import", "<animate", "javascript:", "evil.example", "file:", "<a ", "HTML"])
      expect(clean, gone).not.toContain(gone);
  });

  it("refuses a DOCTYPE or entities, broken XML and what isn't an SVG", () => {
    expect(sanitizeSvg(`<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaaaaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>`)).toBeNull();
    expect(sanitizeSvg("<svg xmlns='http://www.w3.org/2000/svg'><rect></svg>")).toBeNull();
    expect(sanitizeSvg("<html><body>hi</body></html>")).toBeNull();
    expect(sanitizeSvg("hello")).toBeNull();
  });

  it("tells an SVG by its content", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(looksLikeSvg(bytes(EVIL))).toBe(true);
    expect(looksLikeSvg(bytes("﻿  <svg xmlns='http://www.w3.org/2000/svg'/>"))).toBe(true);
    expect(looksLikeSvg(bytes("<html><svg></svg></html>"))).toBe(false);
    expect(looksLikeSvg(bytes("GIF89a"))).toBe(false);
  });
});

describe("a template's logo is stored as a PNG", () => {
  const png = async (input: Buffer | Uint8Array) => {
    const result = await templateLogoPng(new Uint8Array(input));
    if ("error" in result) throw new Error(result.error);
    return sharp(result.png).metadata();
  };

  it("draws a cleaned SVG", async () => {
    const meta = await png(Buffer.from(EVIL));
    expect(meta.format).toBe("png");
    expect(meta.width).toBeLessThanOrEqual(1600);
    expect(meta.height).toBeLessThanOrEqual(800);
  });

  it("converts JPEG and shrinks a large picture into 1600 × 800", async () => {
    const jpeg = await sharp({ create: { width: 3200, height: 800, channels: 3, background: "#29333c" } })
      .jpeg()
      .toBuffer();
    const meta = await png(jpeg);
    expect(meta).toMatchObject({ format: "png", width: 1600, height: 400 });
  });

  it("refuses anything else, an evil SVG made unusable and too large a file", async () => {
    const result = (bytes: Uint8Array) => templateLogoPng(bytes);
    expect(await result(new TextEncoder().encode("hello"))).toEqual({ error: "fileTypeInvalid" });
    expect(await result(new TextEncoder().encode("<svg><!DOCTYPE x></svg>"))).toEqual({ error: "fileTypeInvalid" });
    expect(await result(new Uint8Array(0))).toEqual({ error: "fileTypeInvalid" });
    expect(await result(new Uint8Array(2 * 1024 * 1024 + 1))).toEqual({ error: "fileTooLarge" });
    // An SVG claiming an enormous size is refused before it is drawn.
    expect(await result(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"><rect width="10" height="10"/></svg>`))).toEqual(
      { error: "fileTypeInvalid" },
    );
  });
});

import { DOMParser, XMLSerializer, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";

// An uploaded SVG logo (part 22, stage C) cleaned before it is drawn: only
// shapes, text and gradients stay; scripts, event handlers, embedded HTML,
// images, styles, animations and links outside the file go. A file with a
// DOCTYPE or entities is refused outright. The result is turned into a PNG
// right away (src/lib/protocol-template-logo.ts), so no SVG reaches a PDF.

const ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "lineargradient", "radialgradient", "stop", "clippath",
  "mask", "title", "desc", "use", "symbol",
]);

/** Presentation attributes a logo needs; anything else (on*, style, event, xml:base…) goes. */
const ATTRIBUTES = new Set([
  "id", "class", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "dx", "dy",
  "width", "height", "points", "transform", "viewbox", "preserveaspectratio", "fill",
  "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-opacity",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
  "stroke-dashoffset", "opacity", "offset", "stop-color", "stop-opacity", "gradientunits",
  "gradienttransform", "spreadmethod", "fx", "fy", "clip-path", "mask", "clippathunits",
  "maskunits", "maskcontentunits", "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "visibility", "display", "xmlns",
  "xmlns:xlink", "version", "href", "xlink:href",
]);

/** url(…) pointing anywhere but inside the file. */
const OUTSIDE_URL = /url\(\s*['"]?\s*(?!#)/i;

function clean(node: XmlNode): void {
  for (const child of Array.from(node.childNodes)) {
    // Elements are checked; text and CDATA stay; comments and instructions go.
    if (child.nodeType === child.ELEMENT_NODE) {
      const element = child as XmlElement;
      if (!ELEMENTS.has((element.localName ?? "").toLowerCase())) {
        node.removeChild(child);
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        const isLink = name === "href" || name === "xlink:href";
        if (
          !ATTRIBUTES.has(name) ||
          (isLink && !value.trim().startsWith("#")) ||
          OUTSIDE_URL.test(value)
        )
          element.removeAttribute(attribute.name);
      }
      clean(element);
    } else if (child.nodeType !== child.TEXT_NODE && child.nodeType !== child.CDATA_SECTION_NODE) {
      node.removeChild(child);
    }
  }
}

/** The SVG made safe to draw, or null when it isn't an SVG (or carries a DOCTYPE). */
export function sanitizeSvg(source: string): string | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return null;
  let document;
  try {
    document = new DOMParser({
      onError: (level) => {
        if (level !== "warning") throw new Error("svg");
      },
    }).parseFromString(source, "image/svg+xml");
  } catch {
    return null;
  }
  const root = document.documentElement;
  if (!root || (root.localName ?? "").toLowerCase() !== "svg") return null;
  clean(document);
  return new XMLSerializer().serializeToString(document);
}

/** The bytes look like an SVG (text starting with <svg or an XML declaration). */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^\uFEFF/, "").trimStart();
  return /^<(\?xml|svg|!--)/i.test(head) && /<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
}

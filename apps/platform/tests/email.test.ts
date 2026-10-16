import { describe, expect, it } from "vitest";
import { renderEmail, resendPayload, senderAddress } from "@/lib/email";

describe("e-mail sender", () => {
  it("shows the company's name with SparxDeck's address", () => {
    expect(senderAddress("SparxDeck <noreply@sparxdeck.com>", "Revize Novák s.r.o.")).toBe(
      '"Revize Novák s.r.o." <noreply@sparxdeck.com>',
    );
    expect(senderAddress("noreply@sparxdeck.com", "Revize")).toBe(
      '"Revize" <noreply@sparxdeck.com>',
    );
    expect(senderAddress("SparxDeck <noreply@sparxdeck.com>")).toBe(
      "SparxDeck <noreply@sparxdeck.com>",
    );
  });

  it("keeps a name from breaking the header", () => {
    expect(senderAddress("SparxDeck <noreply@sparxdeck.com>", 'Evil" <x@y.z>\r\nBcc: a@b.c')).toBe(
      '"Evil x@y.zBcc: a@b.c" <noreply@sparxdeck.com>',
    );
  });
});

describe("Resend request", () => {
  it("attaches files as base64 and sets the reply address", () => {
    const payload = resendPayload(
      {
        to: "zakaznik@example.com",
        subject: "Protokol",
        html: "<p>x</p>",
        text: "x",
        fromName: "Revize Novák",
        replyTo: "info@revize-novak.cz",
        attachments: [{ filename: "Protokol-2026-0001.pdf", content: Buffer.from("%PDF-1.7") }],
      },
      "SparxDeck <noreply@sparxdeck.com>",
    );
    expect(payload).toEqual({
      from: '"Revize Novák" <noreply@sparxdeck.com>',
      to: ["zakaznik@example.com"],
      subject: "Protokol",
      html: "<p>x</p>",
      text: "x",
      reply_to: "info@revize-novak.cz",
      attachments: [{ filename: "Protokol-2026-0001.pdf", content: "JVBERi0xLjc=" }],
    });
  });

  it("leaves out what isn't set", () => {
    const payload = resendPayload(
      { to: "a@b.cz", subject: "s", html: "h", text: "t", replyTo: null },
      "SparxDeck <noreply@sparxdeck.com>",
    );
    expect(payload).not.toHaveProperty("reply_to");
    expect(payload).not.toHaveProperty("attachments");
  });
});

describe("e-mail layout", () => {
  it("has no button without a link, and escapes the text", () => {
    const { html, text } = renderEmail({
      heading: "Protokol <2026-0001>",
      body: "V příloze",
      footnote: "Odesláno",
    });
    expect(html).not.toContain("<a href");
    expect(html).toContain("Protokol &lt;2026-0001&gt;");
    expect(text).toBe("Protokol <2026-0001>\n\nV příloze\n\nOdesláno");
  });
});

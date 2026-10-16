import "server-only";
import { serverEnv } from "@/lib/env";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Shown as the sender's name; the address stays EMAIL_FROM's. */
  fromName?: string;
  /** Where replies go, e.g. the organization's own address. */
  replyTo?: string | null;
  attachments?: { filename: string; content: Buffer }[];
};

/** True when Resend is configured. Without it, callers fall back to showing links in the UI. */
export function emailEnabled() {
  return Boolean(serverEnv().RESEND_API_KEY);
}

/** "Name <address>" with the name made safe for a header (no quotes, brackets or line breaks). */
export function senderAddress(emailFrom: string, name?: string) {
  const address = /<([^>]+)>/.exec(emailFrom)?.[1] ?? emailFrom.trim();
  const clean = name?.replace(/["<>\r\n\\]/g, "").trim();
  return clean ? `"${clean}" <${address}>` : emailFrom;
}

/** The request body for Resend's POST /emails. */
export function resendPayload(email: Email, emailFrom: string) {
  return {
    from: senderAddress(emailFrom, email.fromName),
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    ...(email.attachments?.length
      ? {
          attachments: email.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content.toString("base64"),
          })),
        }
      : {}),
  };
}

/** Sends an e-mail through the Resend HTTP API. Returns false if not configured or on failure. */
export async function sendEmail(email: Email): Promise<boolean> {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(resendPayload(email, EMAIL_FROM)),
    });
    if (!response.ok) {
      console.error("Resend rejected e-mail", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend request failed", error);
    return false;
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * A minimal, monochrome e-mail layout matching the product's look. Inputs must be
 * plain text. `items` become a list under the body; the button is left out when
 * there is no link (e.g. an attachment).
 */
export function renderEmail({
  heading,
  body,
  items,
  cta,
  url,
  footnote,
}: {
  heading: string;
  body: string;
  items?: string[];
  cta?: string;
  url?: string;
  footnote: string;
}) {
  const list = items?.length
    ? `
        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#333333"><ul style="margin:0;padding-left:20px">${items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul></td></tr>`
    : "";
  const button =
    cta && url
      ? `
        <tr><td style="padding:24px 32px">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(cta)}</a>
        </td></tr>`
      : `
        <tr><td style="padding:12px 32px"></td></tr>`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
        <tr><td style="padding:32px 32px 8px;font-size:20px;letter-spacing:-0.02em">SparxDeck</td></tr>
        <tr><td style="padding:16px 32px 0;font-size:24px;line-height:1.25;letter-spacing:-0.02em">${escapeHtml(heading)}</td></tr>
        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#333333">${escapeHtml(body)}</td></tr>${list}${button}
        <tr><td style="padding:0 32px 32px;font-size:13px;line-height:1.5;color:#6b6b6b">${escapeHtml(footnote)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    heading,
    body,
    items?.length ? items.map((item) => `- ${item}`).join("\n") : null,
    cta && url ? `${cta}: ${url}` : null,
    footnote,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

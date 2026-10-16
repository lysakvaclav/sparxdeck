// Shared helpers for the e2e walkthroughs: throwaway users and organizations
// created through the admin API (pre-confirmed, so no e-mails are sent), and cleanup.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const APP = process.env.E2E_APP_URL ?? "http://localhost:3001";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Requests to Supabase give up after 20 s instead of hanging the suite.
const fetch = (input, init = {}) =>
  globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(20_000) });

export const run = randomUUID().slice(0, 6);
export const password = `Sparx-${randomUUID().slice(0, 12)}`;
const created = [];

export async function createUser(label) {
  const email = `e2e-${label}-${run}@sparxdeck.test`;
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = { id: (await response.json()).id, email };
  created.push(user);
  return user;
}

/** Adds an existing user to an organization directly (bypasses invitations). */
export async function addMember(organizationId, user, role, displayName) {
  await fetch(`${url}/rest/v1/memberships`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      organization_id: organizationId,
      user_id: user.id,
      role,
      display_name: displayName,
      email: user.email,
    }),
  });
}

export async function organizationOf(user) {
  const rows = await (
    await fetch(`${url}/rest/v1/memberships?user_id=eq.${user.id}&select=organization_id`, {
      headers: H,
    })
  ).json();
  return rows[0]?.organization_id;
}

export async function organization(id) {
  return (
    await (await fetch(`${url}/rest/v1/organizations?id=eq.${id}&select=*`, { headers: H })).json()
  )[0];
}

/** Every file under a folder of a bucket (folders are listed without an id). */
async function listFiles(bucket, prefix) {
  const entries = await (
    await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ prefix, limit: 1000 }),
    })
  ).json();
  if (!Array.isArray(entries)) return [];
  const files = [];
  for (const entry of entries) {
    if (entry.id === null) files.push(...(await listFiles(bucket, `${prefix}${entry.name}/`)));
    else files.push(`${prefix}${entry.name}`);
  }
  return files;
}

export async function cleanup() {
  for (const user of created) {
    const orgId = await organizationOf(user);
    if (orgId) {
      for (const bucket of ["org-assets", "protocols"]) {
        const files = await listFiles(bucket, `${orgId}/`);
        if (files.length) {
          await fetch(`${url}/storage/v1/object/${bucket}`, {
            method: "DELETE",
            headers: H,
            body: JSON.stringify({ prefixes: files }),
          });
        }
      }
      await fetch(`${url}/rest/v1/organizations?id=eq.${orgId}`, { method: "DELETE", headers: H });
    }
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: H });
  }
}

export async function signIn(page, user, pwd = password) {
  await page.goto(`${APP}/login`);
  await page.type("#email", user.email);
  await page.type("#password", pwd);
  await page.clickText("Přihlásit se");
}

/** Writes a small black-on-white "logo" PNG (no image library needed) and returns its path. */
export function writeTestLogo(dir) {
  const width = 240;
  const height = 80;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      const inMark = x > 16 && x < 72 && y > 16 && y < 64; // square mark
      const inBar = x > 88 && x < 224 && ((y > 22 && y < 36) || (y > 46 && y < 58)); // "text"
      const value = inMark || inBar ? 17 : 255;
      row.set([value, value, value, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.resolve(dir, "test-logo.png");
  fs.writeFileSync(file, png);
  return file;
}

/** Inserts rows through the admin API (all rows get the same keys) and returns them. */
export async function insertRows(table, rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = rows.map((row) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null])));
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error(`insert ${table}: ${JSON.stringify(result)}`);
  return result;
}

/** Updates rows through the admin API, e.g. updateRows("devices", "id=eq.x", { status: "retired" }). */
export async function updateRows(table, query, patch) {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error(`update ${table}: ${JSON.stringify(result)}`);
  return result;
}

/** Reads rows through the admin API, e.g. selectRows("device_types", "organization_id=eq.x&select=id"). */
export async function selectRows(table, query) {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: H });
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error(`select ${table}: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Writes a two-page vector PDF of floor plans (walls and a title per page, the
 * font not embedded) and returns its path.
 */
export function writeTestPlanPdf(dir) {
  const walls = [
    "6 w 40 40 762 515 re S 3 w 40 300 m 802 300 l S 300 40 m 300 300 l S 560 300 m 560 555 l S",
    "6 w 40 40 762 515 re S 3 w 420 40 m 420 555 l S 40 200 m 420 200 l S 620 300 m 802 300 l S",
  ];
  const pages = walls.map(
    (lines, index) =>
      `0.16 0.22 0.26 RG ${lines} BT /F1 24 Tf 60 515 Td (Floor ${index + 1}) Tj ET`,
  );
  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((content, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = Buffer.byteLength(pdf);
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 ${objects.length}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.resolve(dir, "test-plan.pdf");
  fs.writeFileSync(file, pdf);
  return file;
}

/** Every file in a folder of a bucket, through the admin API. */
export const filesIn = listFiles;

/** Downloads a stored file through the admin API. */
export async function downloadFile(bucket, objectPath) {
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, { headers: H });
  if (!response.ok) throw new Error(`download ${objectPath}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Downloads every stored file (logos, photos, protocol PDFs) to a folder.
// Supabase database backups don't include Storage files, so this is their backup.
//
//   node --env-file=.env.production.local scripts/backup-storage.mjs [folder]
//
// The folder defaults to backups/storage-<date>; files keep their bucket and path,
// so they can be uploaded back as they were.
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (env file).");
  process.exit(1);
}
const BUCKETS = ["org-assets", "protocols"];
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const folder =
  process.argv[2] ?? path.join("backups", `storage-${new Date().toISOString().slice(0, 10)}`);

/** Every object under a prefix (folders are listed without an id). */
async function list(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    if (!response.ok) throw new Error(`list ${bucket}/${prefix}: ${response.status}`);
    const entries = await response.json();
    for (const entry of entries) {
      if (entry.id === null) files.push(...(await list(bucket, `${prefix}${entry.name}/`)));
      else files.push(`${prefix}${entry.name}`);
    }
    if (entries.length < 1000) return files;
  }
}

let count = 0;
let bytes = 0;
for (const bucket of BUCKETS) {
  const files = await list(bucket);
  for (const file of files) {
    const response = await fetch(
      `${url}/storage/v1/object/${bucket}/${file.split("/").map(encodeURIComponent).join("/")}`,
      { headers },
    );
    if (!response.ok) throw new Error(`download ${bucket}/${file}: ${response.status}`);
    const target = path.join(folder, bucket, ...file.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(target, body);
    count++;
    bytes += body.length;
  }
  console.log(`${bucket}: ${files.length} files`);
}
console.log(`${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${folder}`);

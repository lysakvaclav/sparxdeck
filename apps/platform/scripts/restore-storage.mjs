// Uploads files saved by backup-storage.mjs back to Storage (same bucket and
// path; existing files are replaced). For restoring after a database restore.
//
//   node --env-file=.env.prod.local scripts/restore-storage.mjs <folder>
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const folder = process.argv[2];
if (!url || !key || !folder) {
  console.error(
    "Usage: node --env-file=<env file> scripts/restore-storage.mjs <backup folder> (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY).",
  );
  process.exit(1);
}

const TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let count = 0;
for (const bucket of fs.readdirSync(folder)) {
  const root = path.join(folder, bucket);
  if (!fs.statSync(root).isDirectory()) continue;
  for (const file of walk(root)) {
    const objectPath = path.relative(root, file).split(path.sep).join("/");
    const response = await fetch(
      `${url}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
          "x-upsert": "true",
        },
        body: fs.readFileSync(file),
      },
    );
    if (!response.ok)
      throw new Error(
        `upload ${bucket}/${objectPath}: ${response.status} ${await response.text()}`,
      );
    count++;
  }
  console.log(`${bucket}: restored`);
}
console.log(`${count} files uploaded`);

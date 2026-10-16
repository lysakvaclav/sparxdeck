// Stops leftover Next.js dev servers of this repository, removes their stale locks
// and checks that the dev ports are free. On Windows, stopping turbo (Ctrl+C or a
// failed task) can leave `next dev` running in the background, holding ports
// 3000/3001 and the .next/dev/lock file. Only node processes whose command line
// points into this repo (and their child processes) are stopped; a port held by
// anything else is reported, not stopped.
//
//   node scripts/stop-dev.mjs [port ...]   (ports that must be free afterwards)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const appsDir = path.join(repo, "apps");
const ports = process.argv.slice(2).map(Number);

/** Runs a PowerShell script (encoded, so quotes and non-ASCII paths survive). */
function powershell(script) {
  const prelude =
    "$ProgressPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [Text.Encoding]::UTF8;";
  const encoded = Buffer.from(prelude + script, "utf16le").toString("base64");
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    // stderr only carries PowerShell's progress records here.
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function stopProcesses() {
  if (process.platform === "win32") {
    const pattern = `*${repo}\\*\\next\\*`.replaceAll("'", "''");
    // Children too: a server started through a link runs from a path outside the
    // repo. A child must be younger than its parent (process ids get reused).
    const script = `
      $all = @(Get-CimInstance Win32_Process)
      $stop = @{}
      foreach ($p in $all) {
        if ($p.Name -eq 'node.exe' -and $p.CommandLine -like '${pattern}' -and $p.ProcessId -ne ${process.pid}) { $stop[$p.ProcessId] = $p }
      }
      do {
        $added = 0
        foreach ($p in $all) {
          $parent = $stop[$p.ParentProcessId]
          if (-not $stop.ContainsKey($p.ProcessId) -and $parent -and $p.CreationDate -ge $parent.CreationDate) { $stop[$p.ProcessId] = $p; $added++ }
        }
      } while ($added)
      foreach ($id in $stop.Keys) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; $id }
    `;
    return powershell(script).split(/\s+/).filter(Boolean).length;
  }
  try {
    execFileSync("pkill", ["-f", `${repo}/.*/next/`]);
    return 1;
  } catch {
    return 0; // pkill exits 1 when nothing matched
  }
}

/** Whether a server could listen on the port (the same way `next dev` does). */
function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

/** Which program listens on the port, for the message (Windows only). */
function portOwner(port) {
  if (process.platform !== "win32") return null;
  try {
    const owner = powershell(`
      $id = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
      if ($id) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"; "$id $($p.CommandLine)" }
    `).trim();
    return owner || null;
  } catch {
    return null;
  }
}

const stopped = stopProcesses();
let locks = 0;
for (const app of fs.readdirSync(appsDir)) {
  const lock = path.join(appsDir, app, ".next", "dev", "lock");
  if (fs.existsSync(lock)) {
    fs.rmSync(lock, { force: true });
    locks++;
  }
}
if (stopped || locks) console.log(`Stopped ${stopped} leftover dev server process(es), removed ${locks} stale lock(s).`);

// A stopped server can hold its port for a moment.
const busy = [];
for (const port of ports) {
  let free = await portFree(port);
  for (let wait = 0; !free && wait < 20; wait++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    free = await portFree(port);
  }
  if (!free) busy.push(port);
}
for (const port of busy) {
  const owner = portOwner(port);
  const [pid, ...command] = owner?.split(" ") ?? [];
  console.error(
    owner
      ? `Port ${port} is used by another program (PID ${pid}: ${command.join(" ").trim() || "unknown"}).\nClose it, or stop it with: taskkill /PID ${pid} /F`
      : `Port ${port} is used by another program. Close it and start again.`,
  );
}
if (busy.length) process.exit(1);

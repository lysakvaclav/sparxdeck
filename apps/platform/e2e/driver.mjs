// Minimal headless-Edge driver over the Chrome DevTools Protocol (no dependencies).
import { spawn } from "node:child_process";
import fs from "node:fs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nothing may wait forever: a crashed browser or a stalled connection fails the
// step instead of hanging the whole suite.
const CONNECT_TIMEOUT = 15_000;
const COMMAND_TIMEOUT = 30_000;
const SUITE_TIMEOUT = 10 * 60_000;
let watchdog;

function armWatchdog() {
  if (watchdog) return;
  watchdog = setTimeout(() => {
    console.error(`FAIL watchdog: the suite ran longer than ${SUITE_TIMEOUT / 60_000} minutes`);
    process.exit(1);
  }, SUITE_TIMEOUT);
  watchdog.unref();
}

export async function launch({ width = 1440, height = 900, dark = false, mobile = false } = {}) {
  armWatchdog();
  // A port nobody answers on: two browsers sharing one would mix up their sessions.
  let port;
  for (let attempt = 0; attempt < 20 && !port; attempt++) {
    const candidate = 9300 + Math.floor(Math.random() * 600);
    const taken = await fetch(`http://127.0.0.1:${candidate}/json/version`, {
      signal: AbortSignal.timeout(500),
    }).then(
      () => true,
      () => false,
    );
    if (!taken) port = candidate;
  }
  if (!port) throw new Error("No free DevTools port");
  const profile = fs.mkdtempSync(process.env.TEMP + "/edge-e2e-");
  const proc = spawn(
    EDGE,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(
        (t) => t.type === "page",
      );
    } catch {}
  }
  if (!target) {
    proc.kill();
    await sleep(1000);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    throw new Error(`Edge DevTools not reachable on port ${port}`);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Edge DevTools connection timed out")),
      CONNECT_TIMEOUT,
    );
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("Edge DevTools connection failed"));
    });
  });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      logs.push(
        `${m.params.type}: ${m.params.args
          .map((a) => a.value ?? a.description ?? "")
          .join(" ")
          .slice(0, 300)}`,
      );
    // Browser reports outside the console: Content Security Policy violations above all.
    if (
      m.method === "Log.entryAdded" &&
      m.params.entry.level === "error" &&
      ["security", "violation", "intervention"].includes(m.params.entry.source)
    )
      logs.push(`${m.params.entry.source}: ${m.params.entry.text.slice(0, 300)}`);
    if (m.method === "Runtime.exceptionThrown")
      logs.push(
        `exception: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)}`,
      );
  });
  // A closed connection (crashed browser) fails every pending command at once.
  ws.addEventListener("close", () => {
    for (const [, settle] of pending)
      settle({ error: { message: "Edge DevTools connection closed" } });
    pending.clear();
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        reject(new Error(`DevTools command timed out: ${method}`));
      }, COMMAND_TIMEOUT);
      pending.set(i, (message) => {
        clearTimeout(timer);
        if (message.error && !message.result) reject(new Error(message.error.message));
        else resolve(message);
      });
      if (ws.readyState !== WebSocket.OPEN) {
        clearTimeout(timer);
        pending.delete(i);
        reject(new Error("Edge DevTools connection closed"));
        return;
      }
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }],
  });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails)
      throw new Error("eval failed: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  const page = {
    logs,
    evaluate,
    /** Raw DevTools command, e.g. network emulation. */
    send,
    async goto(url) {
      await send("Page.navigate", { url });
      await this.waitIdle();
    },
    async waitIdle(ms = 900) {
      for (let i = 0; i < 60; i++) {
        if ((await evaluate("document.readyState")) === "complete") break;
        await sleep(100);
      }
      await sleep(ms);
    },
    url: () => evaluate("location.href"),
    async waitFor(selector, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
        await sleep(150);
      }
      throw new Error(`timeout waiting for ${selector} at ${await this.url()}`);
    },
    async waitForText(text, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
        await sleep(150);
      }
      throw new Error(`timeout waiting for text "${text}" at ${await this.url()}`);
    },
    async waitForUrl(part, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if ((await this.url()).includes(part)) return;
        await sleep(150);
      }
      throw new Error(`timeout waiting for url ${part}, at ${await this.url()}`);
    },
    async box(selector) {
      await this.waitFor(selector);
      return evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`,
      );
    },
    async click(selector) {
      const { x, y } = await this.box(selector);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(300);
    },
    async clickText(text, tag = "button,a,[role=menuitem],[role=menuitemradio]") {
      const sel = await evaluate(
        `(() => { const els = [...document.querySelectorAll(${JSON.stringify(tag)})].filter(e => e.innerText.trim() === ${JSON.stringify(text)} && e.offsetParent !== null); if (!els.length) return null; const el = els[els.length-1]; el.setAttribute('data-e2e-click','1'); return '[data-e2e-click="1"]'; })()`,
      );
      if (!sel) throw new Error(`no clickable "${text}" at ${await this.url()}`);
      await this.click(sel);
      await evaluate(
        `document.querySelectorAll('[data-e2e-click]').forEach(e => e.removeAttribute('data-e2e-click'))`,
      );
    },
    /** Presses at one point, moves in steps and releases at another (drag, box select). */
    async drag(from, to, steps = 8) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y });
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: from.x,
        y: from.y,
        button: "left",
        clickCount: 1,
      });
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x,
          y,
          button: "left",
          buttons: 1,
        });
        await sleep(16);
      }
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: to.x,
        y: to.y,
        button: "left",
        clickCount: 1,
      });
      await sleep(300);
    },
    async type(selector, text) {
      await this.click(selector);
      await evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.select?.(); })()`,
      );
      await send("Input.insertText", { text });
      await sleep(100);
    },
    async setFile(selector, filePath) {
      const { root } = (await send("DOM.getDocument", {})).result;
      const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector }))
        .result;
      await send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
      await sleep(300);
    },
    async selectValue(selector, value) {
      await evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("change", { bubbles: true })); })()`,
      );
      await sleep(150);
    },
    async metrics() {
      await send("Performance.enable");
      const { metrics } = (await send("Performance.getMetrics")).result;
      return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
    },
    async screenshot(path) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path, Buffer.from(shot.result.data, "base64"));
    },
    /**
     * No network for the page and for its service worker too (the worker fetches
     * on its own, so the page's emulation alone would let it reach the server).
     * The worker's session stays open while offline: closing it ends the emulation.
     */
    async setOffline(offline) {
      await page.setNetwork({ offline });
    },
    /** Network conditions for the page and its service worker, e.g. a weak signal: { latency: 20000 }. */
    async setNetwork({ offline = false, latency = 0 } = {}) {
      const conditions = { offline, latency, downloadThroughput: -1, uploadThroughput: -1 };
      const normal = !offline && latency === 0;
      await send("Network.enable");
      await send("Network.emulateNetworkConditions", conditions);
      if (!normal && !workers) workers = await connectWorkers(port, conditions);
      else if (workers) await workers.apply(conditions);
      if (normal && workers) {
        workers.close();
        workers = null;
      }
    },
    async close() {
      workers?.close();
      ws.close();
      // The throwaway profile goes too (each is tens of MB; they filled the disk once).
      const exited = new Promise((resolve) => {
        if (proc.exitCode !== null) resolve();
        else proc.once("exit", resolve);
      });
      proc.kill();
      await Promise.race([exited, sleep(5000)]);
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {
        // Still locked by a closing browser: TEMP keeps it.
      }
    },
  };
  let workers = null;
  return page;
}

/** Attaches to the browser's service workers and emulates the network for them. */
async function connectWorkers(port, conditions) {
  const { webSocketDebuggerUrl } = await (
    await fetch(`http://127.0.0.1:${port}/json/version`)
  ).json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error("browser connection failed")));
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      const timer = setTimeout(() => reject(new Error(`timed out: ${method}`)), COMMAND_TIMEOUT);
      pending.set(i, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const sessions = [];
  const { targetInfos } = await call("Target.getTargets");
  for (const target of targetInfos.filter((t) => t.type === "service_worker")) {
    const { sessionId } = await call("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });
    sessions.push(sessionId);
  }
  const apply = async (next) => {
    for (const sessionId of sessions) {
      await call("Network.enable", {}, sessionId);
      await call("Network.emulateNetworkConditions", next, sessionId);
    }
  };
  await apply(conditions);
  return { apply, close: () => socket.close(), count: sessions.length };
}

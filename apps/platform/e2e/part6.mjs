// Part 6 walkthrough: QR labels. The QR code on the device page is read back from
// a screenshot like a phone camera would, its link opened signed out and as
// another company; labels are printed to a PDF.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import jsQR from "jsqr";
import { PNG } from "pngjs";
import fs from "node:fs";
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  cleanup,
  createUser,
  insertRows,
  organizationOf,
  password,
  selectRows,
  signIn,
} from "./support.mjs";

const OUT = process.argv[2] ?? ".e2e-output";
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    throw error;
  }
};

const setValue = (selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);

/** Screenshots the QR code on the page and decodes it. */
async function scanQr(selector, file) {
  const rect = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.style.width = "360px"; el.style.height = "360px";
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  await sleep(300);
  await page.screenshot(file);
  const png = PNG.sync.read(fs.readFileSync(file));
  const crop = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const from = ((rect.y + y) * png.width + rect.x) * 4;
    crop.set(png.data.subarray(from, from + rect.w * 4), y * rect.w * 4);
  }
  return jsQR(crop, rect.w, rect.h)?.data ?? null;
}

async function signInAt(user) {
  await page.waitFor("#email");
  await page.type("#email", user.email);
  await page.type("#password", password);
  await page.clickText("Přihlásit se");
}

const page = await launch({ width: 1440, height: 1000 });
let device;
let siteId;
let scanned;
try {
  const owner = await createUser("labels-owner");
  const stranger = await createUser("labels-stranger");

  await step("setup: a company with a building and devices, and another company", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    const org = await organizationOf(owner);
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "Bytové družstvo Lipová" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Lipová 12, vchod A" },
    ]);
    siteId = site.id;
    const [suteren] = await insertRows("locations", [
      { organization_id: org, site_id: siteId, name: "Suterén", sort_order: 1 },
    ]);
    // insertRows gives every row the same keys, so each states its status and location.
    const row = (location, status) => ({
      organization_id: org,
      site_id: siteId,
      location_id: location,
      device_type_id: type.id,
      status,
      attributes: {},
    });
    const devices = await insertRows("devices", [
      row(suteren.id, "active"),
      row(suteren.id, "active"),
      row(null, "out_of_service"),
      row(null, "active"),
      row(null, "removed"),
    ]);
    device = devices[0];
  });

  await step(
    "the device page shows its label with a QR code that scans to the label link",
    async () => {
      await page.goto(`${APP}/devices/${device.id}`);
      await page.waitForText("Odkaz v QR kódu");
      await page.screenshot(`${OUT}/p6-01-device.png`);
      scanned = await scanQr('[aria-label="QR kód štítku 0001"]', `${OUT}/p6-02-qr.png`);
      const expected = `${APP}/d/${device.public_token}`;
      if (scanned !== expected) throw new Error(`scanned ${scanned}, expected ${expected}`);
    },
  );

  await step("a scanned label opens the device, signing in first when needed", async () => {
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await page.goto(scanned);
    await page.waitForUrl(`/login?next=${encodeURIComponent(`/d/${device.public_token}`)}`);
    await signInAt(owner);
    await page.waitForUrl(`/devices/${device.id}`);
    await page.waitForText("Hasicí přístroj 0001");
    // Letter case doesn't matter (the code is case-insensitive base32).
    await page.goto(`${APP}/d/${device.public_token.toUpperCase()}`);
    await page.waitForUrl(`/devices/${device.id}`);
  });

  await step("labels print to a PDF with the chosen sheet, copies and start", async () => {
    await page.goto(`${APP}/devices/labels?site=${siteId}`);
    await page.waitForText("Vybráno 4 z 4");
    // Removed devices aren't offered.
    const rows = await page.evaluate(`document.querySelectorAll("main table tbody tr").length`);
    if (rows !== 4) throw new Error(`rows ${rows}`);
    await page.waitForText("4 štítky · 1 arch A4");
    await page.screenshot(`${OUT}/p6-03-labels.png`);
    await page.selectValue("#label-format", "52x30");
    await setValue("#label-copies", "2");
    await setValue("#label-start", "39");
    await page.waitForText("8 štítků · 2 archy A4");
    await setValue("#label-start", "41");
    await page.waitForText("Zadejte pozici, která na archu existuje.");
    const disabled = await page.evaluate(`document.querySelector("button[type=submit]").disabled`);
    if (!disabled) throw new Error("submit enabled with an invalid start");
    await setValue("#label-start", "39");
    await page.waitForText("8 štítků · 2 archy A4");
    await page.screenshot(`${OUT}/p6-04-labels-preview.png`);
    const pdf = await page.evaluate(`(async () => {
      const response = await fetch("/devices/labels/pdf", {
        method: "POST",
        body: new FormData(document.querySelector("main form")),
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        pages: (text.match(/\\/Type\\s*\\/Page\\b/g) || []).length,
        head: text.slice(0, 5),
      };
    })()`);
    if (pdf.status !== 200 || pdf.type !== "application/pdf" || pdf.head !== "%PDF-")
      throw new Error(`pdf ${JSON.stringify(pdf)}`);
    if (pdf.pages !== 2) throw new Error(`pages ${pdf.pages}`);
    if (!pdf.disposition.includes("stitky-lipova-12-vchod-a.pdf"))
      throw new Error(`file ${pdf.disposition}`);
  });

  await step("the sheet format and copies are remembered for the next print", async () => {
    await page.goto(`${APP}/devices/labels?site=${siteId}`);
    await page.waitForText("Vybráno 4 z 4");
    const format = await page.evaluate(`document.querySelector("#label-format").value`);
    const copies = await page.evaluate(`document.querySelector("#label-copies").value`);
    if (format !== "52x30" || copies !== "2") throw new Error(`remembered ${format} / ${copies}`);
    // The start position is not remembered (each sheet is different).
    const start = await page.evaluate(`document.querySelector("#label-start").value`);
    if (start !== "1") throw new Error(`start ${start}`);
  });

  await step("printing from a device selects only that device", async () => {
    await page.goto(`${APP}/devices/${device.id}`);
    await page.clickText("Vytisknout štítek");
    await page.waitForText("Vybráno 1 z 4");
  });

  await step("another company sees the same neutral 'not found' for a real label", async () => {
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, stranger);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Jiná firma");
    await page.type("#displayName", "Jana Jiná");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Jana");
    const texts = [];
    for (const path of [`/d/${device.public_token}`, "/d/0000000000zz", "/d/nesmysl"]) {
      await page.goto(`${APP}${path}`);
      await page.waitForText("Tento štítek nepatří k žádnému zařízení vaší firmy.");
      texts.push(await page.evaluate(`document.querySelector("main").innerText`));
    }
    if (new Set(texts).size !== 1) throw new Error("the answers differ");
    if (texts[0].includes("Lipová") || texts[0].includes("0001"))
      throw new Error("the page reveals the device");
    await page.screenshot(`${OUT}/p6-05-not-found.png`);
    // Nor can the stranger print it.
    const status = await page.evaluate(`(async () => {
      const body = new FormData();
      body.append("deviceId", ${JSON.stringify(device.id)});
      body.append("copies", "1"); body.append("startAt", "1"); body.append("preset", "70x37");
      return (await fetch("/devices/labels/pdf", { method: "POST", body })).status;
    })()`);
    if (status !== 404) throw new Error(`stranger print status ${status}`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p6-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

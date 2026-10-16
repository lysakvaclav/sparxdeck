// Part 7 walkthrough on a phone: a technician starts the building's inspection,
// "scans" a label from a photo, answers the checklist with a photo, loses the
// signal, reloads, gets a check taken over by a colleague, and completes.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { encode } from "uqr";
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
  cleanup,
  createUser,
  insertRows,
  organizationOf,
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

/** A PNG of a QR code (what a phone camera would see on the label). */
function qrPng(text, file) {
  const { data, size } = encode(text, { ecc: "Q", border: 4 });
  const scale = 8;
  const png = new PNG({ width: size * scale, height: size * scale });
  for (let y = 0; y < size * scale; y++)
    for (let x = 0; x < size * scale; x++) {
      const dark = data[Math.floor(y / scale)][Math.floor(x / scale)];
      const i = (y * size * scale + x) * 4;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = dark ? 0 : 255;
      png.data[i + 3] = 255;
    }
  fs.writeFileSync(file, PNG.sync.write(png));
  return path.resolve(file);
}

/** A small "photo" of a device. */
function photoPng(file) {
  const png = new PNG({ width: 64, height: 48 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([200, 40, 40, 255], i);
  fs.writeFileSync(file, PNG.sync.write(png));
  return path.resolve(file);
}

const answer = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);
const pressed = (page, questionLabel) =>
  page.evaluate(
    `[...document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]').querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.innerText.trim())`,
  );
const typeValue = (page, selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);

/** Answers every required question so that the check passes (or fails on the first yes/no). */
async function answerAll(page, questions, fail = false) {
  let first = true;
  for (const question of questions.filter((q) => q.required)) {
    if (question.item_type === "pass_fail") {
      await answer(page, question.label, fail && first ? "Nevyhovuje" : "Vyhovuje");
      first = false;
    } else if (question.item_type === "number") {
      await typeValue(page, `input[aria-label=${JSON.stringify(question.label)}]`, "12,5");
    } else {
      await typeValue(page, `textarea[aria-label=${JSON.stringify(question.label)}]`, "OK");
    }
    await sleep(120);
  }
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());

const phone = await launch({ width: 390, height: 844, mobile: true });
let office;
let devices;
let questions;
let inspectionUrl;
try {
  const owner = await createUser("insp-owner");
  const tech = await createUser("insp-tech");
  let siteId;

  await step("setup: a building with four active devices and a technician", async () => {
    await signIn(phone, owner);
    await phone.waitForUrl("/onboarding");
    await phone.type("#organizationName", "Revize Novák");
    await phone.type("#displayName", "Petr Novák");
    await phone.clickText("Vytvořit firmu");
    await phone.waitForText("Vítejte, Petr");
    const org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    const [template] = await selectRows(
      "checklist_templates",
      `device_type_id=eq.${type.id}&active=eq.true&select=id`,
    );
    questions = await selectRows(
      "checklist_template_items",
      `template_id=eq.${template.id}&select=label,item_type,required&order=sort_order`,
    );
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "Bytové družstvo Lipová" },
    ]);
    const [site] = await insertRows("sites", [
      {
        organization_id: org,
        customer_id: customer.id,
        name: "Lipová 12",
        access_notes: "Klíče u správce v přízemí.",
      },
    ]);
    siteId = site.id;
    const [suteren, patro] = await insertRows("locations", [
      { organization_id: org, site_id: siteId, name: "Suterén", sort_order: 1 },
      { organization_id: org, site_id: siteId, name: "1. patro", sort_order: 2 },
    ]);
    const row = (location, status = "active") => ({
      organization_id: org,
      site_id: siteId,
      location_id: location,
      device_type_id: type.id,
      status,
      attributes: {},
    });
    devices = await insertRows("devices", [
      row(suteren.id),
      row(suteren.id),
      row(patro.id),
      row(patro.id),
      row(patro.id, "out_of_service"),
    ]);
    await phone.click('header button[aria-label="Otevřít menu účtu"]');
    await phone.clickText("Odhlásit se");
    await phone.waitForUrl("/login");
  });

  await step("a technician starts the building's inspection on the phone", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 4");
    await phone.waitForText("Klíče u správce v přízemí.");
    inspectionUrl = new URL(await phone.url()).pathname;
    await phone.screenshot(`${OUT}/p7-01-run.png`);
  });

  await step("a photo of the label opens the device's check", async () => {
    await phone.clickText("Skenovat štítek");
    await phone.waitForText("Vyfotit štítek");
    const file = qrPng(`${APP}/d/${devices[0].public_token}`, `${OUT}/p7-label.png`);
    await phone.setFile('[data-testid="scanner-photo"]', file);
    await phone.waitForUrl(`${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Hasicí přístroj 0001");
    await phone.waitForText("Uloženo");
  });

  await step("answers and a photo are saved as they are given and survive a reload", async () => {
    const yesNo = questions.find((q) => q.item_type === "pass_fail");
    await answer(phone, yesNo.label, "Vyhovuje");
    await phone.setFile(`[data-testid="photo-__device"]`, photoPng(`${OUT}/p7-photo.png`));
    await phone.waitForText("Uloženo");
    // The photo is uploaded when its "waiting" mark disappears.
    for (let i = 0; i < 60; i++) {
      const waiting = await phone.evaluate(
        `document.body.innerText.includes("Čeká na spojení") || document.body.innerText.includes("Nahrávám")`,
      );
      if (!waiting) break;
      await sleep(250);
    }
    await sleep(500);
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Uloženo");
    const chosen = await pressed(phone, yesNo.label);
    if (chosen.join() !== "Vyhovuje") throw new Error(`after reload: ${chosen}`);
    const images = await phone.evaluate(`document.querySelectorAll("main img").length`);
    if (images !== 1) throw new Error(`photos after reload: ${images}`);
  });

  await step(
    "without a signal answers stay in the phone and are sent when it returns",
    async () => {
      await phone.send("Network.enable");
      await phone.send("Network.emulateNetworkConditions", {
        offline: true,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      const second = questions.filter((q) => q.item_type === "pass_fail")[1];
      await answer(phone, second.label, "Vyhovuje");
      await phone.waitForText("Bez spojení");
      await phone.waitForText("Odpovědi a fotky zůstanou v telefonu");
      const stored = await phone.evaluate(
        `Object.keys(localStorage).filter((k) => k.startsWith("sparxdeck.check.")).length`,
      );
      if (stored !== 1) throw new Error(`drafts in the phone: ${stored}`);
      await phone.screenshot(`${OUT}/p7-02-offline.png`);
      await phone.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      await phone.waitForText("Uloženo", 30000);
      const left = await phone.evaluate(
        `Object.keys(localStorage).filter((k) => k.startsWith("sparxdeck.check.")).length`,
      );
      if (left !== 0) throw new Error(`drafts left after reconnecting: ${left}`);
    },
  );

  await step("missing required answers are pointed out, then the check is finished", async () => {
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("povinn");
    await phone.screenshot(`${OUT}/p7-03-missing.png`);
    await answerAll(phone, questions);
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0001: vyhovuje.");
    await phone.waitForUrl(inspectionUrl);
    await phone.waitForText("Zkontrolováno 1 z 4");
  });

  await step("a colleague's check is shown as held, and can be taken over", async () => {
    office = await launch({ width: 1280, height: 900 });
    await signIn(office, owner);
    await office.waitForText("Vítejte, Petr");
    await office.goto(`${APP}${inspectionUrl}/check/${devices[1].id}`);
    await office.waitForText("Uloženo");
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[1].id}`);
    await phone.waitForText("Zařízení právě kontroluje Petr Novák");
    await phone.screenshot(`${OUT}/p7-04-held.png`);
    await phone.clickText("Převzít kontrolu", "button");
    await phone.waitForText("Uloženo");
    // The office's next answer is refused and explained.
    await answer(office, questions.find((q) => q.item_type === "pass_fail").label, "Vyhovuje");
    await office.waitForText("Kontrolu převzal kolega");
    await answerAll(phone, questions, true);
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0002: nevyhovuje.");
    await phone.waitForText("Zkontrolováno 2 z 4");
  });

  await step("an open check blocks completion until it is finished", async () => {
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[2].id}`);
    await phone.waitForText("Uloženo");
    await answer(phone, questions.find((q) => q.item_type === "pass_fail").label, "Vyhovuje");
    await phone.waitForText("Uloženo");
    await phone.goto(`${APP}${inspectionUrl}/complete`);
    await phone.waitForText("Rozpracované kontroly");
    const blocked = await phone.evaluate(
      `document.querySelector("main button[type=submit]").disabled`,
    );
    if (!blocked) throw new Error("completion not blocked");
    await phone.clickText("0003", "a");
    await phone.waitForText("Uloženo");
    await answerAll(phone, questions);
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("Zkontrolováno 3 z 4");
  });

  await step(
    "completing records the unchecked device and moves due dates of passed ones",
    async () => {
      await phone.clickText("Dokončit revizi", "a");
      await phone.waitForText("Nezkontrolovaná zařízení");
      await phone.screenshot(`${OUT}/p7-05-complete.png`);
      await phone.type("#notes", "Bez problémů, jen 0002 nevyhovuje.");
      await phone.clickText("Dokončit revizi", "button");
      await phone.waitForText("Revize dokončena.");
      await phone.waitForText("Výsledky zařízení");
      await phone.screenshot(`${OUT}/p7-06-result.png`);
      const rows = await selectRows(
        "devices",
        `id=in.(${devices.map((d) => d.id).join(",")})&select=id,last_inspection_on,next_due_on`,
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      const dates = devices.slice(0, 4).map((d) => byId[d.id].last_inspection_on);
      if (JSON.stringify(dates) !== JSON.stringify([today, null, today, null]))
        throw new Error(`last inspections ${JSON.stringify(dates)}`);
      if (!byId[devices[0].id].next_due_on) throw new Error("no next due date");
    },
  );

  await step("the completed check can be read, not changed", async () => {
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Revize je dokončená, kontrolu už nelze měnit.");
    const editable = await phone.evaluate(
      `document.querySelectorAll("[role=group] button").length`,
    );
    if (editable) throw new Error("answers still editable");
    await phone.screenshot(`${OUT}/p7-07-record.png`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await phone.screenshot(`${OUT}/p7-failure.png`);
  if (office) await office.screenshot(`${OUT}/p7-failure-office.png`);
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

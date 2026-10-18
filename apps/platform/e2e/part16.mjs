// Part 16 walkthrough: an inspection without a signal. Opening it online saves it
// in the phone; with no network at all (page and service worker) the page opens
// from the phone, a label is scanned, devices are checked (with a photo), left
// out and a defect is closed, the page survives a reload and the offline page
// lists it; completing asks for a connection. Back online everything is sent,
// dated when it was done. A device removed meanwhile: its changes are named and
// discarded. With a weak signal the saved page shows within seconds. A
// colleague's check meanwhile is a conflict: the technician keeps theirs.
// Signing out with unsent changes warns and wipes the phone. Dark mode and English.
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
  updateRows,
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

async function until(what, check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`timeout: ${what}`);
}

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

const SEAL = "Plomba je neporušená";
const SIGN = "Nápis je čitelný";

const answer = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);
const text = (page) => page.evaluate(`document.querySelector("main").innerText`);
const status = (page) =>
  page.evaluate(`document.querySelector("[data-testid=field-status]")?.innerText ?? ""`);
/** The list's "All" tab (the default shows what remains). */
const showAll = (page) =>
  page.evaluate(
    `[...document.querySelectorAll("[role=tab]")].find((tab) => tab.innerText.trim().startsWith("Vše"))?.click()`,
  );
/** Opens a device from the list, as a tap does (no server needed). */
const openDevice = async (page, label) => {
  await showAll(page);
  await sleep(200);
  await page.evaluate(`(() => {
    const link = [...document.querySelectorAll("main a")].find((a) => a.innerText.trim().startsWith(${JSON.stringify(label)}));
    link.click();
  })()`);
};
const rowText = async (page, label) => {
  await showAll(page);
  await sleep(200);
  return page.evaluate(
    `[...document.querySelectorAll("main a")].find((a) => a.innerText.trim().startsWith(${JSON.stringify(label)}))?.innerText ?? ""`,
  );
};
/** What the phone keeps: drafts and queued actions, packs, cached pages. */
const phoneData = (page) =>
  page.evaluate(`(async () => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("sparxdeck.check.") || k.startsWith("sparxdeck.field."));
    const db = await new Promise((resolve) => { const r = indexedDB.open("sparxdeck"); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
    const count = (store) => new Promise((resolve) => {
      if (!db || !db.objectStoreNames.contains(store)) return resolve(0);
      const r = db.transaction(store).objectStore(store).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(0);
    });
    const packs = await count("packs");
    const photos = await count("pending-photos");
    db?.close();
    const pages = (await caches.has("sparxdeck-pages-v1")) ? (await (await caches.open("sparxdeck-pages-v1")).keys()).map((r) => new URL(r.url).pathname) : [];
    return { drafts: keys.length, packs, photos, pages };
  })()`);

let phone = await launch({ width: 390, height: 844, mobile: true });
let office;
try {
  const owner = await createUser("offline-owner");
  const tech = await createUser("offline-tech");
  let org;
  let siteId;
  let devices;
  let inspectionUrl;
  let inspectionId;
  let doneAt;

  await step("setup: a building with four devices, one with an open defect", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Malý");
    await office.type("#displayName", "Petra Malá");
    await office.clickText("Vytvořit firmu");
    await office.waitForText("Vítejte, Petra");
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    await updateRows("checklist_templates", `device_type_id=eq.${type.id}`, { active: false });
    const [template] = await insertRows("checklist_templates", [
      {
        organization_id: org,
        device_type_id: type.id,
        version: 2,
        name: "Kontrola",
        is_sample: false,
        active: true,
      },
    ]);
    await insertRows("checklist_template_items", [
      {
        organization_id: org,
        template_id: template.id,
        sort_order: 1,
        label: SEAL,
        item_type: "pass_fail",
        required: true,
        fail_creates_defect: true,
      },
      {
        organization_id: org,
        template_id: template.id,
        sort_order: 2,
        label: SIGN,
        item_type: "pass_fail",
        required: true,
        fail_creates_defect: false,
      },
    ]);
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "Bytové družstvo Lipová" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Lipová 12" },
    ]);
    siteId = site.id;
    const row = () => ({
      organization_id: org,
      site_id: siteId,
      device_type_id: type.id,
      status: "active",
      attributes: {},
    });
    devices = await insertRows("devices", [row(), row(), row(), row()]);
    devices.sort((a, b) => a.label_number - b.label_number);
    await insertRows("defects", [
      {
        organization_id: org,
        number: 1,
        device_id: devices[3].id,
        description: "Nápis vybledlý",
        severity: "minor",
        created_by: owner.id,
      },
    ]);
  });

  await step("opening the inspection with a signal saves it in the phone", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 4");
    inspectionUrl = new URL(await phone.url()).pathname;
    inspectionId = inspectionUrl.split("/")[2];
    await phone.waitForText("Revize je uložená v telefonu", 30000);
    // Loaded again, the service worker serves the page and keeps its files.
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("Revize je uložená v telefonu", 30000);
    await until("files kept by the service worker", () =>
      phone.evaluate(
        `navigator.serviceWorker.controller !== null && caches.open("sparxdeck-static-v1").then((c) => c.keys()).then((k) => k.length > 10)`,
      ),
    );
    const kept = await phoneData(phone);
    if (kept.packs !== 1 || !kept.pages.includes(inspectionUrl))
      throw new Error(`kept ${JSON.stringify(kept)}`);
    await phone.screenshot(`${OUT}/p16-01-ready.png`);
  });

  await step("without any signal the inspection opens and devices are checked", async () => {
    await phone.setOffline(true);
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("Zkontrolováno 0 z 4");
    await phone.waitForText("Bez signálu");

    // A label scanned: the decoder was loaded while there was a signal.
    await phone.clickText("Skenovat štítek");
    await phone.waitForText("Vyfotit štítek");
    await phone.setFile(
      '[data-testid="scanner-photo"]',
      qrPng(`${APP}/d/${devices[0].public_token}`, `${OUT}/p16-label.png`),
    );
    await phone.waitForUrl(`${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Hasicí přístroj 0001");
    await phone.waitForText("Odpovědi a fotky zůstanou v telefonu");
    await answer(phone, SEAL, "Nevyhovuje");
    await answer(phone, SIGN, "Vyhovuje");
    await phone.setFile(`[data-testid="photo-__device"]`, photoPng(`${OUT}/p16-photo.png`));
    await phone.waitForText("Čeká na spojení");
    await phone.screenshot(`${OUT}/p16-02-offline-check.png`);
    doneAt = Date.now();
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0001: Nevyhovuje. Uloženo v telefonu");
    await phone.waitForText("Zkontrolováno 1 z 4");
    if (!(await rowText(phone, "0001")).includes("Nevyhovuje · čeká na odeslání"))
      throw new Error(`row 0001: ${await rowText(phone, "0001")}`);

    // Left out: locked.
    await openDevice(phone, "0002");
    await phone.waitForText("Hasicí přístroj 0002");
    await phone.clickText("Nelze zkontrolovat", "button");
    await phone.evaluate(
      `[...document.querySelectorAll("[role=dialog] [role=radio]")].find((b) => b.innerText.trim().startsWith("Nepřístupné")).click()`,
    );
    await phone.type("#skip-note", "Sklep zamčený");
    await phone.clickText("Označit a pokračovat", "button");
    await phone.waitForText("Zkontrolováno 2 z 4");

    // Passed, with an open defect: closing it waits in the phone too.
    await openDevice(phone, "0004");
    await phone.waitForText("Otevřené závady zařízení");
    await answer(phone, SEAL, "Vyhovuje");
    await answer(phone, SIGN, "Vyhovuje");
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("Kontrola vyhověla");
    await phone.clickText("Uzavřít vybrané", "button");
    await phone.waitForText("Uzavření 1 závady se odešle po připojení.");
    await phone.waitForText("Zkontrolováno 3 z 4");
    const waiting = await status(phone);
    if (!waiting.includes("3 kontroly, 1 fotka, 1 uzavření závady"))
      throw new Error(`status: ${waiting}`);
    await phone.screenshot(`${OUT}/p16-03-offline-run.png`);

    // Completing needs a connection.
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("Dokončení revize potřebuje připojení");
  });

  await step("the work survives a reload, and the offline page lists it", async () => {
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("Zkontrolováno 3 z 4");
    await phone.goto(`${APP}/`);
    await phone.waitForText("Bez připojení");
    await phone.waitForText("Lipová 12");
    await phone.waitForText("čeká na odeslání");
    await phone.screenshot(`${OUT}/p16-04-offline-page.png`);
    await phone.evaluate(`document.querySelector('main a[href^="/inspections/"]').click()`);
    await phone.waitForText("Zkontrolováno 3 z 4");
    // Some time passes before the signal comes back.
    await sleep(Math.max(0, 5000 - (Date.now() - doneAt)));
  });

  await step("back online, everything is sent, dated when it was done", async () => {
    const onlineAt = Date.now();
    await phone.setOffline(false);
    await until("sent", async () => (await status(phone)).includes("Vše je odeslané"), 40000);
    const items = await selectRows(
      "inspection_items",
      `inspection_id=eq.${inspectionId}&select=device_id,outcome,skip_reason,notes,checked_at,checked_by`,
    );
    const by = Object.fromEntries(items.map((item) => [item.device_id, item]));
    const first = by[devices[0].id];
    if (first?.outcome !== "failed" || first.checked_by !== tech.id)
      throw new Error(`0001 ${JSON.stringify(first)}`);
    // Dated when "Done" was pressed, not when the signal returned.
    if (Date.parse(first.checked_at) > onlineAt - 3000)
      throw new Error(
        `0001 dated ${first.checked_at}, online at ${new Date(onlineAt).toISOString()}`,
      );
    const second = by[devices[1].id];
    if (second?.skip_reason !== "inaccessible" || second.notes !== "Sklep zamčený")
      throw new Error(`0002 ${JSON.stringify(second)}`);
    if (by[devices[3].id]?.outcome !== "passed") throw new Error("0004 not passed");
    const photos = await selectRows(
      "inspection_photos",
      `organization_id=eq.${org}&select=id,uploaded_by`,
    );
    if (photos.length !== 1 || photos[0].uploaded_by !== tech.id)
      throw new Error(`photos ${JSON.stringify(photos)}`);
    const [defect] = await selectRows(
      "defects",
      `organization_id=eq.${org}&select=status,resolved_by,resolution_note`,
    );
    if (defect.status !== "resolved" || defect.resolved_by !== tech.id)
      throw new Error(`defect ${JSON.stringify(defect)}`);
    const left = await phoneData(phone);
    if (left.drafts !== 0 || left.photos !== 0) throw new Error(`left ${JSON.stringify(left)}`);
    if (!(await rowText(phone, "0001")).includes("Nevyhovuje"))
      throw new Error("0001 not shown as checked");
  });

  await step(
    "a device removed meanwhile: its changes are named, block completing, discarded",
    async () => {
      const [extra] = await insertRows("devices", [
        {
          organization_id: org,
          site_id: siteId,
          device_type_id: devices[0].device_type_id,
          status: "active",
          attributes: {},
        },
      ]);
      const label = String(extra.label_number).padStart(4, "0");
      await phone.goto(`${APP}${inspectionUrl}`);
      await phone.waitForText("Zkontrolováno 3 z 5");
      await phone.waitForText("Revize je uložená v telefonu", 30000);
      await phone.setOffline(true);
      await openDevice(phone, label);
      await phone.waitForText(`Hasicí přístroj ${label}`);
      await answer(phone, SEAL, "Vyhovuje");
      await answer(phone, SIGN, "Vyhovuje");
      await phone.setFile(`[data-testid="photo-__device"]`, photoPng(`${OUT}/p16-photo.png`));
      await phone.waitForText("Čeká na spojení");
      await phone.clickText("Hotovo", "button");
      await phone.waitForText(`${label}: Vyhovuje. Uloženo v telefonu`);
      // Meanwhile the office removes it.
      await updateRows("devices", `id=eq.${extra.id}`, { deleted_at: new Date().toISOString() });
      await phone.setOffline(false);
      await phone.waitForText("Zařízení už v revizi není", 40000);
      await phone.waitForText(`Změny u zařízení ${label} nejde uložit`);
      await phone.waitForText("Zkontrolováno 3 z 4");
      // Its photo waits with it, not as something the phone will send.
      const waiting = await status(phone);
      if (!waiting.includes("Čeká na vaše rozhodnutí") || waiting.includes("fotka"))
        throw new Error(`status: ${waiting}`);
      await phone.clickText("Dokončit revizi", "a");
      await phone.waitForText(`Nejdřív rozhodněte, co se změnami u zařízení ${label}.`);
      await phone.screenshot(`${OUT}/p16-10-gone.png`);
      await phone.clickText("Zahodit tyto změny", "button");
      await until("discarded", async () => (await status(phone)).includes("Vše je odeslané"));
      const left = await phoneData(phone);
      if (left.drafts !== 0 || left.photos !== 0) throw new Error(`left ${JSON.stringify(left)}`);
      if ((await text(phone)).includes("Zařízení už v revizi není"))
        throw new Error("the alert stays after discarding");
    },
  );

  await step("with a weak signal the saved page shows within seconds", async () => {
    await phone.setNetwork({ latency: 20000 });
    try {
      // The old page shows the same text: wait for the new one.
      await phone.evaluate("window.__beforeReload = true");
      const started = Date.now();
      await phone.send("Page.navigate", { url: `${APP}${inspectionUrl}` });
      await until(
        "the saved page",
        () =>
          phone
            .evaluate(
              `!window.__beforeReload && document.body.innerText.includes("Zkontrolováno 3 z 4")`,
            )
            .catch(() => false),
        15000,
      );
      const took = Date.now() - started;
      if (took > 12000) throw new Error(`the saved page took ${took} ms`);
    } finally {
      await phone.setNetwork({});
    }
  });

  await step(
    "a colleague's check meanwhile is a conflict; the technician keeps theirs",
    async () => {
      await phone.setOffline(true);
      await openDevice(phone, "0003");
      await phone.waitForText("Hasicí přístroj 0003");
      await answer(phone, SEAL, "Vyhovuje");
      await answer(phone, SIGN, "Vyhovuje");
      await phone.clickText("Hotovo", "button");
      await phone.waitForText("Zkontrolováno 4 z 4");
      // Re-checking 0001 too (to sign out with it later).
      await openDevice(phone, "0001");
      await phone.waitForText("Hasicí přístroj 0001");
      await answer(phone, SEAL, "Vyhovuje");
      await phone.clickText("Hotovo", "button");
      await phone.waitForText("0001: Vyhovuje. Uloženo v telefonu");

      // Meanwhile the office checks both, online.
      for (const device of [devices[2], devices[0]]) {
        await office.goto(`${APP}${inspectionUrl}/check/${device.id}`);
        await office.waitForText("Uloženo");
        await answer(office, SEAL, "Vyhovuje");
        await answer(office, SIGN, "Nevyhovuje");
        await office.waitForText("Uloženo");
        await office.clickText("Hotovo", "button");
        await office.waitForText("nevyhovuje.");
        await office.waitForUrl(inspectionUrl);
      }

      await phone.setOffline(false);
      await phone.waitForText("Kolega mezitím zkontroloval stejná zařízení", 40000);
      if (!(await rowText(phone, "0003")).includes("Konflikt")) throw new Error("no conflict mark");
      await phone.screenshot(`${OUT}/p16-05-conflict-run.png`);
      await openDevice(phone, "0003");
      await phone.waitForText("Petra Malá mezitím zkontroloval(a) toto zařízení");
      await phone.waitForText("Výsledek kolegy: Nevyhovuje");
      await phone.screenshot(`${OUT}/p16-06-conflict.png`);
      await phone.clickText("Platí moje", "button");
      await until("0003 replaced", async () => {
        const [item] = await selectRows(
          "inspection_items",
          `inspection_id=eq.${inspectionId}&device_id=eq.${devices[2].id}&select=outcome,checked_by`,
        );
        return item?.outcome === "passed" && item.checked_by === tech.id;
      });
      const answers = await selectRows(
        "inspection_answers",
        `organization_id=eq.${org}&select=answered_by,value_pass,item:inspection_items!inner(device_id)&item.device_id=eq.${devices[2].id}`,
      );
      if (answers.some((a) => a.answered_by !== tech.id || a.value_pass !== true))
        throw new Error(`0003 answers ${JSON.stringify(answers)}`);
    },
  );

  await step("signing out with unsent changes warns, then wipes the phone", async () => {
    // 0001 still waits on its conflict.
    await phone.waitForText("Kolega mezitím zkontroloval stejná zařízení");
    await phone.click('header button[aria-label="Otevřít menu účtu"]');
    await phone.clickText("Odhlásit se");
    await phone.waitForText("V telefonu čeká 1 neodeslaná změna");
    await phone.screenshot(`${OUT}/p16-07-sign-out.png`);
    await phone.clickText("Odhlásit a smazat", "button");
    await phone.waitForUrl("/login");
    const left = await phoneData(phone);
    if (left.drafts || left.packs || left.photos || left.pages.length)
      throw new Error(`left after signing out ${JSON.stringify(left)}`);
  });

  await step("dark mode and English", async () => {
    await phone.close();
    phone = await launch({ width: 390, height: 844, mobile: true, dark: true });
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("Checked 4 of 4");
    await phone.waitForText("saved in this phone", 30000);
    await phone.screenshot(`${OUT}/p16-08-dark-en.png`);
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("saved in this phone", 30000);
    await phone.setOffline(true);
    await phone.goto(`${APP}/`);
    await phone.waitForText("Inspections in this phone");
    await phone.screenshot(`${OUT}/p16-09-dark-en-offline.png`);
    await phone.setOffline(false);
    const content = await text(phone);
    if (!content.includes("Lipová 12")) throw new Error("offline list empty");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await phone.screenshot(`${OUT}/p16-failure.png`);
  if (office) await office.screenshot(`${OUT}/p16-failure-office.png`);
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

// Part 8 walkthrough: a technician fails items during an inspection (one always
// records a defect, one only when asked), the office finds the defects, works on
// one and resolves it with a note, the history shows who did what; a defect is
// reported by hand with a photo; a repeated failure is added to the open defect.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
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

/** A small "photo" of the damage. */
function photoPng(file) {
  const png = new PNG({ width: 64, height: 48 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([40, 90, 200, 255], i);
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
/** The severity choices under a failed answer: [labels, chosen]. */
const severities = (page, questionLabel) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=radiogroup][aria-label=${JSON.stringify(`Závada: ${questionLabel}`)}]');
    if (!group) return null;
    const buttons = [...group.querySelectorAll("button")];
    return [buttons.map((b) => b.innerText.trim()), buttons.find((b) => b.getAttribute("aria-checked") === "true")?.innerText.trim()];
  })()`);
const chooseSeverity = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=radiogroup][aria-label=${JSON.stringify(`Závada: ${questionLabel}`)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.trim() === ${JSON.stringify(choice)}).click();
  })()`);
const typeValue = (page, selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
const text = (page) => page.evaluate(`document.querySelector("main").innerText`);
const rowCount = (page) => page.evaluate(`document.querySelectorAll("main tbody tr").length`);

const phone = await launch({ width: 390, height: 844, mobile: true });
let office;
let devices;
let questionIds;
let inspectionUrl;
let org;
try {
  const owner = await createUser("defect-owner");
  const tech = await createUser("defect-tech");
  let siteId;
  let customerId;

  await step("setup: a building, a technician and a checklist with two yes/no items", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Dvořák");
    await office.type("#displayName", "Petra Dvořáková");
    await office.clickText("Vytvořit firmu");
    await office.waitForText("Vítejte, Petra");
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    // A new version: the seal always records a defect, the sign only when asked.
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
    const items = await insertRows("checklist_template_items", [
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
    questionIds = Object.fromEntries(items.map((item) => [item.label, item.id]));
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "Základní škola Na Výsluní" },
    ]);
    customerId = customer.id;
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Pavilon A" },
    ]);
    siteId = site.id;
    const row = () => ({
      organization_id: org,
      site_id: siteId,
      device_type_id: type.id,
      status: "active",
      attributes: {},
    });
    devices = await insertRows("devices", [row(), row(), row()]);
  });

  await step("a failed item asks how serious the defect is", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 3");
    inspectionUrl = new URL(await phone.url()).pathname;
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Uloženo");
    if (await severities(phone, SEAL)) throw new Error("severity shown before a failure");

    await answer(phone, SEAL, "Nevyhovuje");
    await sleep(200);
    const [sealChoices, sealChosen] = await severities(phone, SEAL);
    if (sealChoices.join() !== "Drobná,Závažná,Kritická" || sealChosen !== "Závažná")
      throw new Error(`seal severities ${sealChoices} / ${sealChosen}`);
    await chooseSeverity(phone, SEAL, "Kritická");
    await phone.evaluate(
      `[...document.querySelectorAll("#question-${questionIds[SEAL]} button")].find((b) => b.innerText.trim() === "Poznámka").click()`,
    );
    await sleep(200);
    await typeValue(phone, `textarea[aria-label="Poznámka k položce ${SEAL}"]`, "Chybí plomba");

    await answer(phone, SIGN, "Nevyhovuje");
    await sleep(200);
    const [signChoices, signChosen] = await severities(phone, SIGN);
    if (signChoices[0] !== "Nezapisovat" || signChosen !== "Nezapisovat")
      throw new Error(`sign severities ${signChoices} / ${signChosen}`);
    await chooseSeverity(phone, SIGN, "Drobná");
    await phone.waitForText("Při dokončení revize vznikne závada.");
    await phone.waitForText("Uloženo");
    await phone.screenshot(`${OUT}/p8-01-severity.png`);
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0001: nevyhovuje.");
    await phone.waitForText("Zkontrolováno 1 z 3");

    // Second device: the sign fails, but no defect is asked for.
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[1].id}`);
    await phone.waitForText("Uloženo");
    await answer(phone, SEAL, "Vyhovuje");
    await answer(phone, SIGN, "Nevyhovuje");
    await sleep(200);
    await phone.waitForText("Uloženo");
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0002: nevyhovuje.");
    await phone.waitForText("Zkontrolováno 2 z 3");
  });

  await step("completing says how many defects it records and records them", async () => {
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("Vzniknou 2 závady z nevyhovujících položek.");
    await phone.screenshot(`${OUT}/p8-02-complete.png`);
    await phone.clickText("Dokončit revizi", "button");
    await phone.waitForText("Revize dokončena. Vznikly 2 závady.");
    await phone.waitForText("Závady z revize");
    await phone.screenshot(`${OUT}/p8-03-result.png`);
    const defects = await selectRows(
      "defects",
      `organization_id=eq.${org}&select=number,device_id,severity,status,description,created_by&order=number`,
    );
    const summary = defects.map((d) => [
      d.number,
      d.device_id === devices[0].id,
      d.severity,
      d.description,
    ]);
    const expected = [
      [1, true, "critical", `${SEAL}: Chybí plomba`],
      [2, true, "minor", SIGN],
    ];
    if (JSON.stringify(summary) !== JSON.stringify(expected))
      throw new Error(`defects ${JSON.stringify(summary)}`);
    if (defects.some((d) => d.created_by !== tech.id))
      throw new Error("not recorded as the technician's");
  });

  await step("the office finds the defects in the list and by filters", async () => {
    await office.goto(`${APP}/defects`);
    await office.waitForText("Z-0001");
    if ((await rowCount(office)) !== 2) throw new Error(`rows ${await rowCount(office)}`);
    await office.screenshot(`${OUT}/p8-04-list.png`);
    await office.goto(`${APP}/defects?severity=critical`);
    await office.waitForText("1 výsledek");
    await office.goto(`${APP}/defects?q=0001`);
    await office.waitForText("2 výsledky");
    await office.goto(`${APP}/defects?customer=${customerId}&sort=severity`);
    await office.waitForText("2 výsledky");
    const first = await office.evaluate(`document.querySelector("main tbody tr").innerText`);
    if (!first.includes("Z-0001")) throw new Error(`worst first: ${first}`);
    await office.goto(`${APP}/`);
    await office.waitForText("Otevřené závady (2)");
  });

  await step("the office works on a defect and resolves it with a note", async () => {
    await office.goto(`${APP}/defects?severity=critical`);
    await office.clickText("Z-0001", "a");
    await office.waitForText("Tomáš Technik zjistil(a) závadu při revizi (Kritická)");
    await office.waitForText("Fotky (0)");
    await office.clickText("Začít řešit", "button");
    await office.waitForText("Petra Dvořáková: Otevřená → Řeší se");
    await office.type("#defect-comment", "Objednána nová plomba.");
    await office.clickText("Přidat poznámku", "button");
    await office.waitForText("Objednána nová plomba.");
    await office.clickText("Vyřešit", "button");
    await office.waitForText("Vyřešit závadu");
    await office.clickText("Vyřešit", "button");
    await office.waitForText("Napište, jak byla závada vyřešena.");
    await office.type("textarea[placeholder^='Např.']", "Plomba vyměněna.");
    await office.clickText("Vyřešit", "button");
    await office.waitForText("Petra Dvořáková: Řeší se → Vyřešená");
    await office.waitForText("Znovu otevřít");
    await office.screenshot(`${OUT}/p8-05-resolved.png`);
    const [defect] = await selectRows(
      "defects",
      `organization_id=eq.${org}&number=eq.1&select=status,resolved_by,resolution_note`,
    );
    if (defect.status !== "resolved" || defect.resolved_by !== owner.id)
      throw new Error(`resolved ${JSON.stringify(defect)}`);
    if (defect.resolution_note !== "Plomba vyměněna.") throw new Error("resolution note");
  });

  await step(
    "device, building and customer show their open defects; the device its checks",
    async () => {
      await office.goto(`${APP}/devices/${devices[0].id}`);
      await office.waitForText("Všechny závady (2)");
      // The device's check from the inspection, in its history.
      await office.waitForText("Historie kontrol (1)");
      const deviceText = await text(office);
      if (!deviceText.includes("Z-0002") || deviceText.includes("Z-0001"))
        throw new Error("device card should list only the open defect");
      await office.screenshot(`${OUT}/p8-06-device.png`);
      await office.goto(`${APP}/sites/${siteId}`);
      await office.waitForText("Z-0002");
      await office.goto(`${APP}/customers/${customerId}`);
      await office.waitForText("Z-0002");
      await office.clickText("Všechny závady (2)", "a");
      await office.waitForText("Vyřešená");
    },
  );

  await step("a technician reports a defect by hand with a photo, and resolves it", async () => {
    await phone.goto(`${APP}/devices/${devices[2].id}`);
    await phone.clickText("Nahlásit závadu", "a");
    await phone.waitForText("Hasicí přístroj 0003");
    await phone.type("#defect-description", "Přístroj zastavěný regálem");
    await phone.evaluate(
      `[...document.querySelectorAll("[role=radio]")].find((b) => b.innerText.trim() === "Drobná").click()`,
    );
    await phone.setFile('[data-testid="defect-photo"]', photoPng(`${OUT}/p8-photo.png`));
    await phone.waitFor("main li img");
    await phone.screenshot(`${OUT}/p8-07-report.png`);
    await phone.clickText("Nahlásit závadu", "button");
    await phone.waitForText("Závada Z-0003 nahlášena.");
    await phone.waitForText("Tomáš Technik zapsal(a) závadu (Drobná)");
    await phone.waitForText("Fotky (1)");
    const images = await phone.evaluate(`document.querySelectorAll("main img").length`);
    if (images !== 1) throw new Error(`photos ${images}`);
    await phone.screenshot(`${OUT}/p8-08-detail-phone.png`);
    await phone.clickText("Vyřešit", "button");
    await phone.type("textarea[placeholder^='Např.']", "Regál odsunut.");
    await phone.clickText("Vyřešit", "button");
    await phone.waitForText("Tomáš Technik: Otevřená → Vyřešená");
  });

  await step("a repeated failure is added to the open defect, not recorded twice", async () => {
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 3");
    const secondRun = new URL(await phone.url()).pathname;
    await phone.goto(`${APP}${secondRun}/check/${devices[0].id}`);
    await phone.waitForText("Otevřené závady zařízení");
    await answer(phone, SEAL, "Vyhovuje");
    await answer(phone, SIGN, "Nevyhovuje");
    await phone.waitForText("Připíše se k otevřené závadě Z-0002.");
    await phone.waitForText("Uloženo");
    await phone.screenshot(`${OUT}/p8-09-again.png`);
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0001: nevyhovuje.");
    await phone.waitForText("Zkontrolováno 1 z 3");
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("1 nevyhovující položka se připíše k otevřené závadě.");
    await phone.clickText("Dokončit revizi", "button");
    await phone.waitForText("Revize dokončena.");
    const defects = await selectRows("defects", `organization_id=eq.${org}&select=number`);
    if (defects.length !== 3) throw new Error(`defects ${defects.length}`);
    await office.goto(`${APP}/defects?q=0001`);
    await office.clickText("Z-0002", "a");
    await office.waitForText("Znovu zjištěno při revizi");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await phone.screenshot(`${OUT}/p8-failure.png`);
  if (office) await office.screenshot(`${OUT}/p8-failure-office.png`);
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

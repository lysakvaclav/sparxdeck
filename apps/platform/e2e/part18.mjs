// Part 18 walkthrough: a technician completes an inspection and signs with the
// customer's finger; the office corrects a mistake afterwards (reopen, redo one
// check, complete again) and sees a new protocol version while the old one
// stays; the summary report across the building's inspections downloads a PDF.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
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

const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
  new Date(),
);

const answer = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);

/** A short zig-zag stroke drawn on the signature canvas with dispatched pointer events. */
const drawSignature = (page, selector) =>
  page.evaluate(`(() => {
    const canvas = document.querySelector(${JSON.stringify(selector)});
    const rect = canvas.getBoundingClientRect();
    const fire = (type, x, y) =>
      canvas.dispatchEvent(new PointerEvent(type, {
        clientX: rect.left + x, clientY: rect.top + y, pointerId: 7, bubbles: true, cancelable: true,
      }));
    fire("pointerdown", 15, 15);
    fire("pointermove", 45, 45);
    fire("pointermove", 90, 20);
    fire("pointerup", 90, 20);
  })()`);

/** Downloads a file the way a link would and describes the response. */
const download = (page, path) =>
  page.evaluate(`(async () => {
    const response = await fetch(${JSON.stringify(path)});
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, head: String.fromCharCode(...bytes.slice(0, 5)), size: bytes.length };
  })()`);

let phone = await launch({ width: 390, height: 844, mobile: true });
let office;
let org;
let devices;
let questions;
let inspectionUrl;
let siteId;
try {
  const owner = await createUser("part18-owner");
  const tech = await createUser("part18-tech");

  await step("setup: company, customer, building and two devices", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Osmnáct");
    await office.type("#displayName", "Olga Osmnáctá");
    await office.clickText("Vytvořit firmu");
    await office.waitForText("Vítejte, Olga");
    org = await organizationOf(owner);
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
      { organization_id: org, name: "Bytové družstvo Osmnáct", email: "vybor@osmnact.example" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Osmnáctá 18" },
    ]);
    siteId = site.id;
    devices = await insertRows(
      "devices",
      [1, 2].map((n) => ({
        organization_id: org,
        site_id: siteId,
        device_type_id: type.id,
        status: "active",
        serial_number: `P18-${n}`,
        attributes: {},
      })),
    );
  });

  const required = () => questions.filter((q) => q.required && q.item_type === "pass_fail");

  await step("the technician completes the inspection and the customer signs", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 2");
    inspectionUrl = new URL(await phone.url()).pathname;
    for (const device of devices) {
      await phone.goto(`${APP}${inspectionUrl}/check/${device.id}`);
      await phone.waitForText("Uloženo");
      for (const question of required()) await answer(phone, question.label, "Vyhovuje");
      await sleep(300);
      await phone.waitForText("Uloženo");
      await phone.clickText("Hotovo", "button");
    }
    await phone.waitForText("Zkontrolováno 2 z 2");
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("Podpis zákazníka");
    await drawSignature(phone, 'canvas[aria-label="Podpis zákazníka"]');
    await phone.type("#signerName", "Jana Malá");
    await phone.clickText("Dokončit revizi", "button");
    await phone.waitForText("Revize dokončena.");
    await phone.waitForText(`${year}-0001`);
    await phone.screenshot(`${OUT}/p18-01-completed.png`);

    const [protocol] = await selectRows(
      "protocols",
      `organization_id=eq.${org}&select=version,active,number_format`,
    );
    if (protocol.version !== 1 || !protocol.active)
      throw new Error(`first version: ${JSON.stringify(protocol)}`);
    const [inspection] = await selectRows(
      "inspections",
      `organization_id=eq.${org}&select=customer_signature_path,customer_signer_name`,
    );
    if (!inspection.customer_signature_path || inspection.customer_signer_name !== "Jana Malá")
      throw new Error(`signature not recorded: ${JSON.stringify(inspection)}`);
  });

  await step("the office reopens the inspection to fix a mistake", async () => {
    await office.goto(`${APP}${inspectionUrl}`);
    await office.waitForText("Opravit revizi");
    await office.clickText("Opravit revizi", "button");
    await office.waitForText("Opravit dokončenou revizi");
    await office.type('textarea[aria-label="Důvod opravy"]', "Zařízení 1 ve skutečnosti nevyhovuje");
    await office.clickText("Otevřít k opravě", "button");
    await office.waitForText("Revize je znovu otevřená k opravě.");
    await office.waitForUrl(inspectionUrl);
    // The inspection is open again as a correction, not as a new inspection.
    await office.waitForText("Oprava dokončené revize");
    const cancel = await office.evaluate(
      `[...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Zrušit revizi")`,
    );
    if (cancel) throw new Error("a correction offers to cancel (it would delete the original)");
    await office.screenshot(`${OUT}/p18-02-reopened.png`);
  });

  await step("redoing one check and completing again makes a new protocol version", async () => {
    await office.goto(`${APP}${inspectionUrl}/check/${devices[0].id}`);
    await office.waitForText("Uloženo");
    for (const [index, question] of required().entries())
      await answer(office, question.label, index === 0 ? "Nevyhovuje" : "Vyhovuje");
    await sleep(300);
    await office.waitForText("Uloženo");
    await office.clickText("Hotovo", "button");
    await office.goto(`${APP}${inspectionUrl}/complete`);
    await office.waitForText("Toto je oprava dokončené revize.");
    // The customer isn't there for the correction: no new signature is drawn.
    await office.clickText("Dokončit revizi", "button");
    await office.waitForText("Revize dokončena. Vznikla 1 závada.");
    await office.waitForText(`${year}-0001`);
    await office.waitForText("verze 2");
    await office.waitForText("Předchozí verze");
    await office.screenshot(`${OUT}/p18-03-corrected.png`);

    const [active] = await selectRows(
      "protocols",
      `organization_id=eq.${org}&active=eq.true&select=version,number,year,pdf_path`,
    );
    const [past] = await selectRows(
      "protocols",
      `organization_id=eq.${org}&active=eq.false&select=version,number,year,pdf_path,superseded_at`,
    );
    if (active.version !== 2 || active.number !== past.number || active.year !== past.year)
      throw new Error(`versions: ${JSON.stringify({ active, past })}`);
    if (!past.pdf_path || !past.superseded_at) throw new Error(`past kept: ${JSON.stringify(past)}`);
    const oldFile = await download(office, `${inspectionUrl}/protocol?version=1`);
    if (oldFile.head !== "%PDF-") throw new Error(`old version download: ${JSON.stringify(oldFile)}`);
    const [inspection] = await selectRows(
      "inspections",
      `organization_id=eq.${org}&select=customer_signer_name`,
    );
    if (inspection.customer_signer_name !== "Jana Malá")
      throw new Error("signature from the first completion should be kept");
  });

  await step("the summary report lists the building and its open defect", async () => {
    await office.goto(`${APP}/inspections/summary`);
    await office.waitForText("1 revize");
    await office.waitForText("1 otevřená závada");
    await office.waitForText("Osmnáctá 18");
    const pdf = await download(office, "/inspections/summary/pdf");
    if (pdf.head !== "%PDF-" || pdf.size < 500) throw new Error(`summary pdf: ${JSON.stringify(pdf)}`);
    await office.screenshot(`${OUT}/p18-04-summary.png`);
  });

  await step("the protocol number format can be changed in settings", async () => {
    await office.goto(`${APP}/settings`);
    await office.waitFor("#numberFormat");
    await office.selectValue("#numberFormat", "year_slash_number");
    await office.click('form:has(#numberFormat) button[type="submit"]');
    await office.waitForText("Uloženo");
    await office.goto(`${APP}/settings`);
    await office.waitFor("#numberFormat");
    const value = await office.evaluate(`document.querySelector("#numberFormat").value`);
    if (value !== "year_slash_number") throw new Error(`setting not saved: ${value}`);
  });

  await step("dark mode and English", async () => {
    await office.close();
    office = await launch({ width: 1440, height: 900, dark: true });
    await signIn(office, owner);
    await office.waitForText("Vítejte, Olga");
    await office.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await office.goto(`${APP}${inspectionUrl}`);
    await office.waitForText("Correct inspection");
    await office.waitForText("Signed by the customer");
    await office.screenshot(`${OUT}/p18-05-dark-en.png`);
    await office.goto(`${APP}/inspections/summary`);
    await office.waitForText("Summary report");
    await office.screenshot(`${OUT}/p18-06-dark-en-summary.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await phone.screenshot(`${OUT}/p18-failure.png`).catch(() => {});
  if (office) await office.screenshot(`${OUT}/p18-failure-office.png`).catch(() => {});
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

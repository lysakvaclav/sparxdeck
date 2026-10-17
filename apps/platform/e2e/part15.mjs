// Part 15 walkthrough: inspections in the field. On a phone a technician leaves a
// locked device out with a reason (a "no" answered first records no defect), marks
// one as missing and then finds and checks it after all, closes a device's open
// defect after a passed check, adds a device found on site (a duplicate serial is
// refused) and checks it; completing lists what was left out, the result shows the
// reason and the new device with its labels; a technician can't cancel the owner's
// inspection, the owner cancels one started by mistake; dark mode and English.
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

async function until(what, check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`timeout: ${what}`);
}

const SEAL = "Plomba je neporušená";

const answer = (page, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(SEAL)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);
/** Picks a reason in the "can't check" dialog (its title is the first line). */
const chooseReason = (page, reason) =>
  page.evaluate(`(() => {
    const radio = [...document.querySelectorAll("[role=dialog] [role=radio]")].find((b) => b.innerText.trim().startsWith(${JSON.stringify(reason)}));
    radio.click();
  })()`);
const text = (page) => page.evaluate(`document.querySelector("main").innerText`);
const dialogText = (page) =>
  page.evaluate(`document.querySelector("[role=dialog], [role=alertdialog]")?.innerText ?? ""`);
const noDialog = (page) =>
  until("dialogs closed", () =>
    page.evaluate(`!document.querySelector("[role=dialog], [role=alertdialog]")`),
  );

let phone = await launch({ width: 390, height: 844, mobile: true });
let office;
try {
  const owner = await createUser("field-owner");
  const tech = await createUser("field-tech");
  let org;
  let siteId;
  let locationId;
  let devices;
  let inspectionUrl;
  let inspectionId;
  let addedId;

  await step("setup: a building with three devices, one with an open defect", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Horák");
    await office.type("#displayName", "Petra Horáková");
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
    ]);
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "Bytové družstvo Lipová" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Lipová 12" },
    ]);
    siteId = site.id;
    const [location] = await insertRows("locations", [
      { organization_id: org, site_id: siteId, name: "Suterén", sort_order: 1 },
    ]);
    locationId = location.id;
    const row = () => ({
      organization_id: org,
      site_id: siteId,
      device_type_id: type.id,
      status: "active",
      attributes: {},
    });
    devices = await insertRows("devices", [row(), row(), row()]);
    devices.sort((a, b) => a.label_number - b.label_number);
    // The number is the database's (a trigger), not this placeholder.
    await insertRows("defects", [
      {
        organization_id: org,
        number: 1,
        device_id: devices[2].id,
        description: "Tlakoměr ukazuje nízký tlak",
        severity: "minor",
        created_by: owner.id,
      },
    ]);
  });

  await step("a locked device is left out with a reason; its 'no' records nothing", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 3");
    inspectionUrl = new URL(await phone.url()).pathname;
    inspectionId = inspectionUrl.split("/")[2];
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[0].id}`);
    await phone.waitForText("Uloženo");
    // Shown on touch screens only (the emulated phone has a mouse): it's in the page.
    if (
      !(await phone.evaluate(
        `document.querySelector("main").textContent.includes("Poznámku můžete nadiktovat")`,
      ))
    )
      throw new Error("no dictation hint");
    await answer(phone, "Nevyhovuje");
    await phone.waitForText("Uloženo");
    await phone.clickText("Nelze zkontrolovat", "button");
    await phone.waitForText("Proč zařízení nejde zkontrolovat?");
    const submit = () =>
      phone.evaluate(
        `[...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.trim() === "Označit a pokračovat").disabled`,
      );
    if (!(await submit())) throw new Error("submit enabled without a reason");
    await chooseReason(phone, "Nepřístupné");
    await phone.type("#skip-note", "Byt 12 zamčený, nájemník nebyl doma");
    await phone.screenshot(`${OUT}/p15-01-skip.png`);
    await phone.clickText("Označit a pokračovat", "button");
    await phone.waitForText("0001: Nepřístupné");
    await phone.waitForText("Zkontrolováno 1 z 3");
    await phone.waitForText("1 × vynecháno");
    await phone.screenshot(`${OUT}/p15-02-run.png`);
    const [item] = await selectRows(
      "inspection_items",
      `inspection_id=eq.${inspectionId}&device_id=eq.${devices[0].id}&select=outcome,skip_reason,notes,editing_by`,
    );
    if (
      item.outcome !== "not_checked" ||
      item.skip_reason !== "inaccessible" ||
      item.notes !== "Byt 12 zamčený, nájemník nebyl doma" ||
      item.editing_by !== null
    )
      throw new Error(`skipped item ${JSON.stringify(item)}`);
  });

  await step("a device marked missing is found and checked after all", async () => {
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[1].id}`);
    await phone.waitForText("Uloženo");
    await phone.clickText("Nelze zkontrolovat", "button");
    await chooseReason(phone, "Nenalezeno");
    await phone.clickText("Označit a pokračovat", "button");
    await phone.waitForText("0002: Nenalezeno");
    await phone.waitForText("2 × vynecháno");
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[1].id}`);
    await phone.waitForText("Označeno: Nenalezeno");
    await phone.waitForText("Když zařízení přesto zkontrolujete, označení se zruší.");
    await answer(phone, "Vyhovuje");
    await phone.waitForText("Uloženo");
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0002: vyhovuje.");
    await phone.waitForText("Zkontrolováno 2 z 3");
    await phone.waitForText("1 × vynecháno");
    const [item] = await selectRows(
      "inspection_items",
      `inspection_id=eq.${inspectionId}&device_id=eq.${devices[1].id}&select=outcome,skip_reason`,
    );
    if (item.outcome !== "passed" || item.skip_reason !== null)
      throw new Error(`found item ${JSON.stringify(item)}`);
  });

  await step("a passed check offers to close the device's open defect", async () => {
    await phone.goto(`${APP}${inspectionUrl}/check/${devices[2].id}`);
    await phone.waitForText("Otevřené závady zařízení");
    await answer(phone, "Vyhovuje");
    await phone.waitForText("Uloženo");
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("Kontrola vyhověla");
    const body = await dialogText(phone);
    if (!body.includes("Z-0001") || !body.includes("Tlakoměr ukazuje nízký tlak"))
      throw new Error(`resolve dialog: ${body}`);
    const note = await phone.evaluate(`document.querySelector("#resolve-note").value`);
    if (!note.startsWith("Odstraněno, ověřeno při revizi")) throw new Error(`note ${note}`);
    await phone.screenshot(`${OUT}/p15-03-resolve.png`);
    await phone.clickText("Uzavřít vybrané", "button");
    await phone.waitForText("1 závada uzavřena.");
    await phone.waitForText("Zkontrolováno 3 z 3");
    const [defect] = await selectRows(
      "defects",
      `organization_id=eq.${org}&select=status,resolved_by,resolution_note`,
    );
    if (
      defect.status !== "resolved" ||
      defect.resolved_by !== tech.id ||
      defect.resolution_note !== note
    )
      throw new Error(`defect ${JSON.stringify(defect)}`);
  });

  await step("a device found on site is added (not twice) and checked at once", async () => {
    await phone.clickText("Přidat zařízení", "button");
    await phone.waitForText("Přidat nalezené zařízení");
    await phone.selectValue("#add-location", locationId);
    await phone.type("#add-serial", "NAL-77");
    await phone.screenshot(`${OUT}/p15-04-add.png`);
    await phone.clickText("Přidat a zkontrolovat", "button");
    await phone.waitForText("Zařízení 0004 přidáno.");
    await phone.waitForUrl("/check/");
    await phone.waitForText("Uloženo");
    addedId = new URL(await phone.url()).pathname.split("/").pop();
    const [added] = await selectRows(
      "devices",
      `id=eq.${addedId}&select=label_number,site_id,location_id,serial_number,added_in_inspection,created_by`,
    );
    if (
      added.label_number !== 4 ||
      added.site_id !== siteId ||
      added.location_id !== locationId ||
      added.serial_number !== "NAL-77" ||
      added.added_in_inspection !== inspectionId ||
      added.created_by !== tech.id
    )
      throw new Error(`added ${JSON.stringify(added)}`);
    await answer(phone, "Vyhovuje");
    await phone.waitForText("Uloženo");
    await phone.clickText("Hotovo", "button");
    await phone.waitForText("0004: vyhovuje.");
    await phone.waitForText("Zkontrolováno 4 z 4");

    // The same serial number again: the device is already there.
    await phone.clickText("Přidat zařízení", "button");
    await phone.type("#add-serial", "nal-77");
    await phone.clickText("Přidat a zkontrolovat", "button");
    await phone.waitForText("Zařízení s tímto výrobním číslem už v budově je.");
    await phone.clickText("Zrušit", "button");
    await noDialog(phone);
    const rows = await selectRows("devices", `site_id=eq.${siteId}&select=id`);
    if (rows.length !== 4) throw new Error(`devices ${rows.length}`);
  });

  await step(
    "completing lists what was left out; the result shows the reason and labels",
    async () => {
      await phone.clickText("Dokončit revizi", "a");
      await phone.waitForText("Vynechaná zařízení");
      const summary = await text(phone);
      if (!summary.includes("Nepřístupné") || !summary.includes("Termín se jim neposune"))
        throw new Error("skipped list without the reason");
      await phone.screenshot(`${OUT}/p15-05-complete.png`);
      await phone.clickText("Dokončit revizi", "button");
      await phone.waitForText("Revize dokončena.");
      await phone.waitForText("Přidáno při revizi");
      const result = await text(phone);
      if (!result.includes("Nepřístupné") || !result.includes("Byt 12 zamčený"))
        throw new Error("result without the reason and note");
      await phone.screenshot(`${OUT}/p15-06-result.png`);
      // The "no" of the device left out made no defect; its date didn't move.
      const defects = await selectRows("defects", `organization_id=eq.${org}&select=number`);
      if (defects.length !== 1) throw new Error(`defects ${defects.length}`);
      const [left] = await selectRows(
        "devices",
        `id=eq.${devices[0].id}&select=last_inspection_on`,
      );
      if (left.last_inspection_on !== null) throw new Error("date moved for the device left out");
      const [protocol] = await selectRows(
        "protocols",
        `inspection_id=eq.${inspectionId}&select=number`,
      );
      if (!protocol) throw new Error("no protocol");

      await office.goto(`${APP}${inspectionUrl}`);
      await office.waitForText("Přidáno při revizi");
      await office.clickText("Tisk štítků", "a");
      await office.waitForUrl("/devices/labels");
      await office.waitForText("Vybráno 1 z 4");
      await office.screenshot(`${OUT}/p15-07-labels.png`);
    },
  );

  await step("a technician can't cancel the owner's inspection; the owner can", async () => {
    await office.goto(`${APP}/sites/${siteId}`);
    await office.clickText("Zahájit revizi");
    await office.waitForText("Zkontrolováno 0 z 4");
    const mistaken = new URL(await office.url()).pathname;
    await office.waitForText("Zrušit revizi");
    await phone.goto(`${APP}${mistaken}`);
    await phone.waitForText("Zkontrolováno 0 z 4");
    if ((await text(phone)).includes("Zrušit revizi"))
      throw new Error("technician offered to cancel");
    await office.clickText("Zrušit revizi", "button");
    await office.waitForText("Rozdělané kontroly, odpovědi a fotky této revize se smažou.");
    await office.screenshot(`${OUT}/p15-08-cancel.png`);
    await office.clickText("Zrušit revizi", "button");
    await office.waitForText("Revize je zrušená.");
    await office.waitForUrl(`/sites/${siteId}`);
    const left = await selectRows("inspections", `id=eq.${mistaken.split("/")[2]}&select=id`);
    if (left.length !== 0) throw new Error("inspection not cancelled");
    // The device found in the completed inspection stays where it was.
    const [kept] = await selectRows("devices", `id=eq.${addedId}&select=added_in_inspection`);
    if (kept.added_in_inspection !== inspectionId) throw new Error("added device changed");
  });
  await step("dark mode and English on the phone", async () => {
    await phone.close();
    phone = await launch({ width: 390, height: 844, mobile: true, dark: true });
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await phone.goto(`${APP}${inspectionUrl}`);
    await phone.waitForText("Added during the inspection");
    await phone.waitForText("Inaccessible");
    await phone.screenshot(`${OUT}/p15-09-dark-en-result.png`);
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Start inspection");
    await phone.waitForText("Checked 0 of 4");
    const run = new URL(await phone.url()).pathname;
    await phone.goto(`${APP}${run}/check/${devices[0].id}`);
    await phone.waitForText("Saved");
    await phone.clickText("Can't check", "button");
    await phone.waitForText("Why can't the device be checked?");
    await chooseReason(phone, "Inaccessible");
    await phone.screenshot(`${OUT}/p15-10-dark-en-skip.png`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await phone.screenshot(`${OUT}/p15-failure.png`);
  if (office) await office.screenshot(`${OUT}/p15-failure-office.png`);
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

// Part 22 walkthrough (stage D): managing protocol templates. A template
// from a sample is published with a note, changed and published again; the
// history compares the versions and restores the first as the draft; a
// draft with an unknown variable can't be published; the template is
// assigned to a customer and that customer's next protocol uses it; it
// becomes the default, the old default is archived and restored; it goes to
// a file and comes back as an import; a copy; a technician sees no actions.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
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

async function until(what, check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error(`timeout: ${what}`);
}

/** JSON with keys in order (the database keeps its own order of keys). */
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const templateRow = async (id) =>
  (await selectRows("protocol_templates", `id=eq.${id}&select=status,is_default,draft,current_version_id`))[0];
/** Clicks the menu item of a template's row in the list. */
async function rowAction(page, name, label) {
  await page.click(`button[aria-label="Akce pro šablonu ${name}"]`);
  await page.clickText(label, "[role=menuitem]");
}

const page = await launch({ width: 1440, height: 900 });
let org;
let owner;
let templateId;
let defaultId;
let site;
let device;
let customerA;
try {
  owner = await createUser("part22d-owner");
  const tech = await createUser("part22d-tech");

  await step("setup: company, two customers, a building with a device", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Správa");
    await page.type("#displayName", "Sára Správcová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Sára", 30000);
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    [customerA] = await insertRows("customers", [
      { organization_id: org, name: "SVJ Akátová" },
      { organization_id: org, name: "SVJ Borová" },
    ]);
    [site] = await insertRows("sites", [{ organization_id: org, customer_id: customerA.id, name: "Akátová 1" }]);
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    [device] = await insertRows("devices", [
      { organization_id: org, site_id: site.id, device_type_id: type.id, serial_number: "SP-1", attributes: {} },
    ]);
    [{ id: defaultId }] = await selectRows("protocol_templates", `organization_id=eq.${org}&is_default=eq.true&select=id`);
  });

  await step("a template from the detailed sample, published with a note", async () => {
    await page.goto(`${APP}/protocol-templates`);
    await page.clickText("Nová šablona", "button");
    await page.waitFor("#new-template-name");
    await page.type("#new-template-name", "Firemní podrobný");
    await page.selectValue("#new-template-from", "sample:detailed");
    await page.clickText("Vytvořit a upravit", "button");
    await page.waitForUrl("/protocol-templates/", 20000);
    templateId = new URL(await page.url()).pathname.split("/").pop();
    await page.waitForText("Bloky");
    const draft = (await templateRow(templateId)).draft;
    if (!draft.blocks.some((block) => block.type === "gallery")) throw new Error("not the detailed sample");
    await page.clickText("Publikovat", "button");
    await page.waitFor("#publish-note");
    const disabled = await page.evaluate(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.innerText.trim() === "Publikovat verzi").disabled`);
    if (!disabled) throw new Error("publishing without a note");
    await page.type("#publish-note", "První verze podle ukázky");
    await page.clickText("Publikovat verzi", "button");
    await page.waitForText("Publikováno jako verze 1.", 20000);
    await until("published", async () => {
      const row = await templateRow(templateId);
      return row.status === "published" && row.draft === null && row.current_version_id;
    });
    await page.screenshot(`${OUT}/p22d-01-published.png`);
  });

  await step("a change published as version 2; the history compares and restores", async () => {
    // The editor starts over from the published version.
    await page.waitForText("Beze změn", 20000);
    await page.waitFor("#page-orientation");
    await page.selectValue("#page-orientation", "landscape");
    await page.waitForText("Koncept uložen", 20000);
    await page.clickText("Publikovat", "button");
    await page.waitFor("#publish-note");
    await page.type("#publish-note", "Na šířku");
    await page.clickText("Publikovat verzi", "button");
    await page.waitForText("Publikováno jako verze 2.", 20000);
    await page.waitForText("Beze změn", 20000);
    await page.clickText("Historie", "button");
    await page.waitForText("Publikované verze");
    await page.waitForText("Na šířku");
    await page.waitForText("První verze podle ukázky");
    await page.waitForText("Změněna stránka (orientace, okraje)");
    await page.waitForText("Publikována verze 2");
    await page.screenshot(`${OUT}/p22d-02-history.png`);
    await page.click('button[aria-label="Obnovit verzi 1 jako koncept"]');
    await page.waitForText("Obnovit verzi 1 jako koncept?");
    await page.clickText("Obnovit jako koncept", "[role=alertdialog] button");
    await until("version 1 as the draft", async () => (await templateRow(templateId)).draft?.page?.orientation === "portrait");
    await page.waitForText("Verze 1 je teď koncept.");
  });

  await step("a draft with an unknown variable can't be published", async () => {
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitFor("#page-orientation");
    await page.click('li[data-block="notes"] [data-select]');
    await page.type("#notes-title", "Poznámka {{revize.nic}}");
    await page.waitForText("Neznámá proměnná {{revize.nic}}");
    await page.clickText("Publikovat", "button");
    await page.waitForText("Šablonu zatím nejde publikovat. Opravte:");
    await page.screenshot(`${OUT}/p22d-03-blocked.png`);
    await page.clickText("Zavřít", "[role=dialog] button");
    await until("the dialog closed", () => page.evaluate(`!document.querySelector("[role=dialog]")`));
    await sleep(300);
    await page.clickText("Zahodit koncept", "button");
    await page.clickText("Zahodit koncept", "[role=alertdialog] button");
    await until("no draft", async () => (await templateRow(templateId)).draft === null);
  });

  await step("assigned to a customer: their next protocol uses it", async () => {
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitFor("#page-orientation");
    await page.clickText("Přiřadit", "button");
    await page.waitForText("Pro koho šablona platí");
    await page.click(`#assign-customer-${customerA.id}`);
    await page.clickText("Uložit přiřazení", "button");
    await page.waitForText("Přiřazení uloženo.");
    const [assignment] = await selectRows("protocol_template_assignments", `customer_id=eq.${customerA.id}&select=template_id`);
    if (assignment?.template_id !== templateId) throw new Error("not assigned");
    // An inspection of that customer's building, completed by the owner.
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email: owner.email, password });
    const { data: inspection } = await client.rpc("start_inspection", { p_site: site.id });
    const { data: opened } = await client.rpc("open_device_check", { p_inspection: inspection, p_device: device.id });
    await client.rpc("skip_device_check", { p_item: opened.item, p_reason: "inaccessible" });
    const { error } = await client.rpc("complete_inspection", { p_inspection: inspection });
    if (error) throw error;
    const [protocol] = await selectRows("protocols", `inspection_id=eq.${inspection}&select=template_version_id`);
    const { current_version_id: current } = await templateRow(templateId);
    if (protocol.template_version_id !== current) throw new Error("the protocol didn't use the customer's template");
  });

  await step("the list: make it the default, archive and restore the old one", async () => {
    await page.goto(`${APP}/protocol-templates`);
    await page.waitForText("Firemní podrobný");
    await page.waitForText("Zákazníci: 1, typy zařízení: 0");
    await rowAction(page, "Firemní podrobný", "Nastavit jako výchozí");
    await until("the new default", async () => (await templateRow(templateId)).is_default && !(await templateRow(defaultId)).is_default);
    await page.waitForText("Šablona Firemní podrobný je teď výchozí.");
    await page.goto(`${APP}/protocol-templates`);
    await page.waitForText("Firemní podrobný");
    await rowAction(page, "Výchozí protokol", "Archivovat");
    await page.waitForText("Archivovat šablonu Výchozí protokol?");
    await page.clickText("Archivovat", "[role=alertdialog] button");
    await until("archived", async () => (await templateRow(defaultId)).status === "archived");
    await page.waitForText("Archivovaná");
    await page.screenshot(`${OUT}/p22d-04-list.png`);
    await rowAction(page, "Výchozí protokol", "Obnovit z archivu");
    await until("restored", async () => (await templateRow(defaultId)).status === "published");
  });

  await step("export to a file, import it back as a new draft", async () => {
    const json = await page.evaluate(`fetch("/protocol-templates/${templateId}/export").then((r) => r.text())`);
    const file = JSON.parse(json);
    if (file.format !== "sparxdeck-protocol-template" || file.name !== "Firemní podrobný") throw new Error(`export: ${json.slice(0, 200)}`);
    const saved = path.resolve(OUT, "p22d-template.json");
    fs.writeFileSync(saved, json);
    await page.clickText("Importovat", "button");
    await page.waitFor("#import-template-file");
    await page.setFile("#import-template-file", saved);
    await page.type("#import-template-name", "Importovaná");
    await page.clickText("Importovat", "[role=dialog] button");
    await page.waitForUrl("/protocol-templates/", 20000);
    const importedId = new URL(await page.url()).pathname.split("/").pop();
    if (importedId === templateId) throw new Error("no new template");
    const row = await templateRow(importedId);
    if (row.status !== "draft" || canonical(row.draft) !== canonical(file.template)) throw new Error("import differs from the file");
    const events = await selectRows("protocol_template_events", `template_id=eq.${importedId}&select=kind`);
    if (!events.some((event) => event.kind === "imported")) throw new Error("no import in the history");
  });

  await step("a copy from the list opens as a draft", async () => {
    await page.goto(`${APP}/protocol-templates`);
    await rowAction(page, "Firemní podrobný", "Kopírovat");
    await page.waitForText("Název kopie");
    await page.clickText("Kopírovat a upravit", "button");
    await page.waitForUrl("/protocol-templates/", 20000);
    const copyId = new URL(await page.url()).pathname.split("/").pop();
    const row = await templateRow(copyId);
    if (copyId === templateId || row.status !== "draft") throw new Error("no copy");
  });

  await step("a technician sees templates, no actions", async () => {
    const other = await launch({ width: 1280, height: 800 });
    try {
      await signIn(other, tech);
      await other.waitForText("Vítejte, Tomáš");
      await other.goto(`${APP}/protocol-templates`);
      await other.waitForText("Firemní podrobný");
      const menus = await other.evaluate(`document.querySelectorAll('button[aria-label^="Akce pro šablonu"]').length`);
      if (menus !== 0) throw new Error("a technician gets template actions");
      const status = await other.evaluate(`fetch("/protocol-templates/${templateId}/export").then((r) => r.status)`);
      if (status !== 404) throw new Error(`technician export: ${status}`);
    } finally {
      await other.close();
    }
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitForText("Publish", 30000);
    await page.clickText("History", "button");
    await page.waitForText("Published versions");
    await sleep(800);
    await page.screenshot(`${OUT}/p22d-05-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p22d-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

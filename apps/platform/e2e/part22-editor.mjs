// Part 22 walkthrough (stage B): the protocol template editor. The list of
// templates (read-only for a technician); a new template opens in the editor
// with a live preview; a text block is added and written; blocks move by
// keyboard and by button; a block is hidden, undone and redone; the draft is
// saved and survives a reload; the preview shows a real inspection; a draft of
// the published default is discarded; the phone shows the preview and texts;
// dark mode and English.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import { createClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

const KEYS = {
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  z: { key: "z", code: "KeyZ", keyCode: 90 },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
};
/** A key press as the keyboard sends it (2 = Ctrl, 8 = Shift, 1 = Alt). */
async function press(page, name, modifiers = 0) {
  const key = KEYS[name];
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    modifiers,
    key: key.key,
    code: key.code,
    windowsVirtualKeyCode: key.keyCode,
    ...(key.text && !modifiers ? { text: key.text } : {}),
  });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    modifiers,
    key: key.key,
    code: key.code,
    windowsVirtualKeyCode: key.keyCode,
  });
  await sleep(250);
}

/** Every text of a PDF, as one string. */
async function pdfText(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const document = await task.promise;
  const words = [];
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent();
    words.push(...content.items.map((item) => item.str));
  }
  await task.destroy();
  return words.join(" ");
}

/** The order of blocks in the editor's list. */
const blockOrder = (page) =>
  page.evaluate(`[...document.querySelectorAll("li[data-block]")].map((li) => li.dataset.block)`);
const draftOf = async (id) =>
  (await selectRows("protocol_templates", `id=eq.${id}&select=draft,status,current_version_id`))[0];
/** The preview has drawn its pages. */
const previewReady = (page) =>
  until("the preview", () =>
    page.evaluate(
      `!!document.querySelector('img[alt^="Náhled protokolu"], img[alt^="Protocol preview"]') && !document.body.innerText.includes("Kreslím náhled") && !document.body.innerText.includes("Drawing the preview")`,
    ),
  60000);

const page = await launch({ width: 1440, height: 900 });
let tech;
let org;
let templateId;
try {
  const owner = await createUser("part22b-owner");
  tech = await createUser("part22b-tech");

  await step("setup: company, a completed inspection with a protocol", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Editor");
    await page.type("#displayName", "Eva Editorová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Eva", 30000);
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    const [customer] = await insertRows("customers", [{ organization_id: org, name: "SVJ Editorová" }]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Editorová 5" },
    ]);
    const [device] = await insertRows("devices", [
      { organization_id: org, site_id: site.id, device_type_id: type.id, serial_number: "ED-1", attributes: {} },
    ]);
    // The owner completes an inspection through the database functions.
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email: owner.email, password });
    if (signInError) throw signInError;
    const { data: inspection } = await client.rpc("start_inspection", { p_site: site.id });
    const { data: opened } = await client.rpc("open_device_check", { p_inspection: inspection, p_device: device.id });
    await client.rpc("skip_device_check", { p_item: opened.item, p_reason: "inaccessible" });
    const { error } = await client.rpc("complete_inspection", { p_inspection: inspection });
    if (error) throw error;
  });

  await step("the list shows the default template; the owner creates a new one", async () => {
    await page.goto(`${APP}/protocol-templates`);
    await page.waitForText("Šablony protokolů");
    await page.waitForText("Výchozí protokol");
    await page.waitForText("Publikovaná");
    await page.screenshot(`${OUT}/p22b-01-list.png`);
    await page.clickText("Nová šablona", "button");
    await page.waitFor("#new-template-name");
    await page.type("#new-template-name", "Stručný protokol");
    await page.clickText("Vytvořit a upravit", "button");
    await page.waitForUrl("/protocol-templates/", 20000);
    templateId = new URL(await page.url()).pathname.split("/").pop();
    await page.waitForText("Bloky");
    await previewReady(page);
    const row = await draftOf(templateId);
    if (row.status !== "draft" || row.draft?.blocks?.length !== 6) throw new Error(`new template: ${JSON.stringify(row)}`);
    await page.screenshot(`${OUT}/p22b-02-editor.png`);
  });

  await step("a text block is added after the selected block and written", async () => {
    await page.click('li[data-block="devices"] [data-select]');
    await page.clickText("Přidat blok", "button");
    await page.clickText("Text", "[role=menuitem]");
    await until("the new block", async () => (await blockOrder(page)).join() === "header,parties,devices,text,defects,notes,signatures");
    await page.type("#text-title", "Použitá měřidla");
    await page.type("#text-content", "Tlakoměr T-12, kalibrace platná do 31. 12. 2027.");
    // Typed letter by letter, a space at the end of the line stays in the field.
    await page.send("Input.insertText", { text: " " });
    await page.send("Input.insertText", { text: "V" });
    // The formatted text editor (stage C) is an editable element, not a textarea.
    const typed = await page.evaluate(`document.querySelector("#text-content").innerText.trim()`);
    if (!typed.endsWith("2027. V")) throw new Error(`typed text: ${JSON.stringify(typed)}`);
    await until("the text saved", async () =>
      JSON.stringify((await draftOf(templateId)).draft.blocks.find((block) => block.id === "text")?.content ?? "").includes("2027. V"),
    );
    await page.waitForText("Koncept uložen", 20000);
    const { draft } = await draftOf(templateId);
    const text = draft.blocks.find((block) => block.id === "text");
    if (text?.title !== "Použitá měřidla" || !JSON.stringify(text.content).includes("T-12"))
      throw new Error(`text block: ${JSON.stringify(text)}`);
    // The preview is drawn by the server from the same template.
    const pdf = await page.evaluate(`(async () => {
      const response = await fetch("/protocol-templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: ${JSON.stringify(draft)}, inspection: null }) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    })()`);
    const words = await pdfText(Buffer.from(pdf, "base64"));
    if (!words.includes("Použitá měřidla") || !words.includes("T-12")) throw new Error(`preview text: ${words.slice(0, 400)}`);
    await previewReady(page);
    await page.screenshot(`${OUT}/p22b-03-text-block.png`);
  });

  await step("blocks move by keyboard (handle, space, arrow, space) and by button", async () => {
    await page.evaluate(`document.querySelector('li[data-block="defects"] button[aria-label^="Přesunout blok"]').focus()`);
    await press(page, "Space");
    await press(page, "ArrowUp");
    await press(page, "Space");
    await until("moved by keyboard", async () => (await blockOrder(page)).join() === "header,parties,devices,defects,text,notes,signatures");
    await page.click('li[data-block="notes"] [data-select]');
    await page.click('button[aria-label="Posunout Poznámka k revizi nahoru"]');
    await until("moved by button", async () => (await blockOrder(page)).join() === "header,parties,devices,defects,notes,text,signatures");
  });

  await step("hiding a block, undo and redo", async () => {
    await page.click('button[aria-label="Skrýt Poznámka k revizi"]');
    await until("hidden", () => page.evaluate(`document.querySelector('li[data-block="notes"]').innerText.includes("skrytý")`));
    await page.evaluate(`document.activeElement?.blur()`);
    await press(page, "z", 2);
    await until("undone", () => page.evaluate(`!document.querySelector('li[data-block="notes"]').innerText.includes("skrytý")`));
    await press(page, "z", 2 | 8);
    await until("redone", () => page.evaluate(`document.querySelector('li[data-block="notes"]').innerText.includes("skrytý")`));
    await page.waitForText("Koncept uložen", 20000);
    const { draft } = await draftOf(templateId);
    if (!draft.blocks.find((block) => block.id === "notes")?.hidden) throw new Error("hidden not saved");
  });

  await step("the draft survives a reload; the header can't be removed", async () => {
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitForText("Bloky");
    const order = await blockOrder(page);
    if (order.join() !== "header,parties,devices,defects,notes,text,signatures") throw new Error(`after reload: ${order}`);
    await page.click('li[data-block="header"] [data-select]');
    const removable = await page.evaluate(`!!document.querySelector('button[aria-label="Odebrat Záhlaví"]')`);
    if (removable) throw new Error("the header offers to be removed");
    await page.waitForText("Číslo protokolu a název firmy jsou v záhlaví vždy.");
  });

  await step("the preview with a real inspection", async () => {
    const value = await page.evaluate(`document.querySelector("#preview-source option:nth-child(2)")?.value`);
    if (!value) throw new Error("no inspection to preview");
    await page.selectValue("#preview-source", value);
    await previewReady(page);
    await page.waitForText("1 strana");
    await page.screenshot(`${OUT}/p22b-04-real-data.png`);
  });

  await step("a draft of the published default is discarded", async () => {
    const [template] = await selectRows(
      "protocol_templates",
      `organization_id=eq.${org}&is_default=eq.true&select=id`,
    );
    await page.goto(`${APP}/protocol-templates/${template.id}`);
    await page.waitFor("#page-orientation");
    await page.selectValue("#page-orientation", "landscape");
    await page.waitForText("Koncept uložen", 20000);
    if (!(await draftOf(template.id)).draft) throw new Error("no draft");
    await page.clickText("Zahodit koncept", "button");
    await page.waitForText("Zahodit koncept?");
    await page.clickText("Zahodit koncept", "[role=alertdialog] button");
    await until("discarded", async () => (await draftOf(template.id)).draft === null);
    await page.waitForText("Beze změn", 20000);
  });

  await step("a technician sees the list, not the editor", async () => {
    const other = await launch({ width: 1280, height: 800 });
    try {
      await signIn(other, tech);
      await other.waitForText("Vítejte, Tomáš");
      await other.goto(`${APP}/protocol-templates`);
      await other.waitForText("Technik je jen používá.");
      const links = await other.evaluate(`document.querySelectorAll('a[href^="/protocol-templates/"]').length`);
      if (links !== 0) throw new Error("a technician gets links to the editor");
      await other.goto(`${APP}/protocol-templates/${templateId}`);
      await other.waitForUrl("/protocol-templates");
      const status = await other.evaluate(`fetch("/protocol-templates/preview", { method: "POST", body: "{}" }).then((r) => r.status)`);
      if (status !== 404) throw new Error(`technician preview: ${status}`);
    } finally {
      await other.close();
    }
  });

  await step("on a phone: the preview and the texts", async () => {
    await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitForText("Rozložení bloků upravíte na počítači.");
    await previewReady(page);
    await page.screenshot(`${OUT}/p22b-05-phone-preview.png`);
    await page.clickText("Texty", "button");
    await page.type("#m-devices-title", "Hasicí přístroje");
    await page.waitForText("Koncept uložen", 20000);
    const { draft } = await draftOf(templateId);
    if (draft.blocks.find((block) => block.id === "devices")?.title !== "Hasicí přístroje") throw new Error("phone edit not saved");
    await page.screenshot(`${OUT}/p22b-06-phone-texts.png`);
    await page.send("Emulation.clearDeviceMetricsOverride");
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitForText("Blocks", 30000);
    await page.waitForText("Page and footer");
    await previewReady(page);
    await page.screenshot(`${OUT}/p22b-07-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p22b-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

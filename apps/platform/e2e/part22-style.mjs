// Part 22 walkthrough (stage C): the look and the words of a protocol
// template. The page panel (font, company colour with its contrast check,
// table grid and zebra rows, date format, language); a formatted text with a
// variable from the menu; an unknown variable reported; a block shown only
// with defects; the template's own logo from an SVG that is cleaned and stored
// as a PNG; the preview PDF with all of it.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  cleanup,
  createUser,
  downloadFile,
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

async function until(what, check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error(`timeout: ${what}`);
}

const draftOf = async (id) =>
  (await selectRows("protocol_templates", `id=eq.${id}&select=draft`))[0].draft;
const block = (draft, id) => draft.blocks.find((item) => item.id === id);
/** Sets a field the way typing would (React sees the change). */
const setValue = (page, selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);

async function previewPdf(page, template) {
  const base64 = await page.evaluate(`(async () => {
    const response = await fetch("/protocol-templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: ${JSON.stringify(template)}, inspection: null }) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  })()`);
  return Buffer.from(base64, "base64");
}
async function pdfWords(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const document = await task.promise;
  const words = [];
  for (let n = 1; n <= document.numPages; n++)
    words.push(...(await (await document.getPage(n)).getTextContent()).items.map((item) => item.str));
  await task.destroy();
  return words.join(" ");
}

const EVIL_SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" onload="alert(1)">
  <script>alert(document.cookie)</script>
  <image href="https://evil.example/track.png" width="10" height="10"/>
  <rect width="240" height="80" rx="8" fill="#1d4f91"/>
  <text x="20" y="52" font-size="32" fill="#ffffff">Logo</text>
</svg>`;

const page = await launch({ width: 1440, height: 900 });
let org;
let templateId;
try {
  const owner = await createUser("part22c-owner");

  await step("setup: company, customer with a contact, a template to edit", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Vzhled");
    await page.type("#displayName", "Věra Vzhledová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Věra", 30000);
    org = await organizationOf(owner);
    await insertRows("customers", [{ organization_id: org, name: "SVJ Vzhledová", contact_person: "Jana Malá" }]);
    await page.goto(`${APP}/protocol-templates`);
    await page.clickText("Nová šablona", "button");
    await page.waitFor("#new-template-name");
    await page.type("#new-template-name", "Firemní protokol");
    await page.clickText("Vytvořit a upravit", "button");
    await page.waitForUrl("/protocol-templates/", 20000);
    templateId = new URL(await page.url()).pathname.split("/").pop();
    await page.waitForText("Stránka a patička");
  });

  await step("the page: serif font, company colour (a light one is refused), grid, long dates, English", async () => {
    await page.selectValue("#page-font", "noto-serif");
    await page.click("#page-accent-on");
    await page.waitFor('input[aria-label="Barva v zápisu #rrggbb"]');
    await setValue(page, 'input[aria-label="Barva v zápisu #rrggbb"]', "#ffcc00");
    await page.waitForText("špatně čitelná");
    await page.waitForText("Barva firmy je na bílém papíře špatně čitelná. Zvolte tmavší.");
    await setValue(page, 'input[aria-label="Barva v zápisu #rrggbb"]', "#1d4f91");
    await until("the warning gone", () => page.evaluate(`!document.body.innerText.includes("špatně čitelná")`));
    await page.selectValue("#page-table-borders", "grid");
    await page.click("#page-table-zebra");
    await page.selectValue("#page-date", "long");
    await page.selectValue("#page-language", "en");
    await until("the look saved", async () => {
      const draft = await draftOf(templateId);
      return (
        draft.style.font === "noto-serif" &&
        draft.style.accent === "#1d4f91" &&
        draft.style.table?.borders === "grid" &&
        draft.style.table?.zebra === true &&
        draft.format?.date === "long" &&
        draft.language === "en"
      );
    });
    await page.screenshot(`${OUT}/p22c-01-page.png`);
  });

  await step("a formatted text with a variable from the menu, shown only with defects", async () => {
    await page.click('li[data-block="devices"] [data-select]');
    await page.clickText("Přidat blok", "button");
    await page.clickText("Text", "[role=menuitem]");
    await page.waitFor("#text-content");
    await page.click("#text-content");
    // Bold on, then the words: they come out bold.
    await page.click('aside[aria-label="Vlastnosti"] button[aria-label="Tučně (Ctrl+B)"]');
    await page.send("Input.insertText", { text: "Pro zákazníka " });
    await page.click('aside[aria-label="Vlastnosti"] [role=toolbar] button[aria-label="Vložit proměnnou"]');
    await page.evaluate(`[...document.querySelectorAll("[role=menuitem]")].find((item) => item.innerText.includes("{{zakaznik.nazev}}")).setAttribute("data-e2e-variable", "1")`);
    await page.click('[data-e2e-variable="1"]');
    await sleep(300);
    await page.selectValue("#text-condition", "hasDefects");
    await until("the text saved", async () => {
      const text = block(await draftOf(templateId), "text");
      const inlines = text?.content?.[0]?.content ?? [];
      return (
        JSON.stringify(inlines).includes("{{zakaznik.nazev}}") &&
        inlines.some((inline) => inline.bold && inline.text.includes("Pro zákazníka")) &&
        text.condition?.when === "hasDefects"
      );
    });
    await page.screenshot(`${OUT}/p22c-02-text.png`);
  });

  await step("an unknown variable is reported, a known one isn't", async () => {
    await page.type("#text-title", "Pro {{zakaznik.jmeno}}");
    await page.waitForText("Neznámá proměnná {{zakaznik.jmeno}}");
    await page.type("#text-title", "Pro {{zakaznik.nazev}}");
    await until("no issue", () => page.evaluate(`!document.body.innerText.includes("Neznámá proměnná")`));
  });

  await step("the template's own logo from an SVG: cleaned and stored as a PNG", async () => {
    const file = path.resolve(OUT, "p22c-evil-logo.svg");
    fs.writeFileSync(file, EVIL_SVG);
    await page.click('li[data-block="header"] [data-select]');
    await page.selectValue("#header-logo-source", "template");
    await page.waitForText("Nahrát logo");
    await page.setFile("#header-logo-file", file);
    await page.waitFor('img[alt="Logo šablony"]', 30000);
    let logo;
    await until("the logo saved", async () => {
      logo = block(await draftOf(templateId), "header")?.logo;
      return logo?.source === "template" && typeof logo.path === "string";
    });
    if (!logo.path.startsWith(`${org}/protocol-templates/`) || !logo.path.endsWith(".png"))
      throw new Error(`logo path ${logo.path}`);
    const stored = await downloadFile("org-assets", logo.path);
    if (stored.subarray(1, 4).toString() !== "PNG") throw new Error("the stored logo isn't a PNG");
    await page.screenshot(`${OUT}/p22c-03-logo.png`);
  });

  await step("the preview PDF: English, the variable filled, the serif font, the logo", async () => {
    await page.waitForText("Koncept uložen", 20000);
    const draft = await draftOf(templateId);
    const pdf = await previewPdf(page, draft);
    const words = await pdfWords(pdf);
    for (const expected of ["Inspection report", "Pro Linden Street Housing Cooperative", "Pro zákazníka Linden Street Housing Cooperative"])
      if (!words.includes(expected)) throw new Error(`missing "${expected}" in ${words.slice(0, 600)}`);
    if (!/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/.test(words))
      throw new Error("no long English date");
    if (!pdf.includes("NotoSerif")) throw new Error("the serif font isn't embedded");
    if (!pdf.includes("/Subtype /Image")) throw new Error("no logo image");
    await page.screenshot(`${OUT}/p22c-04-preview.png`);
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/protocol-templates/${templateId}`);
    await page.waitForText("Company colour", 30000);
    await page.click('li[data-block="text"] [data-select]');
    await page.waitForText("Show the block", 15000);
    await sleep(1500);
    await page.screenshot(`${OUT}/p22c-05-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p22c-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

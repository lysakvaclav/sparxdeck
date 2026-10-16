// Part 4 walkthrough: device types and versioned checklist templates.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import { APP, addMember, cleanup, createUser, organizationOf, signIn } from "./support.mjs";

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

const page = await launch({ width: 1440, height: 1000 });
let orgId;
let typeUrl;
try {
  const owner = await createUser("types-owner");
  const tech = await createUser("types-tech");

  await step("a new company has a sample fire extinguisher type", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    orgId = await organizationOf(owner);
    await page.click('aside a[href="/device-types"]');
    await page.waitForText("Hasicí přístroj");
    await page.waitForText("12 měsíců");
    await page.waitForText("Vzorová, ověřit");
    await page.screenshot(`${OUT}/p4-01-types.png`);
  });

  await step("the type shows its sample checklist and version history", async () => {
    await page.click('main table a[href^="/device-types/"]');
    await page.waitForText("Vzorová šablona a interval");
    await page.waitForText("Plomba a pojistka jsou neporušené");
    typeUrl = await page.evaluate("location.pathname");
    const rows = await page.evaluate(`document.querySelectorAll("main table tbody tr").length`);
    if (rows !== 7) throw new Error(`items ${rows}`);
    await page.screenshot(`${OUT}/p4-02-type.png`);
  });

  await step("the interval is validated and saved", async () => {
    await page.clickText("Upravit typ");
    await page.waitFor("#interval");
    await page.type("#interval", "0");
    await page.evaluate(`document.querySelector("#interval").form.requestSubmit()`);
    await page.waitForText("Zadejte celý počet měsíců od 1 do 120.");
    await page.type("#interval", "6");
    await page.evaluate(`document.querySelector("#interval").form.requestSubmit()`);
    await page.waitForText("6 měsíců");
    if ((await page.evaluate("location.pathname")) !== typeUrl)
      throw new Error("not back on the type");
  });

  await step("editing the checklist creates version 2", async () => {
    await page.clickText("Upravit šablonu");
    await page.waitFor("#item-0-label");
    await page.type("#item-0-label", "Štítek je čitelný");
    await page.click('button[aria-label="Odebrat položku: Poznámka technika"]');
    await page.clickText("Přidat položku", "button");
    await page.waitFor("#item-6-label");
    // An empty item is explained before anything is saved.
    await page.clickText("Uložit jako verzi 2", "button");
    await page.waitForText("Vyplňte toto pole.");
    await page.type("#item-6-label", "Tlak (bar)");
    await page.selectValue("#item-6-type", "number");
    await sleep(200);
    const defectDisabled = await page.evaluate(`document.querySelector("#item-6-defect").disabled`);
    if (!defectDisabled) throw new Error("defect checkbox enabled for a number");
    await page.screenshot(`${OUT}/p4-03-editor.png`);
    await page.clickText("Uložit jako verzi 2", "button");
    await page.waitForText("Šablona uložena jako verze 2.");
    await page.waitForUrl(typeUrl);
    await page.waitForText("Štítek je čitelný");
    await page.waitForText("Tlak (bar)");
    const history = await page.evaluate(
      `[...document.querySelectorAll("main a[href*='/device-types/']")].filter((a) => a.textContent.includes("verze")).length`,
    );
    if (history < 2) throw new Error(`history ${history}`);
  });

  await step("the previous version stays readable", async () => {
    await page.goto(`${APP}${typeUrl}?version=1`);
    await page.waitForText("Zobrazujete verzi 1");
    await page.waitForText("Štítek a návod jsou čitelné");
    await page.waitForText("Poznámka technika");
    await page.screenshot(`${OUT}/p4-04-old-version.png`);
  });

  await step("a technician sees types and checklists read-only", async () => {
    await addMember(orgId, tech, "technician", "Tomáš Technik");
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, tech);
    await page.waitForText("Vítejte, Tomáš");
    await page.goto(`${APP}/device-types`);
    await page.waitForText("Typy zařízení a šablony kontrol mění vlastník nebo administrátor.");
    await page.goto(`${APP}${typeUrl}`);
    await page.waitForText("Štítek je čitelný");
    const editLinks = await page.evaluate(
      `[...document.querySelectorAll("a")].filter((a) => ["Upravit typ", "Upravit šablonu"].includes(a.textContent.trim())).length`,
    );
    if (editLinks) throw new Error("technician sees edit links");
    await page.goto(`${APP}${typeUrl}/template`);
    await page.waitForText("Štítek je čitelný");
    if ((await page.evaluate("location.pathname")) !== typeUrl)
      throw new Error("editor not redirected");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p4-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

// Part 2 walkthrough: organization settings and logo upload.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
  cleanup,
  createUser,
  organization,
  organizationOf,
  signIn,
  writeTestLogo,
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

const page = await launch({ width: 1440, height: 1000 });
let orgId;
try {
  const owner = await createUser("settings-owner");
  const tech = await createUser("settings-tech");
  const logo = writeTestLogo(OUT);

  await step("owner signs in and sets up the company", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    orgId = await organizationOf(owner);
  });

  await step("settings page shows company details", async () => {
    await page.click('a[href="/settings"]');
    await page.waitForText("Údaje o firmě");
  });

  await step("an invalid company ID is explained", async () => {
    await page.type("#companyId", "27082441");
    await page.evaluate(`document.querySelector("#companyId").form.requestSubmit()`);
    await page.waitForText("IČO není platné.");
  });

  await step("company details save", async () => {
    await page.type("#legalName", "Revize Novák s.r.o.");
    await page.type("#companyId", "27082440");
    await page.type("#vatId", "cz27082440");
    await page.type("#address", "Na Příkopě 12, 110 00 Praha 1");
    await page.type("#email", "info@revize-novak.cz");
    await page.type("#phone", "+420 777 123 456");
    await page.evaluate(`document.querySelector("#companyId").form.requestSubmit()`);
    await page.waitForText("Uloženo.");
    const org = await organization(orgId);
    if (org.vat_id !== "CZ27082440" || org.company_id !== "27082440") {
      throw new Error(`saved wrong values: ${org.vat_id} ${org.company_id}`);
    }
  });

  await step("a logo uploads and shows a preview", async () => {
    await page.setFile("#logo-input", logo);
    await page.waitForText("Logo bylo nahráno.");
    await page.waitFor('img[alt="Logo firmy Revize Novák"]');
    await sleep(800);
    const loaded = await page.evaluate(
      `document.querySelector('img[alt="Logo firmy Revize Novák"]').naturalWidth`,
    );
    if (!loaded) throw new Error("logo preview didn't load");
    if (!(await organization(orgId)).logo_path?.startsWith(`${orgId}/logo-`)) {
      throw new Error("logo_path not saved");
    }
  });

  await step("footer, language, time zone and threshold save", async () => {
    await page.type("#footer", "Zapsáno v obchodním rejstříku vedeném Městským soudem v Praze.");
    await page.selectValue("#defaultLocale", "en");
    await page.selectValue("#timezone", "Asia/Tbilisi");
    await page.type("#dueSoonDays", "0");
    // Save the deadlines form with an invalid value first.
    await page.evaluate(`document.querySelector('#dueSoonDays').form.requestSubmit()`);
    await page.waitForText("Zadejte celé číslo od 1 do 365.");
    await page.type("#dueSoonDays", "45");
    await page.evaluate(`document.querySelector('#dueSoonDays').form.requestSubmit()`);
    await page.evaluate(`document.querySelector('#timezone').form.requestSubmit()`);
    await page.evaluate(`document.querySelector('#footer').form.requestSubmit()`);
    // Three server actions run in parallel; poll until all have landed (a cold server is slow).
    let org;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      org = await organization(orgId);
      const done =
        org.due_soon_days === 45 &&
        org.timezone === "Asia/Tbilisi" &&
        org.default_locale === "en" &&
        org.protocol_footer_text?.startsWith("Zapsáno");
      if (done) break;
    }
    if (
      org.due_soon_days !== 45 ||
      org.timezone !== "Asia/Tbilisi" ||
      org.default_locale !== "en"
    ) {
      throw new Error(
        `settings not saved: ${org.due_soon_days} ${org.timezone} ${org.default_locale}`,
      );
    }
    if (!org.protocol_footer_text?.startsWith("Zapsáno")) throw new Error("footer not saved");
    await page.goto(`${APP}/settings`);
    await page.screenshot(`${OUT}/p2-01-settings.png`);
  });

  await step("removing the logo asks for confirmation", async () => {
    await page.clickText("Odstranit");
    await page.waitForText("Odstranit logo?");
    await page.screenshot(`${OUT}/p2-02-remove-logo.png`);
    await page.clickText("Odstranit", "button");
    await page.waitForText("Logo bylo odstraněno.");
    if ((await organization(orgId)).logo_path) throw new Error("logo_path still set");
  });

  await step("a technician sees settings read-only", async () => {
    await addMember(orgId, tech, "technician", "Tomáš Technik");
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, tech);
    await page.waitForText("Vítejte, Tomáš");
    await page.goto(`${APP}/settings`);
    await page.waitForText("Nastavení firmy může měnit vlastník nebo administrátor.");
    const editable = await page.evaluate(
      `[...document.querySelectorAll('fieldset')].filter(f => !f.disabled).length`,
    );
    const uploads = await page.evaluate(`document.querySelectorAll('#logo-input').length`);
    if (editable !== 0 || uploads !== 0) throw new Error(`editable=${editable} uploads=${uploads}`);
    await page.screenshot(`${OUT}/p2-03-settings-technician.png`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p2-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

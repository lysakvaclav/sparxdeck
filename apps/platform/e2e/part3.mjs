// Part 3 walkthrough: customers, sites (buildings) and locations.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import { APP, addMember, cleanup, createUser, organizationOf, signIn } from "./support.mjs";

const OUT = process.argv[2] ?? ".e2e-output";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

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

const submit = (selector) =>
  page.evaluate(`document.querySelector('${selector}').form.requestSubmit()`);
const locationNames = () =>
  page.evaluate(
    `[...document.querySelectorAll('ol > li > span.flex-1')].map((el) => el.innerText.trim())`,
  );

const page = await launch({ width: 1440, height: 1000 });
let orgId;
let siteUrl;
try {
  const owner = await createUser("customers-owner");
  const tech = await createUser("customers-tech");

  await step("owner sets up the company and sees an empty customer list", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    orgId = await organizationOf(owner);
    await page.click('aside a[href="/customers"]');
    await page.waitForText("Zatím žádní zákazníci");
    await page.screenshot(`${OUT}/p3-01-empty.png`);
  });

  await step("the customer form validates and creates a customer", async () => {
    await page.clickText("Nový zákazník");
    await page.waitForUrl("/customers/new");
    await submit("#name");
    await page.waitForText("Vyplňte toto pole.");
    await page.type("#name", "Bytové družstvo Lipová");
    await page.type("#companyId", "27082441");
    await submit("#name");
    await page.waitForText("IČO není platné.");
    await page.type("#companyId", "27082440");
    await page.type("#contactPerson", "Jana Dvořáková");
    await page.type("#email", "spravce@lipova.cz");
    await page.type("#phone", "+420 603 111 222");
    await page.type("#billingAddress", "Lipová 12, 120 00 Praha 2");
    await page.screenshot(`${OUT}/p3-02-customer-form.png`);
    await submit("#name");
    await page.waitForText("Zákazník zatím nemá žádné budovy.");
    await page.waitForText("Jana Dvořáková");
    await page.screenshot(`${OUT}/p3-03-customer.png`);
  });

  await step("a building is added with access instructions", async () => {
    await page.clickText("Přidat budovu");
    await page.waitForText("Nová budova");
    await page.type("#name", "Lipová 12, vchod A");
    await page.type("#address", "Lipová 12, 120 00 Praha 2");
    await page.type("#accessNotes", "Klíče u správce v přízemí, zvonek 14.");
    await submit("#name");
    await page.waitForText("Klíče u správce v přízemí, zvonek 14.");
    await page.waitForText("Zatím žádné lokace.");
    siteUrl = await page.evaluate("location.pathname");
  });

  await step("locations are added, reordered and the order is kept", async () => {
    for (const name of ["Suterén", "1. patro", "2. patro"]) {
      await page.type("#location-new", name);
      await submit("#location-new");
      await page.waitFor(`button[aria-label="Akce pro lokaci ${name}"]`);
      await sleep(300);
    }
    await page.click('button[aria-label="Posunout nahoru: 2. patro"]');
    await sleep(1500);
    const shown = await locationNames();
    if (shown.join("|") !== "Suterén|2. patro|1. patro") throw new Error(`order ${shown}`);
    await page.goto(`${APP}${siteUrl}`);
    await page.waitForText("Suterén");
    const saved = await locationNames();
    if (saved.join("|") !== "Suterén|2. patro|1. patro") throw new Error(`saved order ${saved}`);
    await page.screenshot(`${OUT}/p3-04-site.png`);
  });

  await step("a location is renamed and another deleted after confirmation", async () => {
    await page.click('button[aria-label="Akce pro lokaci Suterén"]');
    await page.clickText("Přejmenovat");
    await page.waitFor('li input[id^="location-"]');
    await page.type('li input[id^="location-"]', "Suterén, kotelna");
    await submit('li input[id^="location-"]');
    await page.waitFor('button[aria-label="Akce pro lokaci Suterén, kotelna"]');

    await page.click('button[aria-label="Akce pro lokaci 1. patro"]');
    await page.clickText("Smazat");
    await page.waitForText("Smazat lokaci?");
    await page.screenshot(`${OUT}/p3-05-delete-location.png`);
    await page.clickText("Smazat", "button");
    await sleep(1500);
    const names = await locationNames();
    if (names.join("|") !== "Suterén, kotelna|2. patro") throw new Error(`left ${names}`);
  });

  await step("the building is edited", async () => {
    await page.clickText("Upravit");
    await page.waitForText("Upravit budovu");
    await page.type("#name", "Lipová 12");
    await submit("#name");
    // The edit URL contains the site URL, so wait for the heading instead.
    let title;
    for (let i = 0; i < 40 && title !== "Lipová 12"; i++) {
      await sleep(250);
      title = await page.evaluate(`document.querySelector("h1")?.innerText`);
    }
    if (title !== "Lipová 12") throw new Error(`title ${title}`);
  });

  await step("the list paginates, sorts and searches", async () => {
    const rows = Array.from({ length: 22 }, (_, i) => ({
      organization_id: orgId,
      name: `Správa nemovitostí ${String(i + 1).padStart(2, "0")}`,
      contact_person: i === 6 ? "Karel Zelenka" : null,
    }));
    await fetch(`${url}/rest/v1/customers`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(rows),
    });
    await page.goto(`${APP}/customers`);
    await page.waitForText("Strana 1 z 2");
    await page.waitForText("23 výsledků");
    await page.clickText("Další");
    await page.waitForText("Strana 2 z 2");
    await page.screenshot(`${OUT}/p3-06-list-page2.png`);

    await page.type("#search", "zelenka");
    await page.waitForText("1 výsledek");
    await page.waitForText("Správa nemovitostí 07");
    if (!(await page.evaluate("location.search")).includes("q=zelenka"))
      throw new Error("q not in URL");

    await page.type("#search", "27082440");
    await page.waitForText("Bytové družstvo Lipová");
    await page.type("#search", "nic takového");
    await page.waitForText("Nic jsme nenašli");
    await page.click('button[aria-label="Vymazat hledání"]');
    await page.waitForText("23 výsledků");

    await page.clickText("Přidáno", "a");
    await page.waitForUrl("sort=newest");
    await page.screenshot(`${OUT}/p3-07-list.png`);
  });

  await step("deleting a customer asks first and removes it from the list", async () => {
    await page.goto(`${APP}/customers?q=07`);
    await page.waitForText("1 výsledek");
    await page.click('main table a[href^="/customers/"]');
    await page.waitForText("Zákazník zatím nemá žádné budovy.");
    await page.clickText("Smazat");
    await page.waitForText("Smazat zákazníka?");
    await page.clickText("Smazat", "button");
    await page.waitForUrl("/customers");
    await page.waitForText("22 výsledků");
  });

  await step("a technician sees customers and buildings read-only", async () => {
    await addMember(orgId, tech, "technician", "Tomáš Technik");
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, tech);
    await page.waitForText("Vítejte, Tomáš");
    await page.goto(`${APP}/customers`);
    await page.waitForText("Bytové družstvo Lipová");
    const newButtons = await page.evaluate(
      `[...document.querySelectorAll('a')].filter(a => a.innerText.trim() === "Nový zákazník").length`,
    );
    if (newButtons) throw new Error("technician sees 'New customer'");
    await page.goto(`${APP}${siteUrl}`);
    await page.waitForText("Klíče u správce v přízemí, zvonek 14.");
    const controls = await page.evaluate(
      `document.querySelectorAll('[aria-label^="Posunout"], #location-new, [aria-label^="Akce pro lokaci"]').length + [...document.querySelectorAll('a,button')].filter(e => ["Upravit","Smazat"].includes(e.innerText.trim())).length`,
    );
    if (controls) throw new Error(`technician sees ${controls} edit controls`);
    await page.screenshot(`${OUT}/p3-08-site-technician.png`);
    await page.goto(`${APP}/customers/new`);
    await page.waitForUrl("/customers");
    if ((await page.evaluate("location.pathname")) !== "/customers")
      throw new Error("not redirected");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p3-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

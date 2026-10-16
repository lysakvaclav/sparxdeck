// Part 10 walkthrough: the dashboard shows what is overdue and coming due in
// 30/60/90 days, building by building, narrowed to a customer or building; the
// weekly summary is previewed in Settings, can be turned off, and the Monday
// job reports what it would send (and refuses callers without the secret).
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import {
  APP,
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

const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());
const shift = (days) => {
  const date = new Date(`${todayIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** The last inspection that puts the next one on `due` (12-month interval). */
const lastFor = (due) => `${Number(due.slice(0, 4)) - 1}${due.slice(4)}`;

const text = (page) => page.evaluate(`document.querySelector("main").innerText`);
const planSites = (page) =>
  page.evaluate(
    `[...document.querySelectorAll("section[aria-labelledby=overview-title] table tbody tr td:first-child a")].map((a) => a.innerText.trim())`,
  );
const cron = (query = "", secret = process.env.CRON_SECRET) =>
  fetch(`${APP}/api/cron/weekly-summary${query}`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

const page = await launch({ width: 1440, height: 1000 });
let org;
try {
  const owner = await createUser("overview-owner");
  let customers;
  let sites;

  await step("setup: two customers, three buildings, devices due at different times", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Kučera");
    await page.type("#displayName", "Karel Kučera");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Karel");
    org = await organizationOf(owner);
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    customers = await insertRows("customers", [
      { organization_id: org, name: "Alfa Reality" },
      { organization_id: org, name: "Beta Sklady" },
    ]);
    sites = await insertRows("sites", [
      { organization_id: org, customer_id: customers[0].id, name: "Alfa Centrum" },
      { organization_id: org, customer_id: customers[0].id, name: "Alfa Park" },
      { organization_id: org, customer_id: customers[1].id, name: "Beta Hala" },
    ]);
    const device = (site, due) => ({
      organization_id: org,
      site_id: site.id,
      device_type_id: type.id,
      status: "active",
      attributes: {},
      last_inspection_on: due ? lastFor(due) : null,
    });
    const devices = await insertRows("devices", [
      device(sites[0], shift(-5)), // overdue
      device(sites[0], shift(10)),
      device(sites[1], shift(45)),
      device(sites[2], shift(80)),
      device(sites[2], shift(120)), // beyond 90 days
      device(sites[2], null), // never inspected
    ]);
    const rows = await selectRows("devices", `id=eq.${devices[0].id}&select=next_due_on`);
    if (rows[0].next_due_on !== shift(-5)) throw new Error(`due ${rows[0].next_due_on}`);
    await insertRows("defects", [
      {
        organization_id: org,
        device_id: devices[3].id,
        description: "Chybí plomba",
        severity: "critical",
        created_by: owner.id,
      },
    ]);
  });

  await step("the dashboard shows what comes due in 30, 60 and 90 days", async () => {
    await page.goto(`${APP}/`);
    await page.waitForText("Co propadá");
    await page.waitForText("Po termínu: 1 · v příštích 30 dnech: 1 · 1 budova");
    if ((await planSites(page)).join() !== "Alfa Centrum") throw new Error(await planSites(page));
    await page.screenshot(`${OUT}/p10-01-dashboard.png`);
    await page.clickText("60 dní", "a");
    await page.waitForText("Po termínu: 1 · v příštích 60 dnech: 2 · 2 budovy");
    await page.clickText("90 dní", "a");
    await page.waitForText("Po termínu: 1 · v příštích 90 dnech: 3 · 3 budovy");
    // Overdue first, then by the earliest date.
    const order = (await planSites(page)).join();
    if (order !== "Alfa Centrum,Alfa Park,Beta Hala") throw new Error(order);
    const main = await text(page);
    for (const expected of ["Po termínu\n", "Brzy\n", "V pořádku\n", "Bez revize\n"])
      if (!main.includes(expected.trim())) throw new Error(`due card misses ${expected}`);
  });

  await step("a customer or building narrows everything, including defects", async () => {
    await page.selectValue('select[aria-label="Zákazník"]', customers[1].id);
    await page.waitForText("Po termínu: 0 · v příštích 90 dnech: 1 · 1 budova");
    if ((await planSites(page)).join() !== "Beta Hala") throw new Error(await planSites(page));
    await page.waitForText("Otevřené závady (1)");
    const url = new URL(await page.url());
    if (
      url.searchParams.get("horizon") !== "90" ||
      url.searchParams.get("customer") !== customers[1].id
    )
      throw new Error(`url ${url.search}`);
    await page.screenshot(`${OUT}/p10-02-filtered.png`);
    await page.selectValue('select[aria-label="Zákazník"]', customers[0].id);
    await page.waitForText("Otevřené závady (0)");
    await page.selectValue('select[aria-label="Budova"]', sites[1].id);
    await page.waitForText("Po termínu: 0 · v příštích 90 dnech: 1 · 1 budova");
    await page.clickText("Zrušit", "button");
    await page.waitForText("Po termínu: 1 · v příštích 90 dnech: 3 · 3 budovy");
  });

  await step("the counts open the device list with the same filter", async () => {
    await page.goto(`${APP}/?horizon=30`);
    await page.waitForText("Co propadá");
    await page.click(`a[href="/devices?site=${sites[0].id}&due=30d&sort=due"]`);
    await page.waitForUrl("due=30d");
    await page.waitForText("1 výsledek");
    const chosen = await page.evaluate(
      `document.querySelector("#filter-due").selectedOptions[0].text`,
    );
    if (chosen !== "Do 30 dní") throw new Error(`filter ${chosen}`);
  });

  await step("settings preview the weekly summary and turn it off", async () => {
    await page.goto(`${APP}/settings#digest`);
    await page.waitForText("Co by dorazilo tento týden");
    await page.waitForText("Revize Kučera: 1 po termínu, 1 do 30 dní");
    await page.waitForText("Alfa Centrum (Alfa Reality): po termínu 1, brzy 1");
    await page.waitForText(owner.email);
    await page.waitForText("Odesílání e-mailů zatím není nastavené");
    await page.evaluate(`document.querySelector("#digest").scrollIntoView()`);
    await sleep(300);
    await page.screenshot(`${OUT}/p10-03-settings.png`);
    await page.click("#weeklyDigest");
    await page.evaluate(`document.querySelector("#digest form button[type=submit]").click()`);
    await page.waitForText("Uloženo.");
    const [row] = await selectRows("organizations", `id=eq.${org}&select=weekly_digest`);
    if (row.weekly_digest !== false) throw new Error("still on");
  });

  await step("the Monday job reports per company and refuses strangers", async () => {
    if ((await cron("?dry", "")).status !== 404) throw new Error("open without the secret");
    if ((await cron("?dry", "wrong")).status !== 404) throw new Error("open with a wrong secret");
    const off = await (await cron("?dry")).json();
    const mine = (body) => body.runs.find((run) => run.organization === org);
    if (mine(off)?.status !== "disabled") throw new Error(`off: ${JSON.stringify(mine(off))}`);
    await updateRows("organizations", `id=eq.${org}`, { weekly_digest: true });
    const on = await (await cron("?dry")).json();
    if (
      mine(on)?.status !== "preview" ||
      mine(on).recipients !== 1 ||
      mine(on).subject !== "Revize Kučera: 1 po termínu, 1 do 30 dní"
    )
      throw new Error(`on: ${JSON.stringify(mine(on))}`);
    // A real run without e-mail set up sends nothing and claims no week.
    const real = await (await cron("")).json();
    if (mine(real)?.status !== "no-email") throw new Error(`real: ${JSON.stringify(mine(real))}`);
    const claimed = await selectRows("organization_digests", `organization_id=eq.${org}&select=id`);
    if (claimed.length !== 0) throw new Error("a week was claimed without sending");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p10-failure.png`);
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

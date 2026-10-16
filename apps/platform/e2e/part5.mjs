// Part 5 walkthrough: devices, label numbering, bulk add, search, filters, due dates.
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

// Calendar dates in the organization's time zone (the app does the same in lib/due.ts).
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addMonths(date, months) {
  const [y, m, d] = date.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const day = Math.min(d, daysIn(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function addDays(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Sets an input's value the way typing would (date inputs can't take typed text). */
const setValue = (selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
const submit = (selector) =>
  page.evaluate(`document.querySelector('${selector}').form.requestSubmit()`);
const rowCount = () =>
  page.evaluate(
    `document.querySelectorAll("main table tbody tr td").length ? document.querySelectorAll("main table tbody tr:has(td)").length : 0`,
  );

const page = await launch({ width: 1440, height: 1000 });
let orgId;
let siteId;
let singleUrl;
try {
  const owner = await createUser("devices-owner");
  const tech = await createUser("devices-tech");

  await step("without a building, the device list explains what to do first", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    orgId = await organizationOf(owner);
    await page.click('aside a[href="/devices"]');
    await page.waitForText("Nejdřív přidejte budovu");
  });

  await step("a building starts with no devices and offers to add them", async () => {
    const [customer] = await insertRows("customers", [
      { organization_id: orgId, name: "Bytové družstvo Lipová" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: orgId, customer_id: customer.id, name: "Lipová 12" },
    ]);
    siteId = site.id;
    await insertRows("locations", [
      { organization_id: orgId, site_id: siteId, name: "Suterén", sort_order: 1 },
      { organization_id: orgId, site_id: siteId, name: "1. patro", sort_order: 2 },
    ]);
    await page.goto(`${APP}/sites/${siteId}`);
    await page.waitForText("V budově zatím nejsou žádná zařízení.");
    await page.screenshot(`${OUT}/p5-01-site-empty.png`);
  });

  await step("20 devices are added at once with consecutive labels", async () => {
    await page.clickText("Přidat více");
    await page.waitForUrl(`/devices/bulk?site=${siteId}`);
    await page.waitFor("#count");
    if ((await page.evaluate(`document.querySelector("#siteId").value`)) !== siteId)
      throw new Error("building not preselected");
    const locationId = await page.evaluate(
      `[...document.querySelector("#locationId").options].find((o) => o.text === "1. patro").value`,
    );
    await page.selectValue("#locationId", locationId);
    // Pasted serial numbers set the count; a mismatch is explained.
    await setValue("#serialNumbers", "A-1\nA-2\nA-3\n");
    await sleep(200);
    if ((await page.evaluate(`document.querySelector("#count").value`)) !== "3")
      throw new Error("count not taken from the serial numbers");
    await setValue("#count", "20");
    await submit("#count");
    await page.waitForText("Počet výrobních čísel neodpovídá počtu zařízení.");
    await setValue("#serialNumbers", "");
    await setValue("#count", "101");
    await submit("#count");
    await page.waitForText("Zadejte celé číslo od 1 do 100.");
    await setValue("#count", "20");
    await page.type("#manufacturer", "Hasco");
    await page.type("#agent", "prášek");
    await page.type("#size", "6 kg");
    // Inspected on paper 12 months minus 10 days ago: due in about 10 days.
    await setValue("#lastInspectionOn", addDays(addMonths(today, -12), 10));
    await page.waitForText("Příští revize:");
    await page.screenshot(`${OUT}/p5-02-bulk-form.png`);
    await page.clickText("Přidat 20 zařízení", "button");
    await page.waitForText("Štítky 0001–0020.");
    await page.waitForUrl(`/sites/${siteId}`);
    await page.waitForText("1. patro (20)");
    await page.waitForText("20 × Brzy");
    await page.screenshot(`${OUT}/p5-03-site-devices.png`);
  });

  await step("a single device gets the next label and starts without an inspection", async () => {
    await page.clickText("Přidat zařízení");
    await page.waitForUrl(`/devices/new?site=${siteId}`);
    await page.waitFor("#serialNumber");
    await page.type("#serialNumber", "SN-ABC-1");
    await page.type("#manufactureYear", "21");
    await submit("#serialNumber");
    await page.waitForText("Zadejte rok výroby, např. 2021.");
    await page.type("#manufactureYear", "2021");
    await setValue("#lastInspectionOn", addDays(today, 5));
    await submit("#serialNumber");
    await page.waitForText("Datum nemůže být v budoucnosti.");
    await setValue("#lastInspectionOn", "");
    await submit("#serialNumber");
    await page.waitForText("Hasicí přístroj 0021");
    await page.waitForText("Zatím bez revize");
    singleUrl = await page.evaluate("location.pathname");
    await page.screenshot(`${OUT}/p5-04-device.png`);
  });

  await step("devices join the map, coloured by their due state on request", async () => {
    const deviceId = singleUrl.split("/").pop();
    await page.goto(`${APP}/graph?focus=${deviceId}`);
    await page.waitFor(`.react-flow__node[data-id="${deviceId}"]`);
    await page.waitForText("Hasicí přístroj 0021");
    await page.waitForText("SN-ABC-1");
    await page.clickText("Podle typu");
    await page.clickText("Podle termínu", "[role=menuitemradio]");
    // 20 devices due soon, plus their location, building and customer (rolled up).
    await page.waitForText("Brzy");
    const legend = await page.evaluate(
      `[...document.querySelectorAll('[role=region] button')].map((b) => b.innerText.replace(/\\s+/g, " ").trim())`,
    );
    for (const expected of ["Brzy (23)", "Bez revize (1)", "Nehlídá se (1)"])
      if (!legend.includes(expected)) throw new Error(`legend: ${legend.join(" | ")}`);
    await page.screenshot(`${OUT}/p5-09-map-due.png`);
  });

  await step("devices are found by label number and serial number", async () => {
    await page.click('aside a[href="/devices"]');
    await page.waitForText("21 výsledků");
    await page.type("#search", "0007");
    await page.waitForText("1 výsledek");
    if ((await rowCount()) !== 1) throw new Error(`rows for 0007: ${await rowCount()}`);
    await page.type("#search", "sn-abc");
    await page.waitForText("1 výsledek");
    await page.waitForText("SN-ABC-1");
    await page.type("#search", "nic-takoveho");
    await page.waitForText("Nic jsme nenašli");
    await page.goto(`${APP}/devices`);
    await page.waitForText("21 výsledků");
  });

  await step("filters narrow the list by customer, due state, location and status", async () => {
    // A second customer with one device (never inspected).
    const [other] = await insertRows("customers", [
      { organization_id: orgId, name: "Nemocnice Na Výsluní" },
    ]);
    const [otherSite] = await insertRows("sites", [
      { organization_id: orgId, customer_id: other.id, name: "Pavilon A" },
    ]);
    const [type] = await selectRows("device_types", `organization_id=eq.${orgId}&select=id`);
    await insertRows("devices", [
      { organization_id: orgId, site_id: otherSite.id, device_type_id: type.id },
    ]);
    await page.goto(`${APP}/devices`);
    await page.waitForText("22 výsledků");
    await page.selectValue("#filter-customer", other.id);
    await page.waitForText("1 výsledek");
    const siteOptions = await page.evaluate(
      `document.querySelector("#filter-site").options.length`,
    );
    if (siteOptions !== 2) throw new Error(`building options for one customer: ${siteOptions}`);
    await page.selectValue("#filter-customer", "");
    await page.waitForText("22 výsledků");
    await page.selectValue("#filter-due", "never");
    await page.waitForText("2 výsledky");
    await page.selectValue("#filter-due", "soon");
    await page.waitForText("20 výsledků");
    await page.selectValue("#filter-due", "");
    await page.waitForText("22 výsledků");
    await page.selectValue("#filter-site", siteId);
    await page.waitFor("#filter-location");
    await page.selectValue("#filter-location", "none");
    await page.waitForText("1 výsledek");
    await page.screenshot(`${OUT}/p5-05-list-filtered.png`);
    await page.clickText("Zrušit filtry", "button");
    await page.waitForText("22 výsledků");
    await page.screenshot(`${OUT}/p5-06-list.png`);
  });

  await step("editing the last inspection date moves the device to overdue", async () => {
    await page.goto(`${APP}${singleUrl}/edit`);
    await page.waitFor("#lastInspectionOn");
    await setValue("#lastInspectionOn", addMonths(today, -13));
    await page.waitForText("Příští revize:");
    await submit("#lastInspectionOn");
    await page.waitForUrl(singleUrl);
    await page.waitForText("Po termínu");
    await page.waitForText("po termínu)");
    await page.screenshot(`${OUT}/p5-07-overdue.png`);
  });

  await step("a longer interval on the type moves the due dates", async () => {
    const typeHref = await page.evaluate(
      `document.querySelector("main a[href^='/device-types/']").getAttribute("href")`,
    );
    await page.goto(`${APP}${typeHref}/edit`);
    await page.waitFor("#interval");
    await page.type("#interval", "24");
    await submit("#interval");
    await page.waitForText("24 měsíců");
    await page.goto(`${APP}${singleUrl}`);
    await page.waitForText("V pořádku");
  });

  await step("an out-of-service device isn't tracked for due dates", async () => {
    await page.goto(`${APP}${singleUrl}/edit`);
    await page.waitFor("#status");
    await page.selectValue("#status", "out_of_service");
    await submit("#status");
    await page.waitForUrl(singleUrl);
    await page.waitForText("termín revize se nehlídá");
  });

  await step("the dashboard counts devices by due state", async () => {
    await page.click('aside a[href="/"]');
    await page.waitForText("Termíny revizí");
    const counts = await page.evaluate(
      `[...document.querySelectorAll("main a[href^='/devices?due=']")].map((a) => a.innerText.replace(/\\s+/g, " ").trim())`,
    );
    // The 20 bulk devices are now due in about two years (24-month interval).
    if (!counts.some((text) => text.startsWith("20 V pořádku")))
      throw new Error(`due counts: ${counts.join(" | ")}`);
    await page.screenshot(`${OUT}/p5-08-dashboard.png`);
  });

  await step("deleting a device keeps its label number out of use", async () => {
    await page.goto(`${APP}${singleUrl}`);
    await page.clickText("Smazat", "button");
    await page.waitForText("Smazat zařízení?");
    await page.clickText("Smazat", "[role=alertdialog] button, [role=dialog] button");
    await page.waitForUrl(`/sites/${siteId}`);
    await page.waitForText("Zařízení (20)");
    await page.goto(`${APP}/devices/new?site=${siteId}`);
    await page.waitFor("#serialNumber");
    await page.type("#serialNumber", "SN-NEXT");
    await submit("#serialNumber");
    // 0021 was deleted and 0022 went to the second customer: numbers are never reused.
    await page.waitForText("Hasicí přístroj 0023");
  });

  await step("a technician sees devices read-only", async () => {
    await addMember(orgId, tech, "technician", "Tomáš Technik");
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, tech);
    await page.waitForText("Vítejte, Tomáš");
    await page.goto(`${APP}/devices`);
    await page.waitForText("22 výsledků");
    const addLinks = await page.evaluate(
      `[...document.querySelectorAll("a")].filter((a) => ["Nové zařízení", "Přidat více"].includes(a.textContent.trim())).length`,
    );
    if (addLinks) throw new Error("technician sees add links");
    await page.goto(`${APP}/devices/new?site=${siteId}`);
    await page.waitForUrl("/devices");
    if ((await page.evaluate("location.pathname")) !== "/devices")
      throw new Error("add form not redirected");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p5-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

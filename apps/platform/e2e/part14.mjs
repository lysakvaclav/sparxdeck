// Part 14 walkthrough: import from Excel. A new company downloads the template,
// imports an .xlsx with a title row, Czech headers, an Excel date, a company ID
// that lost its leading zero, a quantity, a bad and a missing value; checks the
// preview; imports; imports the fixed rows again (duplicates skipped); undoes an
// import (and can't undo one in use); a technician has no import; a phone shows
// the check readably.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
  cleanup,
  createUser,
  organizationOf,
  selectRows,
  signIn,
  writeTestXlsx,
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

/** Clicks the tab whose label starts with `label` (tabs show a count after it). */
async function clickTab(page, label) {
  await page.evaluate(
    `[...document.querySelectorAll("[role=tab]")].find((tab) => tab.innerText.trim().startsWith(${JSON.stringify(label)}))?.setAttribute("data-e2e-tab", "1")`,
  );
  await page.click('[data-e2e-tab="1"]');
  await page.evaluate(`document.querySelector("[data-e2e-tab]")?.removeAttribute("data-e2e-tab")`);
}

/** Clicks "Undo" in the history row of an import. */
async function undoRow(page, fileName) {
  const found = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll("tr")].find((tr) => [...tr.cells].some((cell) => cell.innerText.trim() === ${JSON.stringify(fileName)}));
    const button = row?.querySelector("button");
    button?.setAttribute("data-e2e-undo", "1");
    return Boolean(button);
  })()`);
  if (!found) throw new Error(`no undo for ${fileName}`);
  await page.click('[data-e2e-undo="1"]');
  await page.evaluate(
    `document.querySelector("[data-e2e-undo]")?.removeAttribute("data-e2e-undo")`,
  );
}

const noDialog = (page) =>
  until("dialogs closed", () =>
    page.evaluate(`!document.querySelector("[role=dialog], [role=alertdialog]")`),
  );

const page = await launch({ width: 1440, height: 1000 });
let phone;
let other;
try {
  const owner = await createUser("import-owner");
  const technician = await createUser("import-tech");
  let org;

  await step("an empty company finds the import from its customers", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Import");
    await page.type("#displayName", "Ivana Importová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Ivana");
    org = await organizationOf(owner);
    await page.goto(`${APP}/customers`);
    await page.click('a[href="/import"]');
    await page.waitForUrl("/import");
    await page.waitForText("Vyberte soubor");
    await page.waitForText("Zatím žádný import.");
  });

  await step("the template downloads as a CSV for Excel", async () => {
    const result = await page.evaluate(`(async () => {
      const response = await fetch("/import/template");
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
        header: new TextDecoder().decode(bytes).split("\\r\\n")[0],
      };
    })()`);
    if (result.status !== 200 || !result.type.startsWith("text/csv") || !result.bom)
      throw new Error(`template ${JSON.stringify(result)}`);
    if (
      !result.header.startsWith("Zákazník (název);IČO;") ||
      !result.disposition.includes("vzor-importu.csv")
    )
      throw new Error(`template header ${result.header}`);
  });

  const header = [
    "Odběratel",
    "IČO",
    "Objekt",
    "Adresa",
    "Umístění",
    "Druh",
    "Výr. č.",
    "Rok výroby",
    "Datum revize",
    "Hasivo",
    "Počet",
  ];
  const file = writeTestXlsx(OUT, "soupis-2026.xlsx", [
    ["Soupis hasicích přístrojů"],
    [],
    header,
    [
      "Bytové družstvo Lipová",
      "27082440",
      "Lipová 12",
      "Lipová 12, Praha 2",
      "Suterén",
      "Hasicí přístroj",
      "HP-001",
      2019,
      { date: "2025-05-01" },
      "prášek ABC",
      null,
    ],
    [
      "bytové družstvo lipová",
      null,
      "Lipová 12",
      null,
      "1. patro",
      null,
      "HP-002",
      2021,
      "1. 6. 2025",
      "CO2",
      null,
    ],
    [
      "Škola Na Kopci",
      4569873,
      "Tělocvična",
      "Kopec 1, Brno",
      null,
      null,
      null,
      null,
      null,
      null,
      "3 ks",
    ],
    ["Škola Na Kopci", null, "Tělocvična", null, null, "Sprinkler", "SP-1", null, null, null, null],
    [null, null, "Bez zákazníka", null, null, null, "X-1", null, null, null, null],
    ["Škola Na Kopci", null, "Jídelna", null, null, null, "HP-9", "staré", null, null, null],
    [],
  ]);

  await step("an .xlsx is read and its columns are recognized", async () => {
    await page.setFile('input[type=file][accept*=".xlsx"]', file);
    await page.waitForText("Které sloupce co obsahují", 20000);
    const picked = await page.evaluate(`Object.fromEntries(
      ["customerName", "companyId", "siteName", "siteAddress", "locationName", "deviceType", "serialNumber", "manufactureYear", "lastInspectionOn", "agent", "quantity", "contactPerson"]
        .map((field) => [field, document.querySelector("#map-" + field).selectedOptions[0].textContent]))`);
    const expected = {
      customerName: "A: Odběratel",
      companyId: "B: IČO",
      siteName: "C: Objekt",
      siteAddress: "D: Adresa",
      locationName: "E: Umístění",
      deviceType: "F: Druh",
      serialNumber: "G: Výr. č.",
      manufactureYear: "H: Rok výroby",
      lastInspectionOn: "I: Datum revize",
      agent: "J: Hasivo",
      quantity: "K: Počet",
      contactPerson: "— nepoužít —",
    };
    if (JSON.stringify(picked) !== JSON.stringify(expected))
      throw new Error(`mapping ${JSON.stringify(picked)}`);
    await page.waitForText("6 řádků");
    await page.screenshot(`${OUT}/p14-01-columns.png`);
  });

  await step("the check shows what will be created and what's wrong, row by row", async () => {
    await page.clickText("Pokračovat ke kontrole");
    await page.waitForText("Co se naimportuje");
    const stats = await page.evaluate(
      `[...document.querySelectorAll(".rounded-md.bg-muted p.tabular-nums")].map((p) => p.textContent)`,
    );
    // 2 customers, 3 buildings, 2 locations, 1 + 1 + 3 + 1 devices.
    if (stats.join(",") !== "2,3,2,6") throw new Error(`stats ${stats.join(",")}`);
    await page.waitForText("2 řádky mají chybu a nenaimportují se.");
    await page.waitForText("1 řádek má upozornění");
    // Errors first: the unknown type and the missing customer.
    await page.waitForText("Typ zařízení: Neznámý typ zařízení.");
    await page.waitForText("Zákazník (název):");
    await clickTab(page, "Upozornění");
    await page.waitForText("Rok výroby se neuloží");
    await clickTab(page, "Vše");
    await page.screenshot(`${OUT}/p14-02-check.png`);
  });

  let firstImport;
  await step("the import creates everything in one go and lists the buildings", async () => {
    await page.clickText("Importovat");
    await page.waitForText("Import je hotový", 30000);
    await page.waitForText("2 zákazníci, 3 budovy, 2 lokace, 6 zařízení");
    await page.waitForText("Tisk štítků");
    const [entry] = await selectRows("imports", `organization_id=eq.${org}&select=*`);
    firstImport = entry;
    if (entry.file_name !== "soupis-2026.xlsx" || entry.devices_created !== 6)
      throw new Error(`history ${JSON.stringify(entry)}`);
    const customers = await selectRows(
      "customers",
      `organization_id=eq.${org}&select=name,company_id&order=name`,
    );
    if (
      JSON.stringify(customers) !==
      JSON.stringify([
        { name: "Bytové družstvo Lipová", company_id: "27082440" },
        { name: "Škola Na Kopci", company_id: "04569873" },
      ])
    )
      throw new Error(`customers ${JSON.stringify(customers)}`);
    const [hp1] = await selectRows(
      "devices",
      `organization_id=eq.${org}&serial_number=eq.HP-001&select=last_inspection_on,next_due_on,manufacture_year,attributes,location_id`,
    );
    if (
      hp1.last_inspection_on !== "2025-05-01" ||
      !hp1.next_due_on ||
      hp1.manufacture_year !== 2019
    )
      throw new Error(`HP-001 ${JSON.stringify(hp1)}`);
    if (hp1.attributes.agent !== "prášek ABC" || !hp1.location_id)
      throw new Error("HP-001 details");
    const [hp9] = await selectRows(
      "devices",
      `organization_id=eq.${org}&serial_number=eq.HP-9&select=manufacture_year`,
    );
    if (hp9.manufacture_year !== null) throw new Error("a bad year was stored");
    await page.screenshot(`${OUT}/p14-03-done.png`);
  });

  await step("importing the fixed rows again skips what's there", async () => {
    const fixed = writeTestXlsx(OUT, "opravene.xlsx", [
      header,
      [
        "Bytové družstvo Lipová",
        "27082440",
        "Lipová 12",
        null,
        "Suterén",
        null,
        "HP-001",
        2019,
        { date: "2025-05-01" },
        null,
        null,
      ],
      ["Škola Na Kopci", null, "Tělocvična", null, null, null, "SP-1", null, null, null, null],
    ]);
    await page.clickText("Importovat další soubor");
    await page.waitForText("Vyberte soubor");
    await page.setFile('input[type=file][accept*=".xlsx"]', fixed);
    await page.waitForText("Které sloupce co obsahují", 20000);
    await page.clickText("Pokračovat ke kontrole");
    await page.waitForText("1 zařízení se přeskočí");
    await page.clickText("Importovat");
    await page.waitForText("Import je hotový", 30000);
    await page.waitForText("0 zákazníků, 0 budov, 0 lokací, 1 zařízení");
    await page.waitForText("1 zařízení přeskočeno");
  });

  await step("the last import is undone; one in use can't be", async () => {
    await page.goto(`${APP}/import`);
    await page.waitForText("Historie importů");
    const imports = await selectRows(
      "imports",
      `organization_id=eq.${org}&select=id,file_name&order=created_at.desc`,
    );
    if (imports.length !== 2) throw new Error(`imports ${imports.length}`);
    await undoRow(page, "opravene.xlsx");
    await page.waitForText("Vrátit import?");
    await page.clickText("Vrátit import", "button");
    await page.waitForText("Import „opravene.xlsx“ je vrácený.");
    const [sp1] = await selectRows(
      "devices",
      `organization_id=eq.${org}&serial_number=eq.SP-1&select=deleted_at`,
    );
    if (!sp1.deleted_at) throw new Error("undone device still there");
    // The first import, once inspected, stays.
    const [lipova] = await selectRows(
      "sites",
      `organization_id=eq.${org}&name=eq.Lipová 12&select=id`,
    );
    await page.goto(`${APP}/sites/${lipova.id}`);
    await page.clickText("Zahájit revizi");
    await page.waitForText("Zkontrolováno 0 z");
    await page.goto(`${APP}/import`);
    await noDialog(page);
    await undoRow(page, "soupis-2026.xlsx");
    await page.waitForText("Vrátit import?");
    await page.clickText("Vrátit import", "button");
    await page.waitForText("Import už nejde vrátit");
    const [still] = await selectRows("imports", `id=eq.${firstImport.id}&select=undone_at`);
    if (still.undone_at) throw new Error("an import in use was undone");
    await page.screenshot(`${OUT}/p14-04-history.png`);
  });

  await step("a technician has no import", async () => {
    await addMember(org, technician, "technician", "Tomáš Technik");
    other = await launch({ width: 1440, height: 1000 });
    await signIn(other, technician);
    await other.waitForText("Vítejte, Tomáš");
    await other.goto(`${APP}/customers`);
    await other.waitForText("Škola Na Kopci");
    if (await other.evaluate(`!!document.querySelector('a[href="/import"]')`))
      throw new Error("technician sees the import");
    await other.goto(`${APP}/import`);
    await other.waitForUrl(`${APP}/`);
  });

  await step("on a phone the check reads well", async () => {
    phone = await launch({ width: 390, height: 844, mobile: true });
    await phone.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await signIn(phone, owner);
    await phone.waitForText("Vítejte, Ivana");
    await phone.goto(`${APP}/import`);
    await phone.setFile('input[type=file][accept*=".xlsx"]', file);
    await phone.waitForText("Které sloupce co obsahují", 20000);
    await phone.screenshot(`${OUT}/p14-05-phone-columns.png`);
    await phone.clickText("Pokračovat ke kontrole");
    await phone.waitForText("Co se naimportuje");
    const overflow = await phone.evaluate(
      `document.documentElement.scrollWidth > window.innerWidth + 1`,
    );
    if (overflow) throw new Error("the check scrolls sideways");
    await phone.screenshot(`${OUT}/p14-06-phone-check.png`);
  });
} catch {
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p14-failure.png`).catch(() => {});
  if (phone) await phone.screenshot(`${OUT}/p14-failure-phone.png`).catch(() => {});
} finally {
  const logs = [...page.logs, ...(phone?.logs ?? []), ...(other?.logs ?? [])];
  await page.close();
  await phone?.close();
  await other?.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

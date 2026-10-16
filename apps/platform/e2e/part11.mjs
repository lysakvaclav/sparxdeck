// Part 11 walkthrough: a new company follows the guide from its details to the
// first printed label while sample data shows what the app does (and doesn't
// touch real numbering), finds anything with the search (keyboard and phone),
// exports devices and inspections to CSV, then removes the sample data.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import { APP, cleanup, createUser, organizationOf, selectRows, signIn } from "./support.mjs";

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

const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
  new Date(),
);
const KEYS = {
  "/": { key: "/", code: "Slash", windowsVirtualKeyCode: 191, text: "/" },
  k: { key: "k", code: "KeyK", windowsVirtualKeyCode: 75 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
};
async function press(page, name, modifiers = 0) {
  const key = KEYS[name];
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers, ...key });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, ...key });
  await sleep(150);
}
const submit = (page, selector) =>
  page.evaluate(`document.querySelector('${selector}').form.requestSubmit()`);
const omnibarOpen = (page) => page.evaluate(`!!document.querySelector("input[role=combobox]")`);
const hits = (page) =>
  page.evaluate(
    `[...document.querySelectorAll("#omnibar-results [role=option]")].map((o) => o.innerText.split("\\n")[0].trim())`,
  );
async function search(page, query) {
  await page.evaluate(`(() => {
    const input = document.querySelector("input[role=combobox]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(query)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  // Typing marks the search busy at once; wait until its answer is shown.
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    const busy = await page.evaluate(
      `document.querySelector("[role=dialog][data-loading]")?.dataset.loading === "true"`,
    );
    if (!busy) return;
  }
  throw new Error(`search for ${query} never finished`);
}
/** Fetches a file the page links to and describes it. */
const download = (page, path) =>
  page.evaluate(`(async () => {
    const response = await fetch(${JSON.stringify(path)});
    const bytes = new Uint8Array(await response.arrayBuffer());
    // TextDecoder drops the BOM, so it is checked on the bytes.
    const text = new TextDecoder().decode(bytes);
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      disposition: response.headers.get("content-disposition"),
      bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
      lines: text.replace(/^\\uFEFF/, "").split("\\r\\n").filter(Boolean),
    };
  })()`);

const page = await launch({ width: 1440, height: 1000 });
let phone;
let org;
try {
  const owner = await createUser("guide-owner");
  let sampleCustomer;
  let siteUrl;

  await step("a new company is greeted by the guide", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Svoboda");
    await page.type("#displayName", "Eva Svobodová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Eva");
    await page.waitForText("Začínáme");
    await page.waitForText("0 z 5");
    await page.waitForText("Chcete si aplikaci nejdřív vyzkoušet?");
    org = await organizationOf(owner);
    await page.screenshot(`${OUT}/p11-01-guide.png`);
  });

  await step("sample data shows the app and numbers itself apart", async () => {
    await page.clickText("Vložit ukázková data", "button");
    await page.waitForText("Ukázková data jsou připravená.");
    await page.waitForText("Ve firmě jsou ukázková data: Ukázka – Bytové družstvo Lipová.");
    await page.waitForText("0 z 5"); // samples aren't the company's own steps
    await page.waitForText("Lipová 12");
    const [customer] = await selectRows(
      "customers",
      `organization_id=eq.${org}&is_sample=eq.true&select=id`,
    );
    sampleCustomer = customer.id;
    const labels = await selectRows(
      "devices",
      `organization_id=eq.${org}&select=label_number&order=label_number`,
    );
    if (labels[0].label_number !== 900001 || labels.length !== 9)
      throw new Error(`sample labels ${JSON.stringify(labels)}`);
    await page.goto(`${APP}/customers`);
    await page.waitForText("Ukázka");
  });

  await step("the search finds customers, buildings, devices and defects", async () => {
    await page.goto(`${APP}/`);
    await page.waitForText("Začínáme");
    await press(page, "/");
    if (!(await omnibarOpen(page))) throw new Error("'/' didn't open the search");
    await page.waitForText("Hledejte podle názvu");
    await search(page, "Lipová");
    const found = await hits(page);
    if (!found.includes("Ukázka – Bytové družstvo Lipová") || !found.includes("Lipová 12"))
      throw new Error(`hits ${found}`);
    await page.screenshot(`${OUT}/p11-02-search.png`);
    await search(page, "900003");
    if ((await hits(page))[0] !== "Hasicí přístroj 900003")
      throw new Error(`label ${await hits(page)}`);
    await search(page, "Z-900001");
    const defect = await hits(page);
    if (!defect[0]?.startsWith("Z-900001")) throw new Error(`defect ${defect}`);
    await search(page, "nic takového neexistuje");
    await page.waitForText("Pro „nic takového neexistuje“ jsme nic nenašli.");
    await press(page, "Escape");
    if (await omnibarOpen(page)) throw new Error("Escape didn't close");
    // Ctrl+K, then keyboard only: the first hit opens.
    await press(page, "k", 2);
    if (!(await omnibarOpen(page))) throw new Error("Ctrl+K didn't open the search");
    await search(page, "Lipová 14");
    await press(page, "ArrowDown");
    await press(page, "Enter");
    await page.waitForUrl("/sites/");
    await page.waitForText("Lipová 14 – dvorní trakt");
  });

  await step("an inspection on the sample gets a sample protocol number", async () => {
    await page.goto(`${APP}/customers/${sampleCustomer}`);
    await page.clickText("Lipová 14 – dvorní trakt", "a");
    await page.waitForUrl("/sites/");
    await page.clickText("Zahájit revizi");
    await page.waitForText("Zkontrolováno 0 z 2");
    await page.waitFor('a[href$="/complete"]');
    await page.clickText("Dokončit revizi", "a");
    await page.waitForText("Nezkontrolovaná zařízení");
    await page.clickText("Dokončit revizi", "button");
    await page.waitForText(`${year}-900001`);
  });

  await step("the guide leads to the first real label, numbered 0001", async () => {
    await page.goto(`${APP}/`);
    await page.clickText("Doplnit údaje", "a");
    await page.waitForUrl("/settings");
    await page.type("#companyId", "27082440");
    await submit(page, "#companyId");
    await page.waitForText("Uloženo.");

    await page.goto(`${APP}/`);
    await page.waitForText("1 z 5");
    await page.clickText("Přidat zákazníka", "a");
    await page.waitForUrl("/customers/new");
    await page.type("#name", "Správa nemovitostí Brno");
    await submit(page, "#name");
    await page.waitForText("Zákazník zatím nemá žádné budovy.");

    await page.goto(`${APP}/`);
    await page.waitForText("2 z 5");
    await page.clickText("Přidat budovu", "a");
    await page.waitFor("#address");
    await page.type("#name", "Masarykova 8");
    await submit(page, "#name");
    await page.waitForText("Masarykova 8");
    siteUrl = new URL(await page.url()).pathname;

    await page.goto(`${APP}/`);
    await page.waitForText("3 z 5");
    await page.clickText("Přidat zařízení", "a");
    await page.waitFor("#serialNumber");
    await page.type("#serialNumber", "HP-REAL-1");
    await submit(page, "#serialNumber");
    // Sample devices took 900001…, the real numbering starts at 1.
    await page.waitForText("Hasicí přístroj 0001");

    await page.goto(`${APP}/`);
    await page.waitForText("4 z 5");
    await page.clickText("Tisk štítků", "a");
    await page.waitForText("Vybráno 1 z 1");
    const pdf = await page.evaluate(`(async () => {
      const response = await fetch("/devices/labels/pdf", {
        method: "POST",
        body: new FormData(document.querySelector("main form")),
      });
      return response.status;
    })()`);
    if (pdf !== 200) throw new Error(`labels ${pdf}`);

    await page.goto(`${APP}/`);
    await page.waitForText("Ve firmě jsou ukázková data");
    const guide = await page.evaluate(`!!document.querySelector("[data-testid=getting-started]")`);
    if (guide) throw new Error("guide still shown after the last step");
    await page.screenshot(`${OUT}/p11-03-done.png`);
  });

  await step("devices and inspections export to CSV for Excel", async () => {
    await page.goto(`${APP}${siteUrl}`);
    await page.clickText("Zahájit revizi");
    await page.waitForText("Zkontrolováno 0 z 1");
    await page.waitFor('a[href$="/complete"]');
    await page.clickText("Dokončit revizi", "a");
    await page.waitForText("Nezkontrolovaná zařízení");
    await page.clickText("Dokončit revizi", "button");
    // The real protocol numbering wasn't touched by the sample one.
    await page.waitForText(`${year}-0001`);

    const siteId = siteUrl.split("/").pop();
    await page.goto(`${APP}/devices?site=${siteId}`);
    await page.waitForText("1 výsledek");
    const href = await page.evaluate(
      `document.querySelector('a[href^="/devices/export"]').getAttribute("href")`,
    );
    if (href !== `/devices/export?site=${siteId}`) throw new Error(`export link ${href}`);
    const devices = await download(page, href);
    if (devices.status !== 200 || !devices.type.startsWith("text/csv") || !devices.bom)
      throw new Error(`devices ${JSON.stringify(devices)}`);
    if (!devices.disposition.includes("zarizeni-")) throw new Error(devices.disposition);
    if (!devices.lines[0].startsWith("Štítek;Typ;Stav;Zákazník;Budova"))
      throw new Error(`header ${devices.lines[0]}`);
    if (
      devices.lines.length !== 2 ||
      !devices.lines[1].startsWith(
        "0001;Hasicí přístroj;Aktivní;Správa nemovitostí Brno;Masarykova 8",
      )
    )
      throw new Error(`rows ${JSON.stringify(devices.lines)}`);

    await page.goto(`${APP}/inspections`);
    await page.waitForText("Export CSV");
    const inspections = await download(page, "/inspections/export");
    if (!inspections.lines[0].startsWith("Dokončeno;Protokol;Zákazník;Budova;Štítek"))
      throw new Error(`header ${inspections.lines[0]}`);
    const rows = inspections.lines.slice(1);
    if (
      !rows.some((row) => row.includes(`;${year}-0001;Správa nemovitostí Brno;Masarykova 8;0001;`))
    )
      throw new Error(`rows ${JSON.stringify(rows)}`);
  });

  await step("sample data goes in one click, real data stays", async () => {
    await page.goto(`${APP}/`);
    await page.clickText("Smazat ukázková data", "button");
    await page.waitForText("Smazat ukázková data?");
    await page.clickText("Smazat", "button");
    await page.waitForText("Ukázková data jsou smazaná.");
    const samples = await selectRows(
      "customers",
      `organization_id=eq.${org}&is_sample=eq.true&select=id`,
    );
    if (samples.length !== 0) throw new Error("sample customer left");
    const devices = await selectRows("devices", `organization_id=eq.${org}&select=label_number`);
    if (JSON.stringify(devices) !== JSON.stringify([{ label_number: 1 }]))
      throw new Error(`devices ${JSON.stringify(devices)}`);
    // The page refreshes after the toast; the reminder goes with it.
    for (let i = 0; ; i++) {
      const reminder = await page.evaluate(
        `!!document.querySelector("[data-testid=sample-reminder]")`,
      );
      if (!reminder) break;
      if (i === 50) throw new Error("reminder still shown");
      await sleep(100);
    }
  });

  await step("on the phone the search sits in the top bar", async () => {
    phone = await launch({ width: 390, height: 844, mobile: true });
    await signIn(phone, owner);
    await phone.waitForText("Vítejte, Eva");
    await phone.click('header button[aria-label="Hledat"]');
    await sleep(300);
    if (!(await omnibarOpen(phone))) throw new Error("no search on the phone");
    await search(phone, "Masarykova");
    if ((await hits(phone))[0] !== "Masarykova 8") throw new Error(`phone ${await hits(phone)}`);
    await phone.screenshot(`${OUT}/p11-04-phone-search.png`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p11-failure.png`);
  if (phone) await phone.screenshot(`${OUT}/p11-failure-phone.png`);
} finally {
  const logs = [...page.logs, ...(phone?.logs ?? [])];
  await page.close();
  if (phone) await phone.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

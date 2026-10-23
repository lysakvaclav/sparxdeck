// Screenshots of the main pages for a visual review (not a test): a company with
// sample data, desktop light, desktop dark and a phone.
// Run: node --env-file=.env.local e2e/screens.mjs .e2e-output/screens [prefix]
import fs from "node:fs";
import { launch, sleep } from "./driver.mjs";
import { APP, cleanup, createUser, organizationOf, selectRows, signIn } from "./support.mjs";

const OUT = process.argv[2] ?? ".e2e-output/screens";
const PREFIX = process.argv[3] ?? "s";
fs.mkdirSync(OUT, { recursive: true });

let page = await launch({ width: 1440, height: 900 });
try {
  const owner = await createUser("screens-owner");
  await signIn(page, owner);
  await page.waitForUrl("/onboarding");
  await page.screenshot(`${OUT}/${PREFIX}-00-onboarding.png`);
  await page.type("#organizationName", "Revize Novák");
  await page.type("#displayName", "Petr Novák");
  await page.clickText("Vytvořit firmu");
  await page.waitForText("Vítejte, Petr");
  await page.clickText("Vložit ukázková data", "button");
  await page.waitForText("Ukázková data jsou připravená.");
  await sleep(1500);
  const org = await organizationOf(owner);
  const [customer] = await selectRows("customers", `organization_id=eq.${org}&select=id`);
  const [site] = await selectRows("sites", `organization_id=eq.${org}&select=id&order=name&limit=1`);
  const [device] = await selectRows(
    "devices",
    `organization_id=eq.${org}&select=id&order=label_number&limit=1`,
  );
  const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id&limit=1`);
  const [defect] = await selectRows("defects", `organization_id=eq.${org}&select=id`);
  const [plan] = await selectRows(
    "floor_plans",
    `organization_id=eq.${org}&select=id,site_id&order=sort_order&limit=1`,
  );
  const [done] = await selectRows(
    "inspections",
    `organization_id=eq.${org}&status=eq.completed&select=id&limit=1`,
  );

  const pages = [
    ["dashboard", "/"],
    ["customers", "/customers"],
    ["customer", `/customers/${customer.id}`],
    ["site", `/sites/${site.id}`],
    ["devices", "/devices"],
    ["device", `/devices/${device.id}`],
    ["device-new", `/devices/new?site=${site.id}`],
    ["labels", `/devices/labels?site=${site.id}`],
    ["defects", "/defects"],
    ["defect", `/defects/${defect.id}`],
    ["inspections", "/inspections"],
    ...(done ? [["inspection", `/inspections/${done.id}`]] : []),
    ["summary", "/inspections/summary"],
    ["device-types", "/device-types"],
    ["device-type", `/device-types/${type.id}`],
    ["team", "/team"],
    ["settings", "/settings"],
    ["account", "/account"],
    ["graph", "/graph"],
    ["plans", "/plans"],
    ...(plan ? [["plan", `/sites/${plan.site_id}/plans/${plan.id}`]] : []),
    ["import", "/import"],
  ];
  for (const [label, path] of pages) {
    await page.goto(`${APP}${path}`);
    await sleep(1500);
    await page.screenshot(`${OUT}/${PREFIX}-d-${label}.png`);
  }

  await page.close();
  page = await launch({ width: 1440, height: 900, dark: true });
  await signIn(page, owner);
  await page.waitForText("Vítejte, Petr");
  for (const [label, path] of [
    ["dashboard", "/"],
    ["devices", "/devices"],
    ["device", `/devices/${device.id}`],
    ["settings", "/settings"],
    ...(done ? [["inspection", `/inspections/${done.id}`]] : []),
  ]) {
    await page.goto(`${APP}${path}`);
    await sleep(1500);
    await page.screenshot(`${OUT}/${PREFIX}-dark-${label}.png`);
  }

  await page.close();
  page = await launch({ width: 390, height: 844, mobile: true });
  await signIn(page, owner);
  await page.waitForText("Vítejte, Petr");
  await page.screenshot(`${OUT}/${PREFIX}-m-dashboard.png`);
  for (const [label, path] of [
    ["devices", "/devices"],
    ["device", `/devices/${device.id}`],
    ["defects", "/defects"],
    ["settings", "/settings"],
  ]) {
    await page.goto(`${APP}${path}`);
    await sleep(1500);
    await page.screenshot(`${OUT}/${PREFIX}-m-${label}.png`);
  }
  await page.goto(`${APP}/sites/${site.id}`);
  await page.clickText("Zahájit revizi");
  await page.waitForText("Zkontrolováno 0 z");
  await sleep(800);
  await page.screenshot(`${OUT}/${PREFIX}-m-inspection.png`);
  const run = new URL(await page.url()).pathname;
  await page.goto(`${APP}${run}/check/${device.id}`);
  await page.waitForText("Uloženo");
  await page.screenshot(`${OUT}/${PREFIX}-m-check.png`);
  await page.goto(`${APP}${run}/complete`);
  await page.waitForText("Podpis zákazníka");
  await page.screenshot(`${OUT}/${PREFIX}-m-complete.png`);
  console.log("screens: done");
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/${PREFIX}-failure.png`).catch(() => {});
} finally {
  await page.close();
  await cleanup();
}

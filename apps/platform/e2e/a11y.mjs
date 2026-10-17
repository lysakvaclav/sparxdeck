// Accessibility check of the main pages with axe-core (WCAG 2.1 A and AA):
// a company with sample data, every main page on the desktop and the field pages
// on a phone, light and dark. Fails on serious or critical findings.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import fs from "node:fs";
import { createRequire } from "node:module";
import { launch, sleep } from "./driver.mjs";
import { APP, cleanup, createUser, organizationOf, selectRows, signIn } from "./support.mjs";

const OUT = process.argv[2] ?? ".e2e-output";
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const results = [];
const findings = [];

/** Runs axe on the page and keeps the serious and critical violations. */
async function audit(page, label) {
  await page.evaluate(AXE);
  const violations = await page.evaluate(`(async () => {
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " :: " + n.failureSummary.split("\\n").slice(1, 2).join(" ")),
        count: v.nodes.length,
      }));
  })()`);
  for (const violation of violations) findings.push({ page: label, ...violation });
  results.push(
    `${violations.length ? "FAIL" : "ok  "} ${label}${violations.length ? `: ${violations.map((v) => v.id).join(", ")}` : ""}`,
  );
}

/** In the page: controls under 44 px (icon-only ones also under 44 px wide). */
const SMALL_TARGETS = `(() => {
  const selector = "button:not([role=checkbox]), a, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=tab], [role=radio], [role=option], [role=menuitem]";
  const dialog = document.querySelector("[role=dialog], [role=alertdialog]");
  return [...document.querySelectorAll(selector)]
    .filter((el) => {
      if (dialog && !dialog.contains(el)) return false;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).visibility === "hidden") return false;
      if (el.closest("table, p, .sr-only, [aria-hidden=true]") || el.classList.contains("sr-only"))
        return false;
      const iconOnly = !el.textContent.trim();
      return box.height < 43.5 || (iconOnly && box.width < 43.5);
    })
    .slice(0, 6)
    .map((el) => {
      const box = el.getBoundingClientRect();
      const name = (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 30);
      return el.tagName.toLowerCase() + " '" + name + "' " + Math.round(box.width) + "x" + Math.round(box.height);
    });
})()`;

/**
 * On a touch screen every control is at least 44 px tall. Links inside text and
 * table rows (the whole row is the target) are exempt, as is anything covered by
 * an open dialog.
 */
async function touchTargets(page, label) {
  const small = await page.evaluate(SMALL_TARGETS);
  if (small.length) {
    findings.push({
      page: label,
      id: "touch-target",
      impact: "serious",
      help: "Touch targets at least 44 px",
      nodes: small,
      count: small.length,
    });
    results.push(`FAIL ${label} touch targets`);
  } else results.push(`ok   ${label} touch targets`);
}

async function visit(page, label, path) {
  await page.goto(`${APP}${path}`);
  await sleep(1200);
  await audit(page, label);
}

let page = await launch({ width: 1440, height: 1000 });
try {
  const owner = await createUser("a11y-owner");
  await page.goto(`${APP}/login`);
  await sleep(800);
  await audit(page, "login");
  await signIn(page, owner);
  await page.waitForUrl("/onboarding");
  await audit(page, "onboarding");
  await page.type("#organizationName", "Revize Přístupná");
  await page.type("#displayName", "Alena Přístupná");
  await page.clickText("Vytvořit firmu");
  await page.waitForText("Vítejte, Alena");
  await page.clickText("Vložit ukázková data", "button");
  await page.waitForText("Ukázková data jsou připravená.");
  await sleep(1500);
  const org = await organizationOf(owner);
  const [customer] = await selectRows("customers", `organization_id=eq.${org}&select=id`);
  const [site] = await selectRows(
    "sites",
    `organization_id=eq.${org}&select=id&order=name&limit=1`,
  );
  const [device] = await selectRows(
    "devices",
    `organization_id=eq.${org}&select=id&order=label_number&limit=1`,
  );
  const [defect] = await selectRows("defects", `organization_id=eq.${org}&select=id`);
  const [plan] = await selectRows(
    "floor_plans",
    `organization_id=eq.${org}&select=id,site_id&order=sort_order&limit=1`,
  );

  const pages = [
    ["dashboard", "/"],
    ["customers", "/customers"],
    ["customer", `/customers/${customer.id}`],
    ["customer-edit", `/customers/${customer.id}/edit`],
    ["site", `/sites/${site.id}`],
    ["devices", "/devices"],
    ["device", `/devices/${device.id}`],
    ["device-new", `/devices/new?site=${site.id}`],
    ["labels", `/devices/labels?site=${site.id}`],
    ["defects", "/defects"],
    ["defect", `/defects/${defect.id}`],
    ["defect-new", "/defects/new"],
    ["inspections", "/inspections"],
    ["device-types", "/device-types"],
    ["team", "/team"],
    ["settings", "/settings"],
    ["account", "/account"],
    ["graph", "/graph"],
    ["plans", "/plans"],
    ["import", "/import"],
    ["plan", `/sites/${plan.site_id}/plans/${plan.id}`],
  ];
  for (const [label, path] of pages) await visit(page, label, path);

  // The field: an inspection on the phone, its check and the search.
  await page.close();
  page = await launch({ width: 390, height: 844, mobile: true });
  // Touch: the pointer-coarse sizes apply, as on a real phone.
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await signIn(page, owner);
  await page.waitForText("Vítejte, Alena");
  await audit(page, "phone dashboard");
  await touchTargets(page, "phone dashboard");
  await page.goto(`${APP}/sites/${site.id}`);
  await page.clickText("Zahájit revizi");
  await page.waitForText("Zkontrolováno 0 z");
  await audit(page, "phone inspection");
  await touchTargets(page, "phone inspection");
  const run = new URL(await page.url()).pathname;
  await page.goto(`${APP}${run}/check/${device.id}`);
  await page.waitForText("Uloženo");
  await audit(page, "phone check");
  await touchTargets(page, "phone check");
  await page.click('header button[aria-label="Hledat"]');
  await sleep(500);
  await audit(page, "phone search");
  await touchTargets(page, "phone search");
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  for (const [label, path] of [
    ["phone devices", "/devices"],
    ["phone device", "/devices/" + device.id],
    ["phone defect", "/defects/" + defect.id],
    ["phone defect-new", "/defects/new"],
    ["phone customer", "/customers/" + customer.id],
    ["phone settings", "/settings"],
    ["phone plans", "/plans"],
    ["phone import", "/import"],
    ["phone plan", `/sites/${plan.site_id}/plans/${plan.id}`],
  ]) {
    await visit(page, label, path);
    await touchTargets(page, label);
  }
  await page.close();

  page = await launch({ width: 1440, height: 1000, dark: true });
  await signIn(page, owner);
  await page.waitForText("Vítejte, Alena");
  await sleep(800);
  await audit(page, "dark dashboard");
  await visit(page, "dark device", `/devices/${device.id}`);
} catch (error) {
  process.exitCode = 1;
  results.push(`FAIL run: ${error.message}`);
  await page.screenshot(`${OUT}/a11y-failure.png`);
} finally {
  if (findings.length) process.exitCode = 1;
  fs.writeFileSync(`${OUT}/a11y.json`, JSON.stringify(findings, null, 2));
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  for (const finding of findings)
    console.log(
      `\n[${finding.page}] ${finding.id} (${finding.impact}, ${finding.count}×): ${finding.help}\n  ${finding.nodes.join("\n  ")}`,
    );
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

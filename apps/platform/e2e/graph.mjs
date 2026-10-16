// Connection map walkthrough: selection, relations, expand/collapse, undo, hide,
// search, object tree, saved view, double-click and ?focus=.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
  cleanup,
  createUser,
  insertRows,
  organizationOf,
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

const page = await launch({ width: 1440, height: 950 });
const nodeCount = () => page.evaluate(`document.querySelectorAll(".react-flow__node").length`);
const inspectorTitle = () =>
  page.evaluate(`document.querySelector('[data-testid="graph-inspector"] h2')?.innerText ?? ""`);
const key = (k, extra = "") =>
  page.evaluate(
    `document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(k)}, bubbles: true ${extra} }))`,
  );
// Buttons inside nodes can sit outside the visible canvas; press them directly.
const press = (selector) =>
  page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const rect = (id) =>
  page.evaluate(
    `(() => { const r = document.querySelector('.react-flow__node[data-id="${id}"]').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
  );
const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const until = async (fn, expected, label) => {
  let value;
  for (let i = 0; i < 40; i++) {
    value = await fn();
    if (value === expected) return;
    await sleep(150);
  }
  throw new Error(`${label}: expected ${expected}, got ${value}`);
};

let ids;
try {
  const owner = await createUser("graph-owner");
  const tech = await createUser("graph-tech");

  await step("owner sets up the company and data", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Novák");
    await page.type("#displayName", "Petr Novák");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petr");
    const org = await organizationOf(owner);
    const [lipova, nemocnice] = await insertRows("customers", [
      { organization_id: org, name: "Bytové družstvo Lipová", company_id: "27082440" },
      { organization_id: org, name: "Nemocnice Na Výsluní", contact_person: "Marta Horáková" },
    ]);
    const [a, b, pavilon] = await insertRows("sites", [
      {
        organization_id: org,
        customer_id: lipova.id,
        name: "Lipová 12",
        access_notes: "Klíče u správce.",
      },
      { organization_id: org, customer_id: lipova.id, name: "Lipová 14" },
      { organization_id: org, customer_id: nemocnice.id, name: "Pavilon A" },
    ]);
    const locations = await insertRows("locations", [
      { organization_id: org, site_id: a.id, name: "Suterén", sort_order: 1 },
      { organization_id: org, site_id: a.id, name: "1. patro", sort_order: 2 },
      { organization_id: org, site_id: a.id, name: "2. patro", sort_order: 3 },
      { organization_id: org, site_id: pavilon.id, name: "Příjem", sort_order: 1 },
    ]);
    ids = {
      org,
      lipova: lipova.id,
      nemocnice: nemocnice.id,
      a: a.id,
      b: b.id,
      pavilon: pavilon.id,
      floors: locations.slice(0, 3).map((l) => l.id),
    };
  });

  await step("the map shows every object, connected", async () => {
    await page.click('aside a[href="/graph"]');
    await page.waitFor(".react-flow__node");
    await until(nodeCount, 9, "nodes");
    const edges = await page.evaluate(`document.querySelectorAll(".react-flow__edge").length`);
    if (edges !== 7) throw new Error(`edges ${edges}`);
    await page.screenshot(`${OUT}/g-01-map.png`);
  });

  await step("selecting a building lights its branch and opens the inspector", async () => {
    await page.click(`.react-flow__node[data-id="${ids.a}"]`);
    await until(inspectorTitle, "Lipová 12", "inspector");
    const faded = await page.evaluate(
      `getComputedStyle(document.querySelector('.react-flow__node[data-id="${ids.nemocnice}"] > div')).opacity`,
    );
    const lit = await page.evaluate(
      `getComputedStyle(document.querySelector('.react-flow__node[data-id="${ids.lipova}"] > div')).opacity`,
    );
    if (!(Number(faded) < 0.5) || Number(lit) !== 1) throw new Error(`opacity ${faded} / ${lit}`);
    await page.waitForText("Klíče u správce.");
  });

  await step("the relations tab moves to a related object", async () => {
    await page.evaluate(
      `[...document.querySelectorAll('[data-testid="graph-inspector"] [role=tab]')].find((tab) => tab.textContent.startsWith("Vazby")).setAttribute("data-e2e-tab", "")`,
    );
    await page.click("[data-e2e-tab]");
    await page.waitForText("Suterén");
    const relations = await page.evaluate(
      `document.querySelector('[data-testid="graph-inspector"] [role=tabpanel][data-state=active]').textContent`,
    );
    if (!relations.includes("Podřízené objekty (3)")) throw new Error(`relations: ${relations}`);
    await page.evaluate(
      `[...document.querySelectorAll('[data-testid="graph-inspector"] [role=tabpanel][data-state=active] button')].find((b) => b.textContent.startsWith("Bytové družstvo Lipová")).click()`,
    );
    await until(inspectorTitle, "Bytové družstvo Lipová", "inspector after relation");
  });

  await step("collapsing a building hides its locations, undo brings them back", async () => {
    await press('button[aria-label="Sbalit: Lipová 12"]');
    await until(nodeCount, 6, "after collapse");
    await page.click('button[aria-label="Zpět"]');
    await until(nodeCount, 9, "after undo");
    await page.click('button[aria-label="Znovu"]');
    await until(nodeCount, 6, "after redo");
    await key("z", ", ctrlKey: true");
    await until(nodeCount, 9, "after Ctrl+Z");
  });

  await step("a hidden customer disappears and comes back from the legend", async () => {
    await page.click(`.react-flow__node[data-id="${ids.nemocnice}"]`);
    await until(inspectorTitle, "Nemocnice Na Výsluní", "inspector");
    await key("Delete");
    await until(nodeCount, 6, "after hide");
    await page.waitForText("Skryto 1");
    await page.clickText("Zobrazit", "button");
    await until(nodeCount, 9, "after show");
  });

  await step("find jumps to matching objects", async () => {
    await page.clickText("Najít", "button");
    await page.waitFor("#graph-find");
    await page.type("#graph-find", "patro");
    await page.evaluate(
      `document.querySelector("#graph-find").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`,
    );
    await page.waitForText("1 z 2");
    await until(inspectorTitle, "1. patro", "first result");
    await page.evaluate(
      `document.querySelector("#graph-find").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`,
    );
    await until(inspectorTitle, "2. patro", "second result");
    await page.screenshot(`${OUT}/g-02-find.png`);
    await page.click('button[aria-label="Zavřít hledání"]');
  });

  await step("the object tree finds and focuses a location", async () => {
    await page.type('input[aria-label="Filtrovat objekty"]', "prijem");
    await page.waitForText("Příjem");
    await page.clickText("Příjem", "aside button");
    await until(inspectorTitle, "Příjem", "tree focus");
  });

  await step("the preview panel lists a building's locations and every object", async () => {
    await page.clickText("Náhled", "[role=toolbar] button");
    await page.waitFor('section[aria-label="Spodní panel"]');
    await press(`.react-flow__node[data-id="${ids.a}"]`);
    await until(inspectorTitle, "Lipová 12", "inspector");
    await page.waitForText("2. patro");
    const preview = await page.evaluate(
      `document.querySelector('section[aria-label="Spodní panel"] [role=tabpanel]').textContent`,
    );
    if (!preview.includes("Suterén") || !preview.includes("1. patro")) {
      throw new Error(`preview: ${preview.slice(0, 120)}`);
    }
    await page.clickText("Seznam objektů", "[role=tab]");
    await until(
      () =>
        page.evaluate(
          `document.querySelectorAll('section[aria-label="Spodní panel"] tbody tr').length`,
        ),
      9,
      "object list rows",
    );
    await page.evaluate(
      `[...document.querySelectorAll('section[aria-label="Spodní panel"] tbody tr')].find((row) => row.textContent.includes("Příjem")).click()`,
    );
    await until(inspectorTitle, "Příjem", "row focus");
    await page.screenshot(`${OUT}/g-04-preview.png`);
    await page.clickText("Náhled", "[role=toolbar] button");
  });

  await step("node style and group colours can be changed", async () => {
    const height = () =>
      page.evaluate(
        `Math.round(document.querySelector('.react-flow__node[data-id="${ids.b}"]').getBoundingClientRect().height / (new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a))`,
      );
    await page.clickText("Zobrazení", "button");
    await page.clickText("Karty", "[role=menuitemradio]");
    await until(height, 62, "card height");
    await page.screenshot(`${OUT}/g-05-cards.png`);
    await page.clickText("Zobrazení", "button");
    await page.clickText("Pruhy", "[role=menuitemradio]");
    await until(height, 20, "bar height");

    await page.clickText("Upravit barvy skupin", "button");
    await page.click('button[aria-label="Barva skupiny Budovy"]');
    await page.click('button[aria-label="#d99e0b"]');
    await until(
      () =>
        page.evaluate(
          `getComputedStyle(document.querySelector('.react-flow__node[data-id="${ids.b}"] > div')).backgroundColor`,
        ),
      "rgb(217, 158, 11)",
      "custom colour",
    );
    await page.clickText("Výchozí barvy", "button");
    await page.clickText("Hotovo", "button");
  });

  await step("keyboard shortcuts open with ?", async () => {
    await key("?");
    await page.waitForText("Klávesové zkratky");
    await page.waitForText("Přidat do výběru");
    await page.screenshot(`${OUT}/g-06-shortcuts.png`);
    await page.evaluate(
      `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`,
    );
    await sleep(400);
    const open = await page.evaluate(`!!document.querySelector('[role="dialog"]')`);
    if (open) throw new Error("dialog still open");
  });

  await step("the view is remembered and Clean restores the default", async () => {
    await press('button[aria-label="Sbalit: Lipová 12"]');
    await until(nodeCount, 6, "collapsed");
    await page.goto(`${APP}/graph`);
    await page.waitFor(".react-flow__node");
    await until(nodeCount, 6, "after reload");
    await page.clickText("Vyčistit", "button");
    await until(nodeCount, 9, "after clean");
  });

  await step("dragging a building moves its locations along; Layout puts them back", async () => {
    const before = await rect(ids.a);
    const childBefore = await rect(ids.floors[0]);
    await page.drag(center(before), { x: center(before).x, y: center(before).y + 120 });
    // The locations follow a frame or two after the drop: give them up to 2 s.
    let after = await rect(ids.a);
    let childAfter = await rect(ids.floors[0]);
    for (let i = 0; i < 20; i++) {
      if (Math.abs(childAfter.y - childBefore.y - (after.y - before.y)) <= 2) break;
      await sleep(100);
      after = await rect(ids.a);
      childAfter = await rect(ids.floors[0]);
    }
    if (Math.abs(after.y - before.y) < 60) throw new Error(`not moved: ${before.y} -> ${after.y}`);
    if (Math.abs(childAfter.y - childBefore.y - (after.y - before.y)) > 2) {
      throw new Error("child stayed behind");
    }
    await page.clickText("Rozložení", "button");
    await sleep(900);
    // Layout also fits the view, so compare with the sibling rather than the screen.
    const restored = await rect(ids.a);
    const sibling = await rect(ids.b);
    if (!(restored.y < sibling.y)) throw new Error("layout did not restore order");
  });

  await step("box selection picks several objects and Align lines them up", async () => {
    await key("v");
    const rects = await Promise.all(ids.floors.map(rect));
    const left = Math.min(...rects.map((r) => r.x)) - 24;
    const top = Math.min(...rects.map((r) => r.y)) - 8;
    const right = Math.max(...rects.map((r) => r.x + r.width)) + 24;
    const bottom = Math.max(...rects.map((r) => r.y + r.height)) + 4;
    await page.drag({ x: left, y: top }, { x: right, y: bottom });
    await page.waitForText("Vybráno 3 objekty");
    await page.clickText("Zarovnat", "button");
    await page.clickText("Do řádku", "[role=menuitem]");
    await sleep(500);
    const aligned = await Promise.all(ids.floors.map(rect));
    if (new Set(aligned.map((r) => Math.round(r.y))).size !== 1) throw new Error("not aligned");
    await page.click('button[aria-label="Zpět"]');
    await key("h");
    await key("Escape");
  });

  await step("double-clicking a node opens its detail page", async () => {
    await page.evaluate(
      `document.querySelector('.react-flow__node[data-id="${ids.b}"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))`,
    );
    await page.waitForUrl(`/sites/${ids.b}`);
    await page.waitForText("Lipová 14");
  });

  await step("?focus= from a detail page selects the object", async () => {
    await page.goto(`${APP}/customers/${ids.nemocnice}`);
    await page.clickText("Mapa vazeb", "a");
    await page.waitForUrl(`focus=${ids.nemocnice}`);
    await page.waitFor(".react-flow__node");
    await until(inspectorTitle, "Nemocnice Na Výsluní", "focused");
    await page.screenshot(`${OUT}/g-03-focus.png`);
  });

  await step("a technician sees the map without edit actions", async () => {
    await addMember(ids.org, tech, "technician", "Tomáš Technik");
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, tech);
    await page.waitForText("Vítejte, Tomáš");
    await page.goto(`${APP}/graph?focus=${ids.a}`);
    await page.waitFor(".react-flow__node");
    await until(inspectorTitle, "Lipová 12", "technician inspector");
    const edit = await page.evaluate(
      `[...document.querySelectorAll('[data-testid="graph-inspector"] a')].filter(a => a.innerText.trim() === "Upravit").length`,
    );
    if (edit) throw new Error("technician sees Edit");
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/g-failure.png`);
} finally {
  const logs = page.logs;
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

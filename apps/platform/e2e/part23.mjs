// Part 23 walkthrough (stage A): routes for technicians. The company's seat is
// set in Settings; a route for a technician starts there; buildings are added
// in a poor order, ordered by distance (the one without a location stays
// last), moved by keyboard, visited, removed; the visits are in the calendar;
// the map numbers the stops; the technician sees their route and not the
// owner's, sets a home in their account and their next route starts there;
// phone, dark mode and English.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
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

async function until(what, check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error(`timeout: ${what}`);
}

const KEYS = {
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
};
async function press(page, name) {
  const key = KEYS[name];
  for (const type of ["keyDown", "keyUp"])
    await page.send("Input.dispatchKeyEvent", {
      type,
      key: key.key,
      code: key.code,
      windowsVirtualKeyCode: key.keyCode,
      ...(key.text && type === "keyDown" ? { text: key.text } : {}),
    });
  await sleep(250);
}

const stopsOf = async (route) =>
  selectRows("route_plan_stops", `route_id=eq.${route}&select=id,site_id,position,visited_at,inspection_plan_id&order=position`);

// Around Prague; "E" has no location.
const SITES = {
  A: [50.1, 14.4],
  B: [50.05, 14.45],
  C: [50.12, 14.5],
  D: [50.03, 14.38],
  E: null,
};

const page = await launch({ width: 1440, height: 900 });
let org;
let owner;
let tech;
let routeId;
const site = {};
try {
  owner = await createUser("part23-owner");
  tech = await createUser("part23-tech");

  await step("setup: company, a technician, five buildings (one without a location)", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Trasy Servis");
    await page.type("#displayName", "Olga Majitelová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Olga", 30000);
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [customer] = await insertRows("customers", [{ organization_id: org, name: "SVJ Trasa" }]);
    const rows = await insertRows(
      "sites",
      Object.entries(SITES).map(([name, point]) => ({
        organization_id: org,
        customer_id: customer.id,
        name: `Budova ${name}`,
        ...(point ? { latitude: point[0], longitude: point[1] } : {}),
      })),
    );
    for (const row of rows) site[row.name.slice(-1)] = row.id;
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    await insertRows("devices", [{ organization_id: org, site_id: site.A, device_type_id: type.id, attributes: {} }]);
  });

  await step("the company's seat is set in Settings", async () => {
    await page.goto(`${APP}/settings#route-start`);
    await page.waitFor("#route-start-point");
    await page.type("#route-start-point", "50.0755, 14.4378");
    await page.evaluate(`document.querySelector("#route-start-point").form.requestSubmit()`);
    await page.waitForText("Uloženo.");
    const [row] = await selectRows("organizations", `id=eq.${org}&select=base_latitude,base_longitude`);
    if (row.base_latitude !== 50.0755 || row.base_longitude !== 14.4378) throw new Error(JSON.stringify(row));
  });

  await step("a route for the technician starts at the seat", async () => {
    await page.goto(`${APP}/routes`);
    await page.waitForText("Vzdálenosti jsou vzdušnou čarou");
    await page.clickText("Nová trasa", "button");
    await page.waitFor("#route-new-technician");
    await page.selectValue("#route-new-technician", tech.id);
    await page.type("#route-new-name", "Praha");
    await page.clickText("Vytvořit trasu", "button");
    await page.waitForUrl("/routes/", 20000);
    routeId = new URL(await page.url()).pathname.split("/").pop();
    await page.waitForText("Výchozí bod");
    const [route] = await selectRows("route_plans", `id=eq.${routeId}&select=start_kind,technician_id`);
    if (route.start_kind !== "company" || route.technician_id !== tech.id) throw new Error(JSON.stringify(route));
  });

  await step("buildings added in a poor order become the calendar's visits", async () => {
    await page.clickText("Přidat budovy", "button");
    await page.waitFor("#add-stops-search");
    await page.type("#add-stops-search", "budova");
    for (const name of ["C", "D", "B", "A", "E"]) {
      await page.evaluate(`[...document.querySelectorAll("[role=dialog] label")].find((l) => l.innerText.includes("Budova ${name}")).querySelector("button[role=checkbox]").click()`);
      await sleep(100);
    }
    await page.clickText("Přidat (5)", "button");
    await page.waitForText("Přidáno 5 budov.");
    await until("five stops", async () => (await stopsOf(routeId)).length === 5);
    const stops = await stopsOf(routeId);
    const order = stops.map((stop) => Object.keys(site).find((key) => site[key] === stop.site_id)).join("");
    if (order !== "CDBAE") throw new Error(`added as ${order}`);
    const plans = await selectRows(
      "inspection_plans",
      `id=in.(${stops.map((stop) => stop.inspection_plan_id).join(",")})&select=technician_id,planned_on`,
    );
    if (plans.length !== 5 || plans.some((plan) => plan.technician_id !== tech.id)) throw new Error(JSON.stringify(plans));
    await until("numbered markers", async () => (await page.evaluate(`document.querySelectorAll(".route-stop").length`)) === 4);
    if ((await page.evaluate(`document.querySelectorAll(".route-start").length`)) !== 1) throw new Error("no start marker");
    await page.screenshot(`${OUT}/p23-01-added.png`);
  });

  await step("ordered by distance: shorter, the building without a location last", async () => {
    const before = await page.evaluate(`document.querySelector("[data-total]").innerText`);
    await page.clickText("Seřadit podle vzdálenosti", "button");
    await page.waitForText("Seřazeno:");
    await until("saved order", async () => {
      const stops = await stopsOf(routeId);
      return stops.at(-1).site_id === site.E && stops[0].site_id !== site.C;
    });
    const after = await page.evaluate(`document.querySelector("[data-total]").innerText`);
    const km = (text) => Number(text.replace(/[^\d,]/g, "").replace(",", "."));
    if (!(km(after) < km(before))) throw new Error(`${before} -> ${after}`);
    await sleep(600);
    await page.screenshot(`${OUT}/p23-02-ordered.png`);
  });

  await step("a stop moves by keyboard; one is visited, one removed with its visit", async () => {
    const [first, second] = await stopsOf(routeId);
    await page.evaluate(`document.querySelector('li[data-stop="${first.id}"] button[aria-label^="Přesunout"]').focus()`);
    await press(page, "Space");
    await press(page, "ArrowDown");
    await press(page, "Space");
    await until("moved", async () => {
      const stops = await stopsOf(routeId);
      return stops[0].id === second.id && stops[1].id === first.id;
    });
    // The list is locked while the order is being saved.
    await until("list unlocked", async () =>
      page.evaluate(`!document.querySelector('li[data-stop="${first.id}"] button[role=checkbox]').disabled`),
    );
    await page.click(`li[data-stop="${first.id}"] button[role=checkbox]`);
    await until("visited", async () => (await stopsOf(routeId)).find((stop) => stop.id === first.id).visited_at);
    await page.click(`li[data-stop="${second.id}"] [data-select]`);
    await page.waitFor(`li[data-stop="${second.id}"] button[aria-label^="Odebrat"]`);
    await until("list unlocked again", async () =>
      page.evaluate(`!document.querySelector('li[data-stop="${second.id}"] button[aria-label^="Odebrat"]').disabled`),
    );
    await page.click(`li[data-stop="${second.id}"] button[aria-label^="Odebrat"]`);
    await until("removed", async () => (await stopsOf(routeId)).length === 4);
    const gone = await selectRows("inspection_plans", `id=eq.${second.inspection_plan_id}&select=id`);
    if (gone.length) throw new Error("the visit stayed in the calendar");
  });

  await step("the calendar shows the route's visits", async () => {
    await page.goto(`${APP}/calendar`);
    await page.waitForText("Budova E");
  });

  await step("the technician sees their route, not the owner's; their home starts the next one", async () => {
    await insertRows("route_plans", [
      { organization_id: org, technician_id: owner.id, planned_on: "2031-01-01", name: "Majitelova" },
    ]);
    const other = await launch({ width: 1280, height: 800 });
    try {
      await signIn(other, tech);
      await other.waitForText("Vítejte, Tomáš");
      await other.goto(`${APP}/routes`);
      await other.waitForText("Praha");
      const text = await other.evaluate(`document.body.innerText`);
      if (text.includes("Majitelova")) throw new Error("a technician sees the owner's route");
      await other.goto(`${APP}/account`);
      await other.waitFor("#home-point");
      await other.type("#home-point", "49.1951, 16.6068");
      await other.evaluate(`document.querySelector("#home-point").form.requestSubmit()`);
      await other.waitForText("Uloženo.");
      await other.goto(`${APP}/routes`);
      await other.clickText("Nová trasa", "button");
      await other.waitFor("#route-new-name");
      if (await other.evaluate(`Boolean(document.querySelector("#route-new-technician"))`))
        throw new Error("a technician chooses the technician");
      await other.clickText("Vytvořit trasu", "button");
      await other.waitForUrl("/routes/", 20000);
      const id = new URL(await other.url()).pathname.split("/").pop();
      const [route] = await selectRows("route_plans", `id=eq.${id}&select=start_kind,start_latitude,technician_id`);
      if (route.start_kind !== "home" || route.start_latitude !== 49.1951 || route.technician_id !== tech.id)
        throw new Error(JSON.stringify(route));
    } finally {
      await other.close();
    }
  });

  await step("on a phone: the stops and the map", async () => {
    const phone = await launch({ width: 390, height: 844, mobile: true });
    try {
      await signIn(phone, owner);
      await phone.waitForText("Vítejte, Olga");
      await phone.goto(`${APP}/routes/${routeId}`);
      await phone.waitForText("Zastávky");
      await phone.screenshot(`${OUT}/p23-03-phone-list.png`);
      await phone.clickText("Mapa", "[role=tab]");
      await until("map on the phone", async () => (await phone.evaluate(`document.querySelectorAll(".route-stop").length`)) === 3);
      await sleep(800);
      await phone.screenshot(`${OUT}/p23-04-phone-map.png`);
    } finally {
      await phone.close();
    }
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/routes/${routeId}`);
    await page.waitForText("Distances are in a straight line", 30000);
    await sleep(1200);
    await page.screenshot(`${OUT}/p23-05-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p23-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

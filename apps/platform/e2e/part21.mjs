// Part 21 walkthrough: the map of buildings with a traffic light. Buildings in
// every state (one without coordinates), the list sorted by urgency next to the
// map, a cluster, the panel of a building with "Start inspection", filters by
// state, customer and technician (remembered), the phone's map/list switch,
// dark mode and English. One sign-in (Supabase limits sign-ins per address).
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

/** A calendar day `days` from today (UTC is close enough a few days away). */
const dayFrom = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** The same day `months` earlier: the inspection that makes a device due then. */
const monthsBefore = (iso, months) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
};

/** Names of the buildings in the list beside the map, top to bottom. */
const listed = (page) =>
  page.evaluate(
    `[...document.querySelectorAll("[data-site]")].map((b) => b.querySelector(".font-medium").innerText)`,
  );

const page = await launch({ width: 1440, height: 900 });
try {
  const owner = await createUser("part21-owner");
  const technician = await createUser("part21-tech");
  let org;
  const site = {};

  await step("setup: buildings in every state, one without coordinates", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Mapa");
    await page.type("#displayName", "Marta Mapová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Marta", 30000);
    org = await organizationOf(owner);
    await addMember(org, technician, "technician", "Tomáš Technik");
    const [x, y] = await insertRows("customers", [
      { organization_id: org, name: "SVJ Praha" },
      { organization_id: org, name: "Město Brno" },
    ]);
    const rows = await insertRows("sites", [
      { organization_id: org, customer_id: x.id, name: "Nemocnice Homolka", latitude: 50.0753, longitude: 14.3577 },
      { organization_id: org, customer_id: x.id, name: "Bytový dům Karlín", latitude: 50.0925, longitude: 14.4511 },
      { organization_id: org, customer_id: x.id, name: "Hala Karlín", latitude: 50.0929, longitude: 14.4519 },
      { organization_id: org, customer_id: y.id, name: "Úřad Brno", latitude: 49.1951, longitude: 16.6068 },
      { organization_id: org, customer_id: y.id, name: "Sklad Ostrava", latitude: 49.8209, longitude: 18.2625 },
      { organization_id: org, customer_id: x.id, name: "Garáže Kladno" },
    ]);
    for (const row of rows) site[row.name] = row.id;
    const [type] = await selectRows(
      "device_types",
      `organization_id=eq.${org}&select=id,inspection_interval_months`,
    );
    const due = (name, days) => ({
      organization_id: org,
      site_id: site[name],
      device_type_id: type.id,
      last_inspection_on: monthsBefore(dayFrom(days), type.inspection_interval_months),
    });
    await insertRows("devices", [
      due("Nemocnice Homolka", -3),
      due("Bytový dům Karlín", 10),
      due("Hala Karlín", 200),
      due("Úřad Brno", 200),
      due("Garáže Kladno", -20),
    ]);
    await insertRows("inspection_plans", [
      {
        organization_id: org,
        site_id: site["Úřad Brno"],
        planned_on: dayFrom(5),
        technician_id: technician.id,
      },
    ]);
  });

  await step("the list puts the most urgent first, the map draws points and a cluster", async () => {
    await page.goto(`${APP}/map`);
    await page.waitForText("Mapa budov");
    await page.waitFor(".maplibregl-canvas", 30000);
    const names = await listed(page);
    if (names[0] !== "Nemocnice Homolka" || names[1] !== "Bytový dům Karlín")
      throw new Error(`order ${names.join(", ")}`);
    if (names.includes("Garáže Kladno")) throw new Error("a building without a point is listed");
    await page.waitForText("Bez polohy (1)");
    await page.waitForText("Doplnit souřadnice");
    await page.waitForText("Po termínu nebo kritická závada");
    // The three buildings in Prague are a cluster at this zoom, as urgent as the
    // worst of them (the overdue hospital: a red diamond).
    await until("a cluster", () =>
      page.evaluate(
        `[...document.querySelectorAll(".site-cluster")].some((c) => c.textContent === "◆ 3")`,
      ),
    );
    await page.screenshot(`${OUT}/p21-01-map.png`);
    // A click on the cluster zooms to the streets of Karlín (our own base map).
    await page.evaluate(`[...document.querySelectorAll(".site-cluster")].find((c) => c.textContent === "◆ 3").click()`);
    await until("the cluster opens", () =>
      page.evaluate(`![...document.querySelectorAll(".site-cluster")].some((c) => c.textContent === "◆ 3")`),
    );
    await sleep(2500);
    await page.screenshot(`${OUT}/p21-01b-streets.png`);
  });

  await step("a building from the list opens its panel; the inspection starts from it", async () => {
    await page.click(`[data-site="${site["Bytový dům Karlín"]}"]`);
    await page.waitFor("#map-panel-title");
    const panel = await page.evaluate(
      `document.querySelector("[aria-labelledby=map-panel-title]").innerText`,
    );
    if (!panel.includes("Bytový dům Karlín") || !panel.includes("Brzy termín"))
      throw new Error(`panel ${panel}`);
    await page.screenshot(`${OUT}/p21-02-panel.png`);
    await page.clickText("Zahájit kontrolu", "button");
    await page.waitForText("Zkontrolováno 0 z 1", 30000);
  });

  await step("filters by state, customer and technician, kept in the address and remembered", async () => {
    await page.goto(`${APP}/map`);
    await page.waitFor("#map-status");
    await page.selectValue("#map-status", "critical");
    await until("the critical filter", async () => (await page.url()).includes("status=critical"));
    await until("only urgent buildings", async () => {
      const names = await listed(page);
      return names.length === 1 && names[0] === "Nemocnice Homolka";
    });
    await page.selectValue("#map-status", "");
    await until("no state filter", async () => !(await page.url()).includes("status="));
    await page.selectValue("#map-technician", technician.id);
    await until("the technician's building", async () => {
      const names = await listed(page);
      return names.length === 1 && names[0] === "Úřad Brno";
    });
    // Back to the map without filters: the last ones come back.
    await page.goto(`${APP}/map`);
    await until("remembered filters", async () => (await page.url()).includes("technician="));
    await page.selectValue("#map-technician", "");
    await until("no filters", async () => (await page.url()).endsWith("/map"));
    await until("all buildings", async () => (await listed(page)).length === 5);
  });

  await step("on a phone: the map or the list", async () => {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await page.goto(`${APP}/map`);
    await page.waitFor(".maplibregl-canvas", 30000);
    await until("the cluster on the phone's map", () =>
      page.evaluate(`document.querySelectorAll(".site-cluster").length > 0`),
    );
    await sleep(1000);
    await page.screenshot(`${OUT}/p21-03-phone-map.png`);
    await page.clickText("Seznam (6)", "button");
    await page.waitForText("Nemocnice Homolka");
    await page.screenshot(`${OUT}/p21-04-phone-list.png`);
    await page.send("Emulation.clearDeviceMetricsOverride");
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/map`);
    await page.waitForText("Building map", 30000);
    await page.waitForText("Overdue or a critical defect");
    await page.waitFor(".maplibregl-canvas", 30000);
    await sleep(1500);
    await page.screenshot(`${OUT}/p21-05-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p21-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

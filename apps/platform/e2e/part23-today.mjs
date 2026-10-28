// Part 23 walkthrough (stage B): the tip "due soon nearby" offers the building
// near a stop that is due within 30 days (not the one due later, not the far
// one) and adds it; the calendar marks the route's visits and links to the
// route; on the technician's phone "My work" leads to today's plan, which is
// kept in the phone: a stop marked visited without a signal waits, survives a
// reload without a signal, and is sent with its time once the signal returns;
// the offline page links to the plan; dark mode and English.
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

/** The company's today (Prague). */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());
/** A last inspection so that the next one falls about `days` from today. */
function lastFor(days, months) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

const stopsOf = async (route) =>
  selectRows("route_plan_stops", `route_id=eq.${route}&select=id,site_id,position,visited_at&order=position`);

const page = await launch({ width: 1440, height: 900 });
let org;
let owner;
let tech;
let routeId;
const site = {};
try {
  owner = await createUser("part23b-owner");
  tech = await createUser("part23b-tech");

  await step("setup: a route for today, buildings near it due soon, later and far away", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Trasy Dnes");
    await page.type("#displayName", "Olga Majitelová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Olga", 30000);
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [customer] = await insertRows("customers", [{ organization_id: org, name: "SVJ Dnes" }]);
    const points = {
      first: [50.1, 14.4],
      second: [50.12, 14.42],
      near: [50.104, 14.404],
      later: [50.121, 14.421],
      far: [49.5, 17.0],
    };
    const rows = await insertRows(
      "sites",
      Object.entries(points).map(([name, [latitude, longitude]]) => ({
        organization_id: org,
        customer_id: customer.id,
        name: `Budova ${name}`,
        latitude,
        longitude,
      })),
    );
    for (const row of rows) site[row.name.split(" ")[1]] = row.id;
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id,inspection_interval_months`);
    const months = type.inspection_interval_months;
    await insertRows("devices", [
      { organization_id: org, site_id: site.first, device_type_id: type.id, attributes: {}, last_inspection_on: lastFor(200, months) },
      { organization_id: org, site_id: site.near, device_type_id: type.id, attributes: {}, last_inspection_on: lastFor(10, months) },
      { organization_id: org, site_id: site.later, device_type_id: type.id, attributes: {}, last_inspection_on: lastFor(90, months) },
      { organization_id: org, site_id: site.far, device_type_id: type.id, attributes: {}, last_inspection_on: lastFor(5, months) },
    ]);
    const [route] = await insertRows("route_plans", [
      { organization_id: org, technician_id: tech.id, planned_on: today, name: "Dnešní" },
    ]);
    routeId = route.id;
    await insertRows("route_plan_stops", [
      { organization_id: org, route_id: routeId, site_id: site.first, position: 1, note: "Klíče u správce" },
      { organization_id: org, route_id: routeId, site_id: site.second, position: 2, minutes: 45 },
    ]);
  });

  await step("the tip offers the building due soon nearby, and adds it", async () => {
    await page.goto(`${APP}/routes/${routeId}`);
    await page.waitForText("Poblíž končí revize");
    await until("suggestions", async () => (await page.evaluate(`document.querySelectorAll("[data-nearby]").length`)) > 0);
    const offered = await page.evaluate(`[...document.querySelectorAll("[data-nearby]")].map((li) => li.dataset.nearby)`);
    if (offered.length !== 1 || offered[0] !== site.near) throw new Error(`offered ${JSON.stringify(offered)}`);
    await until("numbered markers", async () => (await page.evaluate(`document.querySelectorAll(".route-stop").length`)) === 2);
    await sleep(1500);
    await page.screenshot(`${OUT}/p23b-01-nearby.png`);
    await page.click(`[data-nearby="${site.near}"] button`);
    await until("added", async () => (await stopsOf(routeId)).some((stop) => stop.site_id === site.near));
    await until("no longer offered", async () => (await page.evaluate(`document.querySelectorAll("[data-nearby]").length`)) === 0);
  });

  await step("the calendar marks the route's visit and opens the route", async () => {
    await page.goto(`${APP}/calendar`);
    await page.waitFor('svg[data-icon="route"][aria-label="Zastávka trasy"]');
    await page.evaluate(`document.querySelector('svg[data-icon="route"][aria-label="Zastávka trasy"]').closest("button").click()`);
    await page.waitForText("Otevřít trasu");
    await page.clickText("Otevřít trasu", "a");
    await page.waitForUrl(`/routes/${routeId}`);
  });

  const phone = await launch({ width: 390, height: 844, mobile: true });
  try {
    await step("on the technician's phone: My work leads to today's plan, kept in the phone", async () => {
      await signIn(phone, tech);
      await phone.waitForText("Vítejte, Tomáš");
      await phone.waitForText("Dnešní trasa Dnešní: navštíveno 0 z 3");
      await phone.clickText("Dnešní trasa Dnešní: navštíveno 0 z 3", "a");
      await phone.waitForUrl("/routes/today");
      await phone.waitForText("Klíče u správce");
      await until(
        "kept in the phone",
        async () =>
          phone.evaluate(
            `navigator.serviceWorker.controller !== null && caches.open("sparxdeck-pages-v1").then((c) => c.match("/routes/today")).then(Boolean)`,
          ),
        30000,
      );
      // Loaded again, the service worker serves the page and keeps its files.
      await phone.goto(`${APP}/routes/today`);
      await phone.waitForText("Klíče u správce");
      await until("files kept by the service worker", () =>
        phone.evaluate(`caches.open("sparxdeck-static-v1").then((c) => c.keys()).then((k) => k.length > 10)`),
      );
      await phone.screenshot(`${OUT}/p23b-02-today.png`);
    });

    let firstStop;
    let markedAt;
    await step("without a signal a stop is marked visited; it waits, also after a reload", async () => {
      [firstStop] = await stopsOf(routeId);
      await phone.setOffline(true);
      await until("offline shown", async () => (await phone.evaluate(`document.body.innerText`)).includes("Bez signálu"));
      markedAt = Date.now();
      await phone.click(`li[data-stop="${firstStop.id}"] button[aria-pressed]`);
      await phone.waitForText("1 označení čeká na odeslání.");
      await phone.goto(`${APP}/routes/today`);
      await phone.waitForText("Klíče u správce", 20000);
      await phone.waitForText("Čeká na odeslání");
      const pressed = await phone.evaluate(`document.querySelector('li[data-stop="${firstStop.id}"] button[aria-pressed]').getAttribute("aria-pressed")`);
      if (pressed !== "true") throw new Error("the mark is gone after the reload");
      if ((await stopsOf(routeId))[0].visited_at) throw new Error("sent without a signal");
      await phone.screenshot(`${OUT}/p23b-03-offline.png`);
    });

    await step("the offline page links to today's plan", async () => {
      await phone.goto(`${APP}/customers`);
      await phone.waitForText("Dnešní plán", 20000);
      if (!(await phone.evaluate(`Boolean(document.querySelector('a[href="/routes/today"]'))`))) throw new Error("no link");
    });

    await step("with the signal back the mark is sent with its own time", async () => {
      await phone.goto(`${APP}/routes/today`).catch(() => undefined);
      await phone.waitForText("Klíče u správce", 20000);
      await sleep(5000);
      await phone.setOffline(false);
      await phone.evaluate(`window.dispatchEvent(new Event("online"))`);
      await until("sent", async () => (await stopsOf(routeId))[0].visited_at, 30000);
      const visitedAt = new Date((await stopsOf(routeId))[0].visited_at).getTime();
      if (Math.abs(visitedAt - markedAt) > 4000) throw new Error(`sent with ${new Date(visitedAt).toISOString()}, marked ${new Date(markedAt).toISOString()}`);
      await until("nothing waits", async () => !(await phone.evaluate(`document.body.innerText`)).includes("čeká na odeslání"));
    });

    await step("dark mode and English", async () => {
      await phone.evaluate(`localStorage.setItem("theme", "dark")`);
      await phone.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
      await phone.goto(`${APP}/routes/today`);
      await phone.waitForText("Today's plan", 30000);
      await sleep(800);
      await phone.screenshot(`${OUT}/p23b-04-dark-en.png`);
    });
  } finally {
    const logs = [...phone.logs];
    await phone.close();
    if (logs.length) console.log(`phone console:\n${logs.join("\n")}`);
  }
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p23b-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

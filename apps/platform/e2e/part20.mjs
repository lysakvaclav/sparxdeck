// Part 20 walkthrough: the owner gives a building its point (typed, and from the
// phone's location), starts an inspection and scans labels on a phone: at the
// building, far away (with an explanation), without a position, and without a
// signal (sent once it's back). The office sees the inspection in the filter of
// mismatching locations; Settings has the switch. Dark mode and English.
// One sign-in (Supabase limits sign-ins per address).
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import { launch, sleep } from "./driver.mjs";
import {
  APP,
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

// Prague, Old Town Square; Brno for "far away".
const BUILDING = { latitude: 50.087465, longitude: 14.421254 };
const NEAR = { latitude: 50.0876, longitude: 14.4214, accuracy: 15 };
const FAR = { latitude: 49.1951, longitude: 16.6068, accuracy: 10 };

const page = await launch({ width: 390, height: 844, mobile: true });
try {
  const owner = await createUser("part20-owner");
  let site;
  let devices;
  let inspectionUrl;
  let inspectionId;

  /** The phone's position from now on (null: the phone can't find one). */
  const position = async (coords) => {
    if (coords) await page.send("Emulation.setGeolocationOverride", coords);
    else await page.send("Emulation.setGeolocationOverride", {});
  };
  const scan = async (label) => {
    await page.goto(`${APP}${inspectionUrl}`);
    await page.waitForText("Skenovat štítek");
    await page.clickText("Skenovat štítek");
    await page.waitFor("#scanner-number");
    await page.type("#scanner-number", label);
    await page.clickText("Otevřít", "button");
  };
  const itemOf = async (device) =>
    (
      await selectRows(
        "inspection_items",
        `inspection_id=eq.${inspectionId}&device_id=eq.${device}&select=location_state,location_distance_m,scan_location_error,scan_accuracy_m,location_note`,
      )
    )[0];

  await step("setup: a company with a building of four devices", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Poloha");
    await page.type("#displayName", "Petra Polohová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petra", 30000);
    const org = await organizationOf(owner);
    const [customer] = await insertRows("customers", [
      { organization_id: org, name: "SVJ Staroměstské" },
    ]);
    [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Staroměstské nám. 1" },
    ]);
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    devices = await insertRows(
      "devices",
      [1, 2, 3, 4].map(() => ({ organization_id: org, site_id: site.id, device_type_id: type.id })),
    );
    devices.sort((a, b) => a.label_number - b.label_number);
    await page.send("Browser.grantPermissions", {
      origin: new URL(APP).origin,
      permissions: ["geolocation"],
    });
  });

  await step("a building without a point says so; the form takes the phone's location", async () => {
    await page.goto(`${APP}/sites/${site.id}`);
    await page.waitForText("Bez souřadnic, polohu skenů nejde porovnat.");
    await page.goto(`${APP}/sites/${site.id}/edit`);
    await page.waitForText("Poloha budovy");
    // A malformed point is refused in the form.
    await page.type("#coordinates", "Staroměstské náměstí");
    await page.clickText("Uložit", "button");
    await page.waitForText("Souřadnice nejsou ve správném tvaru.");
    await position({ ...BUILDING, accuracy: 8 });
    await page.clickText("Použít moji polohu", "button");
    await page.waitForText("Poloha telefonu s přesností ±8 m.");
    const typed = await page.evaluate(`document.getElementById("coordinates").value`);
    if (typed !== "50.087465, 14.421254") throw new Error(`coordinates ${typed}`);
    await page.evaluate(`(() => {
      const el = document.getElementById("radius");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "200");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await page.screenshot(`${OUT}/p20-01-site-form.png`);
    await page.clickText("Uložit", "button");
    await page.waitForUrl(`/sites/${site.id}`);
    await page.waitForText("50.087465, 14.421254");
    await page.waitForText("poloměr 200 m");
    const [row] = await selectRows(
      "sites",
      `id=eq.${site.id}&select=latitude,longitude,location_radius_m,location_source`,
    );
    if (row.location_radius_m !== 200 || row.location_source !== "device")
      throw new Error(`site ${JSON.stringify(row)}`);
  });

  await step("the first scan explains why; a scan at the building matches", async () => {
    await page.goto(`${APP}/sites/${site.id}`);
    await page.clickText("Zahájit revizi");
    await page.waitForText("Zkontrolováno 0 z 4", 30000);
    inspectionUrl = new URL(await page.url()).pathname;
    inspectionId = inspectionUrl.split("/")[2];
    await position(NEAR);
    await page.clickText("Skenovat štítek");
    await page.waitForText("Poloha při skenu");
    await page.waitForText("Poloha se ukládá jen v okamžiku skenu");
    await page.screenshot(`${OUT}/p20-02-intro.png`);
    await page.clickText("Rozumím, skenovat", "button");
    await page.waitFor("#scanner-number");
    await page.type("#scanner-number", String(devices[0].label_number));
    await page.clickText("Otevřít", "button");
    await page.waitForUrl(`${inspectionUrl}/check/${devices[0].id}`);
    await page.waitForText("Poloha odpovídá budově", 30000);
    await page.screenshot(`${OUT}/p20-03-matches.png`);
    const item = await itemOf(devices[0].id);
    if (item.location_state !== "matches" || item.scan_accuracy_m !== 15)
      throw new Error(`item ${JSON.stringify(item)}`);
  });

  await step("a scan far away doesn't match; the technician explains it", async () => {
    await position(FAR);
    await scan(String(devices[1].label_number));
    await page.waitForUrl(`${inspectionUrl}/check/${devices[1].id}`);
    await page.waitForText("Poloha neodpovídá budově", 30000);
    await page.waitForText("km od bodu budovy");
    await page.clickText("Vysvětlit polohu", "button");
    await page.waitFor("#location-note");
    await page.type("#location-note", "Hasicí přístroj převezen do dílny");
    await page.clickText("Uložit", "button");
    await page.waitForText("Vysvětlení je uložené.");
    await page.waitForText("Hasicí přístroj převezen do dílny");
    await page.screenshot(`${OUT}/p20-04-mismatch.png`);
    const item = await itemOf(devices[1].id);
    if (item.location_state !== "mismatch" || item.location_distance_m < 150_000)
      throw new Error(`item ${JSON.stringify(item)}`);
    if (item.location_note !== "Hasicí přístroj převezen do dílny")
      throw new Error(`note ${item.location_note}`);
  });

  await step("without a position the check goes on, not determined, with the reason", async () => {
    await position(null);
    await scan(String(devices[2].label_number));
    await page.waitForUrl(`${inspectionUrl}/check/${devices[2].id}`);
    await page.waitForText("Poloha nezjištěna", 40000);
    await page.waitForText("poloha nebyla dostupná");
    const item = await itemOf(devices[2].id);
    if (item.location_state !== "unknown" || item.scan_location_error !== "unavailable")
      throw new Error(`item ${JSON.stringify(item)}`);
  });

  await step("without a signal the position waits in the phone and goes once back", async () => {
    await position(NEAR);
    await page.goto(`${APP}${inspectionUrl}`);
    await page.waitForText("Skenovat štítek");
    await page.setOffline(true);
    await page.clickText("Skenovat štítek");
    await page.waitFor("#scanner-number");
    await page.type("#scanner-number", String(devices[3].label_number));
    await page.clickText("Otevřít", "button");
    await page.waitForText("Poloha čeká na odeslání", 20000);
    await page.screenshot(`${OUT}/p20-05-offline.png`);
    if ((await itemOf(devices[3].id))?.location_state) throw new Error("sent without a signal");
    await page.setOffline(false);
    await until(
      "the position arrives",
      async () => (await itemOf(devices[3].id))?.location_state === "matches",
      40000,
    );
    await page.waitForText("Poloha odpovídá budově", 30000);
  });

  await step("the office finds the inspection among mismatching locations", async () => {
    await page.goto(`${APP}/inspections?location=mismatch`);
    await page.waitForText("Staroměstské nám. 1");
    await page.goto(`${APP}/inspections/${inspectionId}`);
    await page.waitForText("Poloha neodpovídá budově");
    await page.goto(`${APP}/settings`);
    await page.waitForText("Ukládat polohu telefonu při skenu štítků");
  });

  await step("dark mode and English", async () => {
    await page.evaluate(`localStorage.setItem("theme", "dark")`);
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    // A slow first render may get the copy the service worker keeps (Czech, the
    // list): load again until the server's English page arrives.
    await until(
      "the English page",
      async () => {
        await page.goto(`${APP}${inspectionUrl}`);
        await sleep(1500);
        return page.evaluate(
          `document.body.innerText.includes("Location doesn't match the building")`,
        );
      },
      90000,
    );
    await page.screenshot(`${OUT}/p20-06-dark-en.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p20-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

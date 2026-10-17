// Part 13 walkthrough: floor plans. Sample data brings plans of two floors; an
// owner uploads a two-page PDF (second page), places devices by tapping the plan,
// drags and nudges them, moves one to another plan and takes one off, renames,
// replaces and deletes a plan; the device page shows its spot; the plan downloads
// as a PDF; a technician only looks; on a phone the inspection shows on the plan
// what's left; another company gets a 404; removing sample data removes plan files.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import sharp from "sharp";
import { launch, sleep } from "./driver.mjs";
import {
  APP,
  addMember,
  cleanup,
  createUser,
  downloadFile,
  filesIn,
  organizationOf,
  selectRows,
  signIn,
  writeTestLogo,
  writeTestPlanPdf,
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

/** Polls `check` (async, returns a value or null) until it returns something. */
async function until(what, check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`timeout: ${what}`);
}

/** Waits until no dialog is open (closing ones still catch clicks). */
const noDialog = (page) =>
  until("dialogs closed", () =>
    page.evaluate(`!document.querySelector("[role=dialog], [role=alertdialog]")`),
  );

/** A mouse click at a point of the screen. */
async function clickAt(page, x, y) {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  await sleep(300);
}

/** The plan viewer's box on screen. */
const planBox = (page) =>
  page.evaluate(`(() => {
    const el = document.querySelector('[aria-roledescription="map"]');
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);

/** Markers drawn on the plan (after the image loaded). */
const markerIds = (page) =>
  page.evaluate(`[...document.querySelectorAll("[data-marker]")].map((m) => m.dataset.marker)`);

/** Clicks the button with `text` in the device list row of `label`. */
async function rowButton(page, label, text) {
  const found = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll("li")].find((li) => li.innerText.split("\\n")[0].trim() === ${JSON.stringify(label)});
    const button = row && [...row.querySelectorAll("button")].find((b) => b.innerText.trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.setAttribute("data-e2e-row", "1");
    return true;
  })()`);
  if (!found) throw new Error(`no "${text}" for ${label}`);
  await page.click('[data-e2e-row="1"]');
  await page.evaluate(`document.querySelector('[data-e2e-row]')?.removeAttribute("data-e2e-row")`);
}

const placement = async (deviceId) =>
  (await selectRows("device_placements", `device_id=eq.${deviceId}&select=floor_plan_id,x,y`))[0] ??
  null;

const page = await launch({ width: 1440, height: 1000 });
let phone;
let other;
try {
  const owner = await createUser("plans-owner");
  const technician = await createUser("plans-tech");
  const stranger = await createUser("plans-other");
  let org;
  let siteId;
  let plans;
  let devices;
  const byLabel = (label) => devices.find((device) => device.label_number === label);

  await step("sample data brings floor plans of two floors with devices on them", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize Plán");
    await page.type("#displayName", "Petra Plánová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Petra");
    await page.clickText("Vložit ukázková data", "button");
    await page.waitForText("Ukázková data jsou připravená.");
    org = await organizationOf(owner);
    plans = await selectRows(
      "floor_plans",
      `organization_id=eq.${org}&select=id,name,site_id,image_path,image_width,image_height&order=sort_order`,
    );
    if (plans.map((plan) => plan.name).join("|") !== "Přízemí|1. patro")
      throw new Error(`sample plans ${JSON.stringify(plans.map((plan) => plan.name))}`);
    siteId = plans[0].site_id;
    devices = await selectRows(
      "devices",
      `site_id=eq.${siteId}&select=id,label_number,location_id&order=label_number`,
    );
    const placed = await selectRows(
      "device_placements",
      `organization_id=eq.${org}&select=device_id`,
    );
    if (placed.length !== 4) throw new Error(`sample placements ${placed.length}`);
  });

  await step("the building lists its floor plans with the devices on them", async () => {
    await page.goto(`${APP}/sites/${siteId}`);
    await page.waitForText("Půdorysy");
    // Tiles: name, and the floor only when it differs from the name.
    const tiles = await until("plan tiles", async () => {
      const found = await page.evaluate(
        `[...document.querySelectorAll("#plans li")].map((li) => li.innerText.replace(/\\s+/g, " ").trim())`,
      );
      return found.length === 2 ? found : null;
    });
    if (tiles.join("|") !== "Přízemí 2 zařízení|1. patro 2 zařízení")
      throw new Error(`tiles ${JSON.stringify(tiles)}`);
    await page.screenshot(`${OUT}/p13-01-site-plans.png`);
  });

  await step("the sidebar leads to all floor plans; the search narrows them", async () => {
    await page.click('a[href="/plans"]');
    await page.waitForUrl("/plans");
    await page.waitForText("2 plány");
    await page.waitForText("Ukázka – Bytové družstvo Lipová");
    await page.goto(`${APP}/plans?q=patro`);
    await page.waitForText("1 plán");
    await page.goto(`${APP}/plans?q=nic-takoveho`);
    await page.waitForText("Nic nenalezeno");
    await page.goto(`${APP}/plans`);
    await page.waitForText("2 plány");
    await page.screenshot(`${OUT}/p13-01b-all-plans.png`);
  });

  await step("a plan shows its devices; the panel lists what isn't placed", async () => {
    await page.click(`a[href="/sites/${siteId}/plans/${plans[0].id}"]`);
    await page.waitForUrl(`/plans/${plans[0].id}`);
    await until("two markers", async () => ((await markerIds(page)).length === 2 ? true : null));
    await page.waitForText("Neumístěná zařízení");
    await page.waitForText("900001"); // basement devices aren't on a plan
    // A marker opens the device's details beside the plan.
    await page.click(`[data-marker="${byLabel(900003).id}"]`);
    await page.waitForText("Otevřít zařízení");
    await page.screenshot(`${OUT}/p13-02-plan.png`);
  });

  let basementPlan;
  await step("an owner uploads the second page of a PDF as the basement plan", async () => {
    const pdf = writeTestPlanPdf(OUT);
    await page.goto(`${APP}/sites/${siteId}`);
    await page.clickText("Nahrát půdorys");
    await page.waitForText("Soubor s plánem");
    await page.setFile('input[type=file][accept*="pdf"]', pdf);
    await page.waitFor("#plan-page", 30000);
    const options = await page.evaluate(
      `[...document.querySelectorAll("#plan-page option")].map((o) => o.textContent)`,
    );
    if (options.join("|") !== "Strana 1 z 2|Strana 2 z 2")
      throw new Error(`pages ${JSON.stringify(options)}`);
    await page.selectValue("#plan-page", "2");
    await page.waitFor('img[alt="Náhled plánu"][data-page="2"]', 30000);
    const basement = devices.find((device) => device.label_number === 900001).location_id;
    await page.selectValue("#plan-location", basement);
    const name = await page.evaluate(`document.querySelector("#plan-name").value`);
    if (name !== "Suterén") throw new Error(`name from the floor: ${name}`);
    await page.screenshot(`${OUT}/p13-03-upload.png`);
    await page.click('[role=dialog] button[type="submit"]');
    await page.waitForUrl("/plans/", 30000);
    basementPlan = await until(
      "the new plan",
      async () =>
        (
          await selectRows(
            "floor_plans",
            `organization_id=eq.${org}&name=eq.Suterén&select=id,image_path,image_width,image_height,location_id`,
          )
        )[0],
    );
    if (!basementPlan.image_path.startsWith(`${org}/floor-plans/${siteId}/`))
      throw new Error(`stored at ${basementPlan.image_path}`);
    // A PDF page is rendered at the full stored size (842 × 595 pt → 4096 px wide).
    if (basementPlan.image_width !== 4096 || basementPlan.image_height !== 2894)
      throw new Error(`size ${basementPlan.image_width}×${basementPlan.image_height}`);
    if (basementPlan.location_id !== basement) throw new Error("plan without its floor");
    // Page 2 has a wall down the middle (x = 420 of 842 pt); page 1 is white there.
    const { data, info } = await sharp(await downloadFile("org-assets", basementPlan.image_path))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const at = (x, y) =>
      data[(Math.round(y * info.height) * info.width + Math.round(x * info.width)) * info.channels];
    if (at(420 / 842, 0.25) > 128 || at(0.75, 0.25) < 200)
      throw new Error("the stored plan isn't page 2");
  });

  await step("an owner places a device by tapping the plan", async () => {
    await until("plan image", () =>
      page.evaluate(
        `[...document.querySelectorAll('[aria-roledescription="map"] img')].some((i) => i.complete && i.naturalWidth > 0)`,
      ),
    );
    await rowButton(page, "900001", "Umístit");
    await page.waitForText("Klepněte na plán tam, kde je zařízení 900001.");
    const box = await planBox(page);
    await clickAt(page, box.x + box.width * 0.5, box.y + box.height * 0.5);
    const spot = await until("saved placement", () => placement(byLabel(900001).id));
    if (spot.floor_plan_id !== basementPlan.id) throw new Error("placed on another plan");
    if (Math.abs(spot.x - 0.5) > 0.08 || Math.abs(spot.y - 0.5) > 0.08)
      throw new Error(`placed at ${spot.x}, ${spot.y}`);
    await until("marker", async () =>
      (await markerIds(page)).includes(byLabel(900001).id) ? true : null,
    );
  });

  await step("in edit mode a device is dragged, then nudged with the arrow keys", async () => {
    const id = byLabel(900001).id;
    const before = await placement(id);
    await page.clickText("Upravit rozmístění");
    // What the page saw, reported if the drag isn't saved.
    await page.evaluate(`window.__seen = [];
      for (const type of ["pointerdown", "pointerup", "pointercancel"])
        document.addEventListener(type, (e) => window.__seen.push(type + ":" + (e.target.closest?.("[data-marker]") ? "marker" : e.target.tagName)), true);
      new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => n.textContent && window.__seen.push("+" + n.textContent.slice(0, 60))))).observe(document.body, { subtree: true, childList: true });`);
    const from = await page.box(`[data-marker="${id}"]`);
    await page.drag(from, { x: from.x + 150, y: from.y + 60 });
    const dragged = await until("dragged spot saved", async () => {
      const now = await placement(id);
      return now && now.x > before.x + 0.03 ? now : null;
    }).catch(async (error) => {
      const seen = await page.evaluate("window.__seen");
      throw new Error(
        `${error.message}; saw ${JSON.stringify(seen.filter((x) => !x.startsWith("+") || x.length < 61).slice(0, 30))}`,
      );
    });
    // The selected marker moves with the arrow keys.
    await page.evaluate(`document.querySelector('[data-marker="${id}"]').focus()`);
    for (let i = 0; i < 5; i++) {
      await page.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "ArrowUp",
        code: "ArrowUp",
        windowsVirtualKeyCode: 38,
      });
      await page.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "ArrowUp",
        code: "ArrowUp",
        windowsVirtualKeyCode: 38,
      });
    }
    await until("nudged spot saved", async () => {
      const now = await placement(id);
      return now && now.y < dragged.y - 0.002 ? now : null;
    });
    await page.clickText("Hotovo");
    await page.screenshot(`${OUT}/p13-04-placed.png`);
  });

  await step("a device moves to another plan, another comes off its plan", async () => {
    await page.goto(`${APP}/sites/${siteId}/plans/${plans[0].id}`);
    await page.waitForText("Na jiném plánu");
    await until("plan image", () =>
      page.evaluate(
        `[...document.querySelectorAll('[aria-roledescription="map"] img')].some((i) => i.complete && i.naturalWidth > 0)`,
      ),
    );
    await rowButton(page, "900001", "Přesunout sem");
    const box = await planBox(page);
    await clickAt(page, box.x + box.width * 0.3, box.y + box.height * 0.3);
    await until("moved to the ground floor", async () =>
      (await placement(byLabel(900001).id))?.floor_plan_id === plans[0].id ? true : null,
    );
    // 900004 comes off the plan from its details.
    await page.click(`[data-marker="${byLabel(900004).id}"]`);
    await page.clickText("Odebrat z plánu");
    await until("removed", async () => ((await placement(byLabel(900004).id)) ? null : true));
    await page.waitForText("Zařízení 900004 odebráno z plánu.");
  });

  await step("the device page shows its spot and offers to place an unplaced one", async () => {
    await page.goto(`${APP}/devices/${byLabel(900003).id}`);
    await page.waitForText("Umístění na půdorysu");
    await until("marker on the device page", async () =>
      (await markerIds(page)).includes(byLabel(900003).id) ? true : null,
    );
    await page.screenshot(`${OUT}/p13-05a-device-card.png`);
    await page.goto(`${APP}/devices/${byLabel(900004).id}`);
    await page.waitForText("Zařízení zatím není na půdorysu.");
    await page.clickText("Umístit: Přízemí", "a");
    await page.waitForText("Klepněte na plán tam, kde je zařízení 900004.");
    await page.screenshot(`${OUT}/p13-05-place-from-device.png`);
  });

  await step("the plan downloads as a PDF", async () => {
    const result = await page.evaluate(`(async () => {
      const response = await fetch("/sites/${siteId}/plans/${plans[0].id}/pdf");
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        head: String.fromCharCode(...bytes.slice(0, 5)),
        size: bytes.length,
      };
    })()`);
    if (result.status !== 200 || result.type !== "application/pdf" || result.head !== "%PDF-")
      throw new Error(`pdf ${JSON.stringify(result)}`);
    if (!result.disposition.includes("pudorys-lipova-12-prizemi.pdf"))
      throw new Error(`file name ${result.disposition}`);
  });

  await step("a plan is renamed, gets a new image and is deleted with its file", async () => {
    await page.goto(`${APP}/sites/${siteId}/plans/${basementPlan.id}`);
    await page.clickText("Upravit");
    await page.waitFor("#edit-plan-name");
    await page.type("#edit-plan-name", "Suterén a sklepy");
    await page.clickText("Uložit");
    await until("renamed", async () =>
      (await selectRows("floor_plans", `id=eq.${basementPlan.id}&select=name`))[0]?.name ===
      "Suterén a sklepy"
        ? true
        : null,
    );
    await noDialog(page);
    await page.clickText("Nahradit obrázek");
    await page.waitFor("[role=dialog] input[type=file]");
    await page.setFile("[role=dialog] input[type=file]", writeTestLogo(OUT));
    await until("preview", () =>
      page.evaluate(`!!document.querySelector('img[alt="Náhled plánu"]')`),
    );
    await page.clickText("Nahradit");
    const replaced = await until("new image", async () => {
      const row = (
        await selectRows("floor_plans", `id=eq.${basementPlan.id}&select=image_path`)
      )[0];
      return row.image_path !== basementPlan.image_path ? row : null;
    });
    const folder = `${org}/floor-plans/${siteId}/`;
    let files = await filesIn("org-assets", folder);
    if (files.includes(basementPlan.image_path) || !files.includes(replaced.image_path))
      throw new Error("old image kept or new one missing");
    await noDialog(page);
    await page.clickText("Smazat");
    await page.waitForText("Smazat půdorys?");
    await page.clickText("Smazat", "button");
    // Back on the building (the plan URL starts the same, so wait for the hash).
    await page.waitForUrl(`/sites/${siteId}#plans`);
    await until("plan deleted", async () =>
      (await selectRows("floor_plans", `id=eq.${basementPlan.id}&select=id`)).length ? null : true,
    );
    files = await filesIn("org-assets", folder);
    if (files.includes(replaced.image_path)) throw new Error("image of a deleted plan kept");
  });

  await step("a technician sees the plans but can't change them", async () => {
    await addMember(org, technician, "technician", "Tomáš Technik");
    other = await launch({ width: 1440, height: 1000 });
    await signIn(other, technician);
    await other.waitForText("Vítejte, Tomáš");
    await other.goto(`${APP}/sites/${siteId}`);
    await other.waitForText("2 zařízení");
    if (await other.evaluate(`document.body.innerText.includes("Nahrát půdorys")`))
      throw new Error("technician can upload");
    await other.goto(`${APP}/sites/${siteId}/plans/${plans[0].id}`);
    await until("markers", async () => ((await markerIds(other)).length >= 2 ? true : null));
    const controls = await other.evaluate(
      `["Umístit", "Upravit rozmístění", "Upravit", "Smazat"].filter((text) => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === text))`,
    );
    if (controls.length) throw new Error(`technician sees ${controls.join(", ")}`);
  });

  await step("on a phone the inspection shows on the plan what's left", async () => {
    phone = await launch({ width: 390, height: 844, mobile: true });
    await phone.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await signIn(phone, technician);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z");
    await phone.click('[role=radio][aria-checked="false"]');
    await until("plan markers", async () => ((await markerIds(phone)).length >= 2 ? true : null));
    await phone.waitForText("Zbývá (2)");
    await phone.screenshot(`${OUT}/p13-06-phone-inspection-plan.png`);
    const target = byLabel(900003).id;
    await phone.click(`[data-marker="${target}"]`);
    await phone.waitForUrl(`/check/${target}`);
  });

  await step("another company gets a 404 for the plan and its PDF", async () => {
    await page.click('button[aria-label="Otevřít menu účtu"]');
    await page.clickText("Odhlásit se");
    await page.waitForUrl("/login");
    await signIn(page, stranger);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Cizí firma");
    await page.type("#displayName", "Jana Cizí");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Jana");
    await page.goto(`${APP}/sites/${siteId}/plans/${plans[0].id}`);
    await page.waitForText("404");
    if (await page.evaluate(`document.body.innerText.includes("Přízemí")`))
      throw new Error("the page reveals the plan");
    const status = await page.evaluate(
      `fetch("/sites/${siteId}/plans/${plans[0].id}/pdf").then((r) => r.status)`,
    );
    if (status !== 404) throw new Error(`pdf for a stranger: ${status}`);
  });

  await step("dark mode and English", async () => {
    await other.close();
    other = await launch({ width: 1440, height: 1000, dark: true });
    await signIn(other, owner);
    await other.waitForText("Vítejte, Petra");
    await other.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await other.goto(`${APP}/`);
    await other.waitForText("Welcome, Petra");
    await other.goto(`${APP}/sites/${siteId}/plans/${plans[1].id}`);
    await other.waitForText("Not placed yet");
    await until("markers", async () => ((await markerIds(other)).length >= 2 ? true : null));
    await other.screenshot(`${OUT}/p13-07-dark-en.png`);
  });

  await step("removing the sample data removes the plan images", async () => {
    await other.goto(`${APP}/`);
    await other.clickText("Remove sample data", "button");
    await other.waitForText("Remove the sample data?");
    await other.clickText("Delete", "button");
    await other.waitForText("The sample data is removed.");
    const files = await filesIn("org-assets", `${org}/floor-plans/`);
    if (files.length) throw new Error(`plan files left: ${files.join(", ")}`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await page.screenshot(`${OUT}/p13-failure.png`).catch(() => {});
  if (phone) await phone.screenshot(`${OUT}/p13-failure-phone.png`).catch(() => {});
} finally {
  const logs = [...page.logs, ...(phone?.logs ?? []), ...(other?.logs ?? [])];
  await page.close();
  await phone?.close();
  await other?.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

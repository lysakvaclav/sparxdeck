// Part 17 walkthrough: a firm adds its own device type with custom fields,
// creates a device of that type (filling the fields, an end-of-life date, a
// photo), sees the end-of-life warning, and bulk-changes two devices' status
// from the list, then moves a device to another building (with history).
// Dark mode and English.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { launch } from "./driver.mjs";
import { APP, cleanup, createUser, insertRows, selectRows, signIn } from "./support.mjs";

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

/** A small photo (no image library needed beyond pngjs, already a dependency). */
function photoPng(file) {
  const png = new PNG({ width: 64, height: 48 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([40, 120, 200, 255], i);
  fs.writeFileSync(file, PNG.sync.write(png));
  return path.resolve(file);
}

const tomorrow = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
};

/** Sets an input's value the way typing would (date and number inputs can't take typed text). */
const setValue = (selector, value) =>
  phone.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);

let phone = await launch({ width: 1440, height: 900 });
try {
  const owner = await createUser("part17-owner");
  let siteId;
  let customerId;

  await step("owner sets up the company with a building", async () => {
    await signIn(phone, owner);
    await phone.waitForUrl("/onboarding");
    await phone.type("#organizationName", "Revize Sedmnáct");
    await phone.type("#displayName", "Petra Sedmnáctá");
    await phone.clickText("Vytvořit firmu");
    await phone.waitForText("Vítejte, Petra");
    const [customer] = await insertRows("customers", [
      { organization_id: await orgOf(owner), name: "Bytové družstvo Hydrant" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: await orgOf(owner), customer_id: customer.id, name: "Hydrantova 5" },
    ]);
    siteId = site.id;
    customerId = customer.id;
  });

  let typeHref;
  await step("a custom type is added with its own field", async () => {
    await phone.goto(`${APP}/device-types`);
    await phone.waitForText("Hasicí přístroj");
    await phone.clickText("Nový typ");
    await phone.waitForText("Nový typ zařízení");
    await phone.type("#name", "Hydrant");
    await setValue("#interval", "24");
    await phone.clickText("Přidat pole");
    await phone.type("input[placeholder='např. Hasivo']", "Průměr");
    await phone.waitForText("prumer");
    await phone.clickText("Uložit", "button");
    await phone.waitForText("Upravit šablonu kontroly");
    typeHref = new URL(await phone.url()).pathname.replace("/template", "");

    // A checklist item, so the type is usable for a check (not exercised here,
    // but a type without one would show "no_template" if an inspection tried).
    await phone.clickText("Přidat položku");
    await phone.type("#item-0-label", "Je bez koroze");
    await phone.clickText("Uložit jako verzi 1", "button");
    await phone.waitForText("Hydrant");
  });

  let deviceHref;
  await step(
    "a device of the new type is created with its own field and an end-of-life date",
    async () => {
      await phone.goto(`${APP}/devices/new?site=${siteId}`);
      await phone.waitForText("Nové zařízení");
      await phone.evaluate(`(() => {
      const select = document.getElementById("deviceTypeId");
      const option = [...select.options].find((o) => o.textContent.trim() === "Hydrant");
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
      await phone.waitForText("Průměr");
      await phone.type("#field-prumer", "110 mm");
      await setValue("#endOfLifeOn", tomorrow());
      await phone.clickText("Přidat zařízení", "button");
      // Only the detail page has a label card ("Konec životnosti" is also the
      // form's own field label, so it can't tell the two pages apart).
      await phone.waitForText("Štítek");
      deviceHref = new URL(await phone.url()).pathname;
    },
  );

  await step(
    "the device's page shows the field, warns about the end of life, and takes a photo",
    async () => {
      await phone.waitForText("110 mm");
      await phone.waitForText("Blíží se konec životnosti");
      await phone.screenshot(`${OUT}/p17-01-device.png`);
      await phone.setFile('[data-testid="device-add-photo"]', photoPng(`${OUT}/p17-photo.png`));
      await phone.waitFor('button[aria-label="Odebrat fotku 1"]');
      await phone.screenshot(`${OUT}/p17-02-photo.png`);
      const [photo] = await selectRows(
        "device_photos",
        `device_id=eq.${deviceHref.split("/")[2]}&select=id`,
      );
      if (!photo) throw new Error("photo not registered");
      await phone.click('button[aria-label="Odebrat fotku 1"]');
      await phone.waitForText("Zatím žádné fotky");
    },
  );

  await step("bulk-editing two devices from the list changes their status at once", async () => {
    await insertRows("devices", [
      {
        organization_id: await orgOf(owner),
        site_id: siteId,
        device_type_id: typeHref.split("/")[2],
        status: "active",
      },
    ]);
    await phone.goto(`${APP}/devices?site=${siteId}`);
    await phone.waitFor('thead [role="checkbox"]');
    await phone.click('thead [role="checkbox"]');
    await phone.waitForText("Vybráno 2");
    await phone.selectValue('[aria-label="Stav"]', "out_of_service");
    await phone.clickText("Použít", "button");
    await phone.waitForText("Upraveny 2 zařízení");
    const rows = await selectRows("devices", `site_id=eq.${siteId}&select=id,status`);
    if (!rows.every((row) => row.status === "out_of_service"))
      throw new Error(`not all updated: ${JSON.stringify(rows)}`);
    await phone.screenshot(`${OUT}/p17-03-bulk.png`);
  });

  await step(
    "the device moves to another building with a note, and its history shows it",
    async () => {
      const [other] = await insertRows("sites", [
        { organization_id: await orgOf(owner), customer_id: customerId, name: "Hasičská 12" },
      ]);
      await phone.goto(`${APP}${deviceHref}`);
      await phone.waitForText("Umístění");
      await phone.clickText("Přesunout", "button");
      await phone.waitForText("Přesunout zařízení");
      await phone.selectValue("#move-site", other.id);
      await phone.type("#move-note", "Výměna za nový přístroj");
      await phone.screenshot(`${OUT}/p17-06-move.png`);
      await phone.clickText("Přesunout", "button");
      await phone.waitForText("Zařízení je přesunuté do budovy Hasičská 12");
      await phone.waitForText("Historie umístění");
      await phone.waitForText("Výměna za nový přístroj");
      const deviceId = deviceHref.split("/")[2];
      const [device] = await selectRows("devices", `id=eq.${deviceId}&select=site_id`);
      if (device.site_id !== other.id) throw new Error(`device still in ${device.site_id}`);
      const moves = await selectRows(
        "device_moves",
        `device_id=eq.${deviceId}&select=from_site_id,to_site_id,note`,
      );
      if (
        moves.length !== 1 ||
        moves[0].from_site_id !== siteId ||
        moves[0].note !== "Výměna za nový přístroj"
      )
        throw new Error(`history ${JSON.stringify(moves)}`);
      await phone.screenshot(`${OUT}/p17-07-moved.png`);
    },
  );

  await step("dark mode and English", async () => {
    await phone.close();
    phone = await launch({ width: 1440, height: 900, dark: true });
    await signIn(phone, owner);
    await phone.waitForText("Vítejte, Petra");
    await phone.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await phone.goto(`${APP}${deviceHref}`);
    await phone.waitForText("End of life");
    await phone.waitForText("End of life is approaching");
    await phone.waitForText("Location history");
    await phone.screenshot(`${OUT}/p17-04-dark-en.png`);
    await phone.goto(`${APP}${typeHref}/edit`);
    await phone.waitForText("Custom fields");
    await phone.waitForText("prumer");
    await phone.screenshot(`${OUT}/p17-05-dark-en-type.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await phone.screenshot(`${OUT}/p17-failure.png`).catch(() => {});
} finally {
  const logs = [...phone.logs];
  await phone.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

/** The signed-in owner's organization id (the admin API, not the browser). */
async function orgOf(user) {
  const [membership] = await selectRows(
    "memberships",
    `user_id=eq.${user.id}&select=organization_id`,
  );
  return membership.organization_id;
}

// Screenshots of the platform for the landing page (apps/landingpage/public/screens):
// a made-up service company in Prague (customers, buildings with locations,
// devices due at different times, defects, planned visits, a route for today),
// photographed in Czech and English, light and dark, on a desktop and a phone.
// Everything is created in the development project and deleted at the end.
// Run against a production build of the platform (port 3005):
//   E2E_APP_URL=http://localhost:3005 node --env-file=.env.local e2e/landing-screens.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { launch, sleep } from "./driver.mjs";
import { APP, addMember, cleanup, createUser, insertRows, password, selectRows, updateRows } from "./support.mjs";

const OUT = path.resolve("../landingpage/public/screens");
const TMP = fs.mkdtempSync(path.join(process.env.TEMP ?? ".", "screens-"));
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date());
const shift = (days) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** The last inspection that makes the next one fall `days` from today (a yearly interval). */
const lastFor = (days, months = 12) => {
  const date = new Date(`${shift(days)}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
};

// The company, in each language. Names are made up; points are in Prague.
const DATA = {
  cs: {
    company: "Revizní servis Novák",
    legal: "Revizní servis Novák s.r.o.",
    address: "Korunní 1180/72, 101 00 Praha 10",
    owner: "Olga Nováková",
    techs: ["Tomáš Dvořák", "Jan Procházka"],
    customers: [
      "SVJ Lipová 12",
      "Správa nemovitostí Praha",
      "Hotel U Parku",
      "Logistika Hostivař",
      "Poliklinika Vinohrady",
      "Sportovní klub Strahov",
    ],
    sites: [
      ["Bytový dům Lipová 12", "Lipová 12, Praha 2", 0, 50.0727, 14.428],
      ["Administrativní budova Karlín", "Pernerova 35, Praha 8", 1, 50.0925, 14.451],
      ["Hotel U Parku", "Na Smetance 8, Praha 2", 2, 50.0781, 14.4365],
      ["Sklad Hostivař", "Průmyslová 11, Praha 10", 3, 50.0563, 14.53],
      ["Poliklinika Vinohrady", "Šrobárova 50, Praha 10", 4, 50.0759, 14.4706],
      ["Bytový dům Korunní 48", "Korunní 48, Praha 2", 1, 50.0748, 14.4448],
      ["Kancelářský dům Smíchov", "Plzeňská 8, Praha 5", 1, 50.0705, 14.4033],
      ["Sportovní hala Strahov", "Vaníčkova 2, Praha 6", 5, 50.0789, 14.3878],
    ],
    locations: ["1. NP – chodba", "2. NP – schodiště", "Suterén – kotelna"],
    types: [
      ["hydrant", "Hydrant", 12],
      ["emergency_light", "Nouzové osvětlení", 12],
      ["fire_damper", "Požární klapka", 12],
      ["fire_door", "Požární dveře", 12],
    ],
    agents: [["Prášek", "6 kg"], ["CO2", "5 kg"], ["Pěna", "9 l"]],
    defects: [
      ["Poškozená plomba, přístroj nutno přeplombovat.", "major"],
      ["Chybí piktogram nad hydrantem.", "minor"],
      ["Tlak pod hranicí zelené výseče manometru.", "critical"],
      ["Samozavírač dveří nedovírá.", "major"],
    ],
    routeName: "Praha – centrum",
    notes: ["Klíče u správce v přízemí", "Vjezd ze dvora", null, "Ohlásit se na recepci", null],
  },
  en: {
    company: "Novak Fire Safety",
    legal: "Novak Fire Safety Ltd.",
    address: "72 Crown Street, 101 00 Prague 10",
    owner: "Olivia Grant",
    techs: ["Tom Harris", "Daniel Price"],
    customers: [
      "Linden Street Owners",
      "Prague Property Management",
      "Park Hotel",
      "Hostivař Logistics",
      "Vinohrady Clinic",
      "Strahov Sports Club",
    ],
    sites: [
      ["12 Linden Street Residences", "12 Linden Street, Prague 2", 0, 50.0727, 14.428],
      ["Karlín Office Building", "35 Perner Street, Prague 8", 1, 50.0925, 14.451],
      ["Park Hotel", "8 Smetanka Street, Prague 2", 2, 50.0781, 14.4365],
      ["Hostivař Warehouse", "11 Industrial Street, Prague 10", 3, 50.0563, 14.53],
      ["Vinohrady Clinic", "50 Šrobár Street, Prague 10", 4, 50.0759, 14.4706],
      ["48 Crown Street Apartments", "48 Crown Street, Prague 2", 1, 50.0748, 14.4448],
      ["Smíchov Office House", "8 Pilsen Street, Prague 5", 1, 50.0705, 14.4033],
      ["Strahov Sports Hall", "2 Vaníček Street, Prague 6", 5, 50.0789, 14.3878],
    ],
    locations: ["Ground floor – corridor", "2nd floor – staircase", "Basement – boiler room"],
    types: [
      ["hydrant", "Hydrant", 12],
      ["emergency_light", "Emergency lighting", 12],
      ["fire_damper", "Fire damper", 12],
      ["fire_door", "Fire door", 12],
    ],
    agents: [["Powder", "6 kg"], ["CO2", "5 kg"], ["Foam", "9 l"]],
    defects: [
      ["Broken seal, the extinguisher needs a new one.", "major"],
      ["Sign above the hydrant is missing.", "minor"],
      ["Pressure below the green zone of the gauge.", "critical"],
      ["Door closer doesn't shut the door fully.", "major"],
    ],
    routeName: "Prague – centre",
    notes: ["Keys with the caretaker", "Entry from the yard", null, "Report at the reception", null],
  },
};

const LABEL = { cs: { signIn: "Přihlásit se", start: "Zahájit revizi" }, en: { signIn: "Sign in", start: "Start inspection" } };

async function rpcAs(token, name, args) {
  const response = await fetch(`${SUPABASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function tokenOf(user) {
  const response = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  return (await response.json()).access_token;
}

/** The made-up company with its data; returns what the pages need. */
async function company(lang) {
  const d = DATA[lang];
  const owner = await createUser(`screens-${lang}-owner`);
  const techs = [await createUser(`screens-${lang}-t1`), await createUser(`screens-${lang}-t2`)];
  const org = await rpcAs(await tokenOf(owner), "create_organization", {
    p_name: d.company,
    p_display_name: d.owner,
    p_locale: lang,
  });
  for (const [index, tech] of techs.entries()) await addMember(org, tech, "technician", d.techs[index]);
  await updateRows("organizations", `id=eq.${org}`, {
    legal_name: d.legal,
    address: d.address,
    company_id: "27182818",
    email: "info@example.com",
    phone: "+420 222 000 111",
    base_latitude: 50.0755,
    base_longitude: 14.4378,
    guide_dismissed_at: new Date().toISOString(),
    labels_printed_at: new Date().toISOString(),
  });
  const [extinguisher] = await selectRows("device_types", `organization_id=eq.${org}&select=id&order=created_at&limit=1`);
  const types = await insertRows(
    "device_types",
    d.types.map(([code, name, months]) => ({ organization_id: org, code, name, inspection_interval_months: months })),
  );
  const customers = await insertRows("customers", d.customers.map((name) => ({ organization_id: org, name })));
  const sites = await insertRows(
    "sites",
    d.sites.map(([name, address, customer, latitude, longitude]) => ({
      organization_id: org,
      customer_id: customers[customer].id,
      name,
      address,
      latitude,
      longitude,
    })),
  );
  const locations = await insertRows(
    "locations",
    sites.flatMap((site) => d.locations.map((name, index) => ({ organization_id: org, site_id: site.id, name, sort_order: index }))),
  );
  // Due dates spread over the year: a few overdue, some soon, most later.
  const offsets = [-12, -3, 6, 11, 19, 27, 45, 70, 96, 130, 160, 200, 240, 290, 330];
  const devices = [];
  let n = 0;
  for (const [s, site] of sites.entries()) {
    const siteLocations = locations.filter((location) => location.site_id === site.id);
    const count = 6 + (s % 4);
    for (let i = 0; i < count; i++, n++) {
      const typeIndex = i % 5 === 3 ? 1 + (s % 4) : 0;
      const type = typeIndex === 0 ? extinguisher.id : types[typeIndex - 1].id;
      const [agent, size] = d.agents[n % d.agents.length];
      devices.push({
        organization_id: org,
        site_id: site.id,
        location_id: siteLocations[i % siteLocations.length].id,
        device_type_id: type,
        serial_number: `${["PG6", "S5", "P9", "H25", "NO1"][n % 5]}-${String(4100 + n * 7)}`,
        manufacture_year: 2016 + (n % 9),
        attributes: typeIndex === 0 ? { agent, size } : {},
        last_inspection_on: lastFor(offsets[n % offsets.length]),
      });
    }
  }
  const inserted = await insertRows("devices", devices);
  const technician = (index) => [owner, ...techs][index % 3].id;
  await insertRows(
    "defects",
    d.defects.map(([description, severity], index) => ({
      organization_id: org,
      number: index + 1,
      device_id: inserted[index * 7 + 2].id,
      description,
      severity,
      status: index === 1 ? "in_progress" : "open",
      created_by: owner.id,
      assigned_to: technician(index + 1),
      due_on: shift(index * 6 - 4),
    })),
  );
  // Visits this month, a few per week.
  await insertRows(
    "inspection_plans",
    [-9, -6, -2, 1, 3, 6, 8, 13, 15, 20].map((days, index) => ({
      organization_id: org,
      site_id: sites[index % sites.length].id,
      planned_on: shift(days),
      technician_id: technician(index),
      created_by: owner.id,
    })),
  );
  // Today's route of the owner (the screenshots' account), five stops in order.
  const [route] = await insertRows("route_plans", [
    {
      organization_id: org,
      technician_id: owner.id,
      planned_on: today,
      name: d.routeName,
      start_kind: "company",
      start_latitude: 50.0755,
      start_longitude: 14.4378,
    },
  ]);
  await insertRows(
    "route_plan_stops",
    // In the order the app's "order by distance" gives (a loop from the seat, no crossings).
    [0, 2, 1, 4, 5].map((site, index) => ({
      organization_id: org,
      route_id: route.id,
      site_id: sites[site].id,
      position: index + 1,
      minutes: [30, 45, 40, 60, 35][index],
      note: d.notes[index],
      ...(index === 0 ? { visited_at: new Date().toISOString() } : {}),
    })),
  );
  const [template] = await selectRows("protocol_templates", `organization_id=eq.${org}&select=id&limit=1`);
  return { owner, route: route.id, site: sites[0].id, template: template.id };
}

async function signInAs(page, user, lang) {
  await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: lang, url: APP });
  await page.goto(`${APP}/login`);
  const end = Date.now() + 20_000;
  while (
    Date.now() < end &&
    !(await page.evaluate(`Object.keys(document.querySelector("#email") ?? {}).some((k) => k.startsWith("__reactProps"))`))
  )
    await sleep(200);
  await page.type("#email", user.email);
  await page.type("#password", password);
  await page.clickText(LABEL[lang].signIn);
  await page.waitForUrl("/", 30_000).catch(() => undefined);
  await sleep(1500);
}

/** The made-up accounts' addresses stay out of the pictures. */
async function tidy(page) {
  await page.evaluate(`(() => {
    for (const el of document.querySelectorAll("body *"))
      if (el.children.length === 0 && /@sparxdeck\\.test/.test(el.textContent ?? "")) el.style.visibility = "hidden";
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  })()`);
}

async function shoot(page, file, { width }) {
  await tidy(page);
  const raw = path.join(TMP, "shot.png");
  await page.screenshot(raw);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(raw).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(file);
  console.log(path.relative(OUT, file));
}

async function setTheme(page, theme) {
  await page.evaluate(`localStorage.setItem("theme", "${theme}")`);
}

async function until(check, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(300);
  }
}

try {
  for (const lang of ["cs", "en"]) {
    const data = await company(lang);
    const desktop = await launch({ width: 1440, height: 900 });
    await desktop.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await signInAs(desktop, data.owner, lang);
    const phone = await launch({ width: 390, height: 844, mobile: true });
    await phone.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await signInAs(phone, data.owner, lang);

    let inspection = null;
    for (const theme of ["light", "dark"]) {
      const dir = path.join(OUT, lang, theme);
      await setTheme(desktop, theme);
      const pages = [
        ["dashboard", "/", 1500],
        ["devices", "/devices", 1200],
        ["calendar", "/calendar", 1500],
        ["defects", "/defects", 1200],
        ["map", "/map", 6000],
        ["route", `/routes/${data.route}`, 6000],
      ];
      for (const [name, href, wait] of pages) {
        await desktop.goto(`${APP}${href}`);
        await sleep(wait);
        await shoot(desktop, path.join(dir, `${name}.webp`), { width: 2000 });
      }
      await desktop.goto(`${APP}/protocol-templates/${data.template}`);
      await until(() => desktop.evaluate(`document.querySelectorAll("img[src^='blob:'], img[src^='data:']").length > 0`), 30_000);
      await sleep(3000);
      await shoot(desktop, path.join(dir, "protocol.webp"), { width: 2000 });

      await setTheme(phone, theme);
      await phone.goto(`${APP}/routes/today`);
      await sleep(2000);
      await shoot(phone, path.join(dir, "today.webp"), { width: 780 });
      // One inspection per building: started on the first pass, opened again on the second.
      if (!inspection) {
        await phone.goto(`${APP}/sites/${data.site}`);
        await sleep(1500);
        await phone.clickText(LABEL[lang].start);
        await phone.waitForUrl("/inspections/", 30_000);
        inspection = new URL(await phone.url()).pathname;
      } else await phone.goto(`${APP}${inspection}`);
      await sleep(2500);
      await phone.evaluate(`document.querySelector("a[href*='/check/'], button[data-device]")?.click()`);
      await sleep(2500);
      // A check under way: the first two items passed.
      if (theme === "light")
        await phone.evaluate(`[...document.querySelectorAll("button")].filter((b) => /^(Vyhovuje|Pass)$/.test(b.innerText.trim())).slice(0, 2).forEach((b) => b.click())`);
      await sleep(1200);
      await shoot(phone, path.join(dir, "check.webp"), { width: 780 });
    }
    await desktop.close();
    await phone.close();
  }
} finally {
  await cleanup();
  fs.rmSync(TMP, { recursive: true, force: true });
}

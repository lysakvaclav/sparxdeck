import { randomUUID } from "node:crypto";
import { launch, sleep } from "./driver.mjs";
const APP = process.env.E2E_APP_URL ?? "http://localhost:3001",
  OUT = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const run = randomUUID().slice(0, 6),
  password = `Sparx-${randomUUID().slice(0, 12)}`;
const email = `e2e-mobile-${run}@sparxdeck.test`;
const r = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ email, password, email_confirm: true }),
});
const userId = (await r.json()).id;
const page = await launch({ width: 390, height: 844, mobile: true });
try {
  await page.goto(`${APP}/login`);
  await page.type("#email", email);
  await page.type("#password", password);
  await page.clickText("Přihlásit se");
  await page.waitForUrl("/onboarding");
  await page.screenshot(`${OUT}/m-01-onboarding.png`);
  await page.type("#organizationName", "Revize Novák s.r.o.");
  await page.type("#displayName", "Petr Novák");
  await page.clickText("Vytvořit firmu");
  await page.waitForText("Vítejte, Petr");
  await page.screenshot(`${OUT}/m-02-dashboard.png`);
  await page.goto(`${APP}/team`);
  await sleep(500);
  await page.screenshot(`${OUT}/m-03-team.png`);
  await page.click('header button[aria-label="Otevřít menu účtu"]');
  await sleep(500);
  await page.screenshot(`${OUT}/m-04-menu.png`);
  const overflow = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth");
  console.log("horizontal overflow:", overflow);
} finally {
  console.log(page.logs.length ? page.logs.join("\n") : "console: clean");
  await page.close();
  const m = await (
    await fetch(`${url}/rest/v1/memberships?user_id=eq.${userId}&select=organization_id`, {
      headers: H,
    })
  ).json();
  for (const row of m)
    await fetch(`${url}/rest/v1/organizations?id=eq.${row.organization_id}`, {
      method: "DELETE",
      headers: H,
    });
  await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: H });
}

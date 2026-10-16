// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
// End-to-end walk through part 1 against the real dev Supabase project.
// Users are created pre-confirmed (no e-mails sent); everything after sign-in uses the UI.
import { randomUUID } from "node:crypto";
import { launch, sleep } from "./driver.mjs";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3001";
const OUT = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const run = randomUUID().slice(0, 6);
const password = `Sparx-${randomUUID().slice(0, 12)}`;
const owner = { email: `e2e-owner-${run}@sparxdeck.test` };
const tech = { email: `e2e-tech-${run}@sparxdeck.test` };
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message}`);
    throw e;
  }
};

async function createUser(u) {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email: u.email, password, email_confirm: true }),
  });
  u.id = (await r.json()).id;
}
async function cleanup() {
  for (const u of [owner, tech]) {
    if (!u.id) continue;
    const m = await (
      await fetch(`${url}/rest/v1/memberships?user_id=eq.${u.id}&select=organization_id`, {
        headers: H,
      })
    ).json();
    for (const row of m)
      await fetch(`${url}/rest/v1/organizations?id=eq.${row.organization_id}`, {
        method: "DELETE",
        headers: H,
      });
    await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: H });
  }
}

async function login(page, u, next = "") {
  await page.goto(`${APP}/login${next}`);
  await page.type("#email", u.email);
  await page.type("#password", password);
  await page.clickText("Přihlásit se");
}

let inviteLink;
const desktop = await launch({ width: 1440, height: 900 });
try {
  await createUser(owner);
  await createUser(tech);

  await step("protected page redirects to login", async () => {
    await desktop.goto(`${APP}/team`);
    await desktop.waitForUrl("/login?next=%2Fteam");
  });

  await step("wrong password shows a friendly error", async () => {
    await desktop.type("#email", owner.email);
    await desktop.type("#password", "definitely-wrong-1");
    await desktop.clickText("Přihlásit se");
    await desktop.waitForText("Nesprávný e-mail nebo heslo.");
  });

  await step("owner signs in and lands on onboarding", async () => {
    await login(desktop, owner);
    await desktop.waitForUrl("/onboarding");
    await desktop.screenshot(`${OUT}/e2e-01-onboarding.png`);
  });

  await step("owner creates the company", async () => {
    await desktop.type("#organizationName", `Hasiči Servis E2E ${run}`);
    await desktop.type("#displayName", "Jana Vlastníková");
    await desktop.clickText("Vytvořit firmu");
    await desktop.waitForText("Vítejte, Jana");
    await desktop.screenshot(`${OUT}/e2e-02-dashboard.png`);
  });

  await step("owner invites a technician (link shown without Resend)", async () => {
    await desktop.goto(`${APP}/team`);
    await desktop.type("#invite-email", tech.email);
    await desktop.clickText("Poslat pozvánku");
    await desktop.waitForText("Pošlete kolegovi tento odkaz");
    inviteLink = await desktop.evaluate(
      `[...document.querySelectorAll('input[readonly]')].map(i => i.value).find(v => v.includes('/invite/'))`,
    );
    if (!inviteLink) throw new Error("no invite link");
    await desktop.waitForText(tech.email);
    await desktop.screenshot(`${OUT}/e2e-03-team-invited.png`);
  });

  await step("duplicate invite is refused", async () => {
    await desktop.type("#invite-email", tech.email);
    await desktop.clickText("Poslat pozvánku");
    await desktop.waitForText("Tento e-mail už má čekající pozvánku.");
  });

  await step("owner signs out", async () => {
    await desktop.click('button[aria-label="Otevřít menu účtu"]');
    await desktop.clickText("Odhlásit se");
    await desktop.waitForUrl("/login");
  });

  await step("invite page offers sign-in to a logged-out visitor", async () => {
    await desktop.goto(inviteLink);
    await desktop.waitForText("jako technik");
    await desktop.screenshot(`${OUT}/e2e-04-invite-public.png`);
  });

  await step("technician signs in through the invite and accepts", async () => {
    await desktop.clickText("Přihlásit se", "a");
    await desktop.waitForUrl("/login?next=");
    await desktop.type("#email", tech.email);
    await desktop.type("#password", password);
    await desktop.clickText("Přihlásit se");
    await desktop.waitForUrl("/invite/");
    await desktop.type("#displayName", "Tomáš Technik");
    await desktop.clickText("Přijmout pozvánku");
    await desktop.waitForText("Vítejte, Tomáš");
  });

  await step("technician sees the team read-only", async () => {
    await desktop.goto(`${APP}/team`);
    await desktop.waitForText("Členy a pozvánky spravuje vlastník nebo administrátor.");
    const menus = await desktop.evaluate(
      `document.querySelectorAll('button[aria-label^="Možnosti člena"]').length`,
    );
    if (menus !== 0) throw new Error("technician sees member menus");
    await desktop.screenshot(`${OUT}/e2e-05-team-technician.png`);
  });

  await step("technician changes their name in the account page", async () => {
    await desktop.goto(`${APP}/account`);
    await desktop.type("#displayName", "Tomáš T. Technik");
    await desktop.clickText("Uložit");
    await desktop.waitForText("Uloženo.");
  });

  await step("account rejects wrong current password and common new password", async () => {
    await desktop.type("#currentPassword", "not-my-password");
    await desktop.type("#password", "another-Strong-77");
    await desktop.type("#confirmPassword", "another-Strong-77");
    await desktop.clickText("Změnit heslo");
    await desktop.waitForText("Současné heslo není správné.");
    await desktop.type("#currentPassword", password);
    await desktop.type("#password", "password123");
    await desktop.type("#confirmPassword", "password123");
    await desktop.clickText("Změnit heslo");
    await desktop.waitForText("Toto heslo je příliš běžné");
    await desktop.screenshot(`${OUT}/e2e-06-account.png`);
  });

  await step("account changes the password", async () => {
    await desktop.type("#currentPassword", password);
    await desktop.type("#password", `${password}-new`);
    await desktop.type("#confirmPassword", `${password}-new`);
    await desktop.clickText("Změnit heslo");
    await desktop.waitForText("Heslo bylo změněno.");
  });

  await step("owner promotes the technician to admin", async () => {
    await desktop.click('button[aria-label="Otevřít menu účtu"]');
    await desktop.clickText("Odhlásit se");
    await desktop.waitForUrl("/login");
    await login(desktop, owner);
    await desktop.waitForText("Vítejte, Jana");
    await desktop.goto(`${APP}/team`);
    await desktop.click('button[aria-label^="Možnosti člena"]');
    await desktop.screenshot(`${OUT}/e2e-07-member-menu.png`);
    await desktop.clickText("Změnit na administrátora");
    await sleep(1500);
    await desktop.waitForText("Administrátor");
  });

  await step("remove asks for confirmation, then removes", async () => {
    await desktop.click('button[aria-label^="Možnosti člena"]');
    await desktop.clickText("Odebrat z firmy");
    await desktop.waitForText("Odebrat člena z firmy?");
    await desktop.waitForText("ztratí přístup k datům firmy.");
    await desktop.screenshot(`${OUT}/e2e-08-remove-dialog.png`);
    await desktop.clickText("Odebrat z firmy", "button");
    // The list refreshes after the removal: give it up to 10 s.
    for (let i = 0; ; i++) {
      const still = await desktop.evaluate(`document.body.innerText.includes("Tomáš T. Technik")`);
      if (!still) break;
      if (i === 100) throw new Error("member still listed");
      await sleep(100);
    }
  });

  await step("dark mode and English render", async () => {
    await desktop.click('button[aria-label="Otevřít menu účtu"]');
    await desktop.clickText("English", "[role=menuitemradio]");
    await desktop.waitForText("Team");
    await desktop.click('button[aria-label="Open account menu"]');
    await desktop.clickText("Dark", "[role=menuitemradio]");
    await sleep(800);
    await desktop.screenshot(`${OUT}/e2e-09-team-en-dark.png`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await desktop.screenshot(`${OUT}/e2e-failure.png`);
} finally {
  const logs = desktop.logs.filter((l) => !l.includes("Download the React DevTools"));
  await desktop.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

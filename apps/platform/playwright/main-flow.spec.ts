import { expect, test, type Page } from "@playwright/test";

// The main flow a new company goes through, end to end: sign in, set up the
// company, add a customer, a building and a device, inspect it and get the
// protocol PDF. The user is created pre-confirmed through the admin API (no
// e-mail is sent) and removed with the company afterwards.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

function admin(path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** Removes the test company (with its stored protocols) and the user. */
async function cleanup(userId: string) {
  const memberships = (await (
    await admin(`/rest/v1/memberships?user_id=eq.${userId}&select=organization_id`)
  ).json()) as { organization_id: string }[];
  for (const { organization_id: org } of memberships) {
    const protocols = (await (
      await admin(`/rest/v1/protocols?organization_id=eq.${org}&select=pdf_path`)
    ).json()) as { pdf_path: string | null }[];
    const files = protocols.flatMap((protocol) => (protocol.pdf_path ? [protocol.pdf_path] : []));
    if (files.length)
      await admin("/storage/v1/object/protocols", {
        method: "DELETE",
        body: JSON.stringify({ prefixes: files }),
      });
    await admin(`/rest/v1/organizations?id=eq.${org}`, { method: "DELETE" });
  }
  await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
}

const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
  new Date(),
);

/** Follows a guide step from the dashboard (each step links to its form). */
async function guideStep(page: Page, action: string) {
  await page.goto("/");
  await page.getByRole("link", { name: action, exact: true }).click();
}

test("main flow: sign in → company → customer → building → device → inspection → protocol", async ({
  page,
}, testInfo) => {
  test.skip(!supabaseUrl || !secretKey, "needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  const email = `pw-${testInfo.project.name}-${Date.now()}@sparxdeck.test`;
  const password = `Pw-${crypto.randomUUID()}`;
  const created = (await (
    await admin("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json()) as { id: string };

  try {
    await test.step("sign in and set up the company", async () => {
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
      await page.waitForURL(/\/onboarding/);
      await page.locator("#organizationName").fill("Revize Playwright");
      await page.locator("#displayName").fill("Pavla Testová");
      await page.getByRole("button", { name: "Vytvořit firmu", exact: true }).click();
      await expect(page.getByText("Vítejte, Pavla")).toBeVisible();
      await expect(page.getByText("Začínáme")).toBeVisible();
    });

    await test.step("add a customer, a building and a device", async () => {
      await guideStep(page, "Přidat zákazníka");
      await page.locator("#name").fill("Bytové družstvo Testovací");
      await page.getByRole("button", { name: "Vytvořit zákazníka", exact: true }).click();
      await expect(page.getByText("Zákazník zatím nemá žádné budovy.")).toBeVisible();

      await guideStep(page, "Přidat budovu");
      await page.locator("#name").fill("Testovací 1");
      await page.getByRole("button", { name: "Vytvořit budovu", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Testovací 1", exact: true })).toBeVisible();

      await guideStep(page, "Přidat zařízení");
      await page.locator("#serialNumber").fill("PW-0001");
      await page.getByRole("button", { name: "Přidat zařízení", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Hasicí přístroj 0001", exact: true }),
      ).toBeVisible();
    });

    await test.step("inspect the device on the spot", async () => {
      await page.getByRole("button", { name: "Zkontrolovat", exact: true }).first().click();
      await expect(page.getByText("Uloženo")).toBeVisible();
      for (const yes of await page.getByRole("button", { name: "Vyhovuje", exact: true }).all())
        await yes.click();
      await expect(page.getByText("Uloženo")).toBeVisible();
      await page.getByRole("button", { name: "Hotovo", exact: true }).click();
      await expect(page.getByText("0001: vyhovuje.")).toBeVisible();
      await page.getByRole("link", { name: "Dokončit revizi", exact: true }).click();
      await page.getByRole("button", { name: "Dokončit revizi", exact: true }).click();
      await expect(page.getByText("Revize dokončena.")).toBeVisible();
    });

    await test.step("the protocol is numbered and downloads as a PDF", async () => {
      await expect(page.getByText(`${year}-0001`).first()).toBeVisible();
      const href = await page
        .getByRole("link", { name: "Stáhnout PDF", exact: true })
        .getAttribute("href");
      expect(href).toMatch(/^\/inspections\/[0-9a-f-]+\/protocol$/);
      const pdf = await page.request.get(href!);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toBe("application/pdf");
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    });
  } finally {
    await cleanup(created.id);
  }
});

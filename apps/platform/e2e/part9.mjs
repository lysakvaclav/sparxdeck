// Part 9 walkthrough: a technician completes an inspection on the phone and the
// protocol is there right away (number, PDF to download, e-mail to the customer);
// the office finds protocols on the building and the customer; an older
// inspection without a protocol gets one, in the company's language.
// Run: npm run e2e (needs `npm run build && npm start` on port 3001 and .env.local).
import fs from "node:fs";
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
  updateRows,
  writeTestLogo,
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
  new Date(),
);

const answer = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);

/** Downloads the protocol the way the button does and describes the response. */
const download = (page, path) =>
  page.evaluate(`(async () => {
    const response = await fetch(${JSON.stringify(path)});
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      head: String.fromCharCode(...bytes.slice(0, 5)),
      size: bytes.length,
    };
  })()`);

/**
 * Where the protocol route sends this browser's session: the signed link with
 * the download name (the browser can't read the storage's headers itself).
 */
async function protocolLink(page, path) {
  const { cookies } = (await page.send("Network.getCookies", { urls: [APP] })).result;
  const response = await fetch(`${APP}${path}`, {
    headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
    redirect: "manual",
  });
  return {
    status: response.status,
    location: decodeURIComponent(response.headers.get("location") ?? ""),
  };
}

const phone = await launch({ width: 390, height: 844, mobile: true });
let office;
let org;
let devices;
let questions;
let inspectionUrl;
let siteId;
let customerId;
try {
  const owner = await createUser("protocol-owner");
  const tech = await createUser("protocol-tech");

  await step("setup: company details with a logo, a customer with an e-mail", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Horák");
    await office.type("#displayName", "Hana Horáková");
    await office.clickText("Vytvořit firmu");
    await office.waitForText("Vítejte, Hana");
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");

    const logoPath = `${org}/logo-e2e.png`;
    const upload = await fetch(`${url}/storage/v1/object/org-assets/${logoPath}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/png" },
      body: fs.readFileSync(writeTestLogo(OUT)),
    });
    if (!upload.ok) throw new Error(`logo upload ${upload.status}`);
    await updateRows("organizations", `id=eq.${org}`, {
      legal_name: "Revize Horák s.r.o.",
      company_id: "27074358",
      address: "Nádražní 12\n602 00 Brno",
      email: "kancelar@revize-horak.cz",
      phone: "+420 555 123 456",
      logo_path: logoPath,
      protocol_footer_text: "Zapsáno v obchodním rejstříku vedeném Krajským soudem v Brně.",
    });

    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    const [template] = await selectRows(
      "checklist_templates",
      `device_type_id=eq.${type.id}&active=eq.true&select=id`,
    );
    questions = await selectRows(
      "checklist_template_items",
      `template_id=eq.${template.id}&select=label,item_type,required&order=sort_order`,
    );
    const [customer] = await insertRows("customers", [
      {
        organization_id: org,
        name: "Společenství vlastníků Kounicova",
        email: "vybor@kounicova.example",
        billing_address: "Kounicova 20, Brno",
      },
    ]);
    customerId = customer.id;
    const [site] = await insertRows("sites", [
      {
        organization_id: org,
        customer_id: customer.id,
        name: "Kounicova 20",
        address: "Kounicova 20\n602 00 Brno",
      },
    ]);
    siteId = site.id;
    devices = await insertRows(
      "devices",
      [1, 2, 3].map((n) => ({
        organization_id: org,
        site_id: siteId,
        device_type_id: type.id,
        status: "active",
        serial_number: `HP-${n}`,
        attributes: {},
      })),
    );
  });

  await step("completing on the phone hands over the protocol right away", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 3");
    inspectionUrl = new URL(await phone.url()).pathname;
    const required = questions.filter((q) => q.required && q.item_type === "pass_fail");
    for (const [index, device] of devices.slice(0, 2).entries()) {
      await phone.goto(`${APP}${inspectionUrl}/check/${device.id}`);
      await phone.waitForText("Uloženo");
      for (const [n, question] of required.entries())
        await answer(phone, question.label, index === 1 && n === 0 ? "Nevyhovuje" : "Vyhovuje");
      await sleep(300);
      await phone.waitForText("Uloženo");
      await phone.clickText("Hotovo", "button");
      await phone.waitForText(`Zkontrolováno ${index + 1} z 3`);
    }
    await phone.waitFor(`a[href="${inspectionUrl}/complete"]`);
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("Nezkontrolovaná zařízení");
    await phone.clickText("Dokončit revizi", "button");
    await phone.waitForText("Revize dokončena. Vznikla 1 závada.");
    await phone.waitForText(`${year}-0001`);
    await phone.waitForText("Stáhnout PDF");
    // On a phone the protocol comes first.
    const first = await phone.evaluate(
      `document.querySelector("main [data-testid=protocol-download]").getBoundingClientRect().top < document.querySelector("main table").getBoundingClientRect().top`,
    );
    if (!first) throw new Error("protocol card is not first on the phone");
    await phone.screenshot(`${OUT}/p9-01-result-phone.png`);
  });

  await step("the PDF is stored once and downloads under its number", async () => {
    const [protocol] = await selectRows(
      "protocols",
      `organization_id=eq.${org}&select=year,number,locale,pdf_path,pdf_size,generated_at`,
    );
    if (
      protocol.number !== 1 ||
      String(protocol.year) !== year ||
      protocol.locale !== "cs" ||
      !protocol.pdf_path?.startsWith(`${org}/${year}/`) ||
      protocol.pdf_size < 5000 ||
      !protocol.generated_at
    )
      throw new Error(`protocol ${JSON.stringify(protocol)}`);
    const file = await download(phone, `${inspectionUrl}/protocol`);
    if (file.status !== 200 || file.head !== "%PDF-" || file.size !== protocol.pdf_size)
      throw new Error(`download ${JSON.stringify(file)}`);
    const link = await protocolLink(phone, `${inspectionUrl}/protocol`);
    if (link.status !== 303 || !link.location.includes(`download=Protokol-${year}-0001.pdf`))
      throw new Error(`file name ${JSON.stringify(link)}`);
    const inline = await protocolLink(phone, `${inspectionUrl}/protocol?inline`);
    if (inline.location.includes("download=")) throw new Error("the printable link downloads");
    // Kept for a look at the PDF itself.
    const signed = await fetch(`${url}/storage/v1/object/protocols/${protocol.pdf_path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    fs.writeFileSync(`${OUT}/p9-protocol.pdf`, Buffer.from(await signed.arrayBuffer()));
  });

  await step("e-mailing offers the customer's address and says when it isn't set up", async () => {
    await phone.clickText("Poslat e-mailem", "button");
    await phone.waitForText("Poslat protokol e-mailem");
    const value = await phone.evaluate(`document.querySelector("#protocol-email").value`);
    if (value !== "vybor@kounicova.example") throw new Error(`recipient ${value}`);
    // This environment has no Resend key: the dialog says so instead of failing.
    await phone.waitForText("Odesílání e-mailů zatím není nastavené");
    const disabled = await phone.evaluate(
      `[...document.querySelectorAll("[role=dialog] button[type=submit]")].every((b) => b.disabled)`,
    );
    if (!disabled) throw new Error("send button enabled without e-mail");
    await phone.screenshot(`${OUT}/p9-02-email.png`);
    await phone.clickText("Zrušit", "button");
  });

  await step(
    "the office finds protocols in the list, on the building and the customer",
    async () => {
      await office.goto(`${APP}/inspections`);
      await office.waitForText(`${year}-0001`);
      await office.goto(`${APP}/sites/${siteId}`);
      await office.waitForText("Protokoly (1)");
      await office.waitForText(`${year}-0001`);
      await office.goto(`${APP}/customers/${customerId}`);
      await office.waitForText("Protokoly (1)");
      const link = await office.evaluate(
        `document.querySelector('a[aria-label="Stáhnout protokol ${year}-0001"]')?.getAttribute("href")`,
      );
      if (link !== `${inspectionUrl}/protocol`) throw new Error(`download link ${link}`);
      await office.screenshot(`${OUT}/p9-03-customer.png`);
    },
  );

  await step(
    "an older inspection gets its protocol on request, in the company's language",
    async () => {
      await updateRows("organizations", `id=eq.${org}`, { default_locale: "en" });
      const [older] = await insertRows("inspections", [
        {
          organization_id: org,
          site_id: siteId,
          status: "completed",
          started_by: owner.id,
          completed_by: owner.id,
          completed_at: new Date(Date.now() - 86_400_000).toISOString(),
        },
      ]);
      await office.goto(`${APP}/inspections/${older.id}`);
      await office.waitForText(
        "Tato revize byla dokončena dřív, než aplikace vytvářela protokoly.",
      );
      await office.clickText("Vytvořit protokol", "button");
      await office.waitForText(`Protokol ${year}-0002 je připravený.`);
      await office.waitForText("Stáhnout PDF");
      const file = await download(office, `/inspections/${older.id}/protocol`);
      const link = await protocolLink(office, `/inspections/${older.id}/protocol`);
      if (file.head !== "%PDF-" || !link.location.includes(`download=Report-${year}-0002.pdf`))
        throw new Error(`english download ${JSON.stringify({ file, link })}`);
      await office.screenshot(`${OUT}/p9-04-created.png`);
    },
  );

  await step("nobody else can download it", async () => {
    const response = await fetch(`${APP}${inspectionUrl}/protocol`, { redirect: "manual" });
    // Signed out: the proxy sends the browser to the login page, not to the file.
    const location = response.headers.get("location") ?? "";
    if (!(response.status >= 300 && response.status < 400) || !location.includes("/login"))
      throw new Error(`signed out: ${response.status} ${location}`);
  });
} catch {
  // A failed step fails the suite (and stops the npm run e2e chain).
  process.exitCode = 1;
  await phone.screenshot(`${OUT}/p9-failure.png`);
  if (office) await office.screenshot(`${OUT}/p9-failure-office.png`);
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  if (office) await office.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

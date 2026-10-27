// Part 22 walkthrough (stage A): protocols drawn by templates. A technician
// completes an inspection with the customer's signature; its protocol records
// the company's template version and a snapshot of its data, and drawn again
// from them it matches the stored PDF. The company then publishes a new version
// of its template: the issued protocol stays exactly as it was, the next one
// follows the new version. A technician may not redraw protocols.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

const answer = (page, questionLabel, choice) =>
  page.evaluate(`(() => {
    const group = document.querySelector('[role=group][aria-label=${JSON.stringify(questionLabel)}]');
    [...group.querySelectorAll("button")].find((b) => b.innerText.includes(${JSON.stringify(choice)})).click();
  })()`);

const drawSignature = (page, selector) =>
  page.evaluate(`(() => {
    const canvas = document.querySelector(${JSON.stringify(selector)});
    const rect = canvas.getBoundingClientRect();
    const fire = (type, x, y) =>
      canvas.dispatchEvent(new PointerEvent(type, {
        clientX: rect.left + x, clientY: rect.top + y, pointerId: 7, bubbles: true, cancelable: true,
      }));
    fire("pointerdown", 15, 15);
    fire("pointermove", 45, 45);
    fire("pointermove", 90, 20);
    fire("pointerup", 90, 20);
  })()`);

/** A file as the signed-in page downloads it (following redirects); null on an error status. */
async function fetchBytes(page, path) {
  const result = await page.evaluate(`(async () => {
    const response = await fetch(${JSON.stringify(path)});
    if (!response.ok) return { status: response.status };
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { status: response.status, base64: btoa(binary) };
  })()`);
  return result.base64 ? Buffer.from(result.base64, "base64") : null;
}

/** Every text with its position, and the number of images, page by page. */
async function layout(pdf) {
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const document = await task.promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => "str" in item && item.str.trim())
      .map((item) => `${item.str}@${Math.round(item.transform[4])},${Math.round(item.transform[5])}`);
    const operators = await page.getOperatorList();
    pages.push({ text, images: operators.fnArray.filter((fn) => fn === 85).length });
  }
  await task.destroy();
  return pages;
}

const words = (pages) => pages.flatMap((page) => page.text.map((entry) => entry.split("@")[0])).join("\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The first page as a picture, for a look. */
async function picture(pdf, file) {
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const page = await (await task.promise).getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  await task.destroy();
}

let phone = await launch({ width: 390, height: 844, mobile: true });
let office;
let org;
let devices;
let questions;
let siteId;
let firstUrl;
let firstStored;
let defaultTemplate;
try {
  const owner = await createUser("part22-owner");
  const tech = await createUser("part22-tech");

  await step("setup: company, customer, building and two devices", async () => {
    office = await launch({ width: 1440, height: 900 });
    await signIn(office, owner);
    await office.waitForUrl("/onboarding");
    await office.type("#organizationName", "Revize Šablona");
    await office.type("#displayName", "Šárka Šablonová");
    await office.clickText("Vytvořit firmu");
    await office.waitForText("Vítejte, Šárka");
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
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
      { organization_id: org, name: "SVJ Šablonová", company_id: "12345678" },
    ]);
    const [site] = await insertRows("sites", [
      { organization_id: org, customer_id: customer.id, name: "Šablonová 22", address: "Šablonová 22, Praha" },
    ]);
    siteId = site.id;
    devices = await insertRows(
      "devices",
      [1, 2].map((n) => ({
        organization_id: org,
        site_id: siteId,
        device_type_id: type.id,
        status: "active",
        serial_number: `P22-${n}`,
        manufacturer: "Hasco",
        manufacture_year: 2020 + n,
        attributes: {},
      })),
    );
    [defaultTemplate] = await selectRows(
      "protocol_templates",
      `organization_id=eq.${org}&select=id,name,is_default,current_version_id`,
    );
    if (!defaultTemplate?.is_default || !defaultTemplate.current_version_id)
      throw new Error(`no default template: ${JSON.stringify(defaultTemplate)}`);
  });

  const required = () => questions.filter((q) => q.required && q.item_type === "pass_fail");
  const inspect = async (signed) => {
    await phone.goto(`${APP}/sites/${siteId}`);
    await phone.clickText("Zahájit revizi");
    await phone.waitForText("Zkontrolováno 0 z 2");
    const url = new URL(await phone.url()).pathname;
    for (const device of devices) {
      await phone.goto(`${APP}${url}/check/${device.id}`);
      await phone.waitForText("Uloženo");
      for (const question of required()) await answer(phone, question.label, "Vyhovuje");
      await sleep(300);
      await phone.waitForText("Uloženo");
      await phone.clickText("Hotovo", "button");
    }
    await phone.waitForText("Zkontrolováno 2 z 2");
    await phone.clickText("Dokončit revizi", "a");
    await phone.waitForText("Podpis zákazníka");
    if (signed) {
      await drawSignature(phone, 'canvas[aria-label="Podpis zákazníka"]');
      await phone.type("#signerName", "Jana Malá");
    }
    await phone.clickText("Dokončit revizi", "button");
    await phone.waitForText("Revize dokončena.");
    return url;
  };
  const protocolRow = async (url) => {
    const inspection = url.split("/").pop();
    const [row] = await selectRows(
      "protocols",
      `inspection_id=eq.${inspection}&active=eq.true&select=id,template_version_id,snapshot,pdf_path`,
    );
    return row;
  };

  await step("the protocol records the template version and a snapshot of its data", async () => {
    await signIn(phone, tech);
    await phone.waitForText("Vítejte, Tomáš");
    firstUrl = await inspect(true);
    const row = await protocolRow(firstUrl);
    if (row.template_version_id !== defaultTemplate.current_version_id)
      throw new Error(`template version ${row.template_version_id}`);
    const snapshot = row.snapshot;
    if (snapshot?.schema !== 1 || snapshot.input.checks.length !== 2)
      throw new Error(`snapshot: ${JSON.stringify(snapshot)?.slice(0, 300)}`);
    if (!snapshot.images.signature?.base64) throw new Error("the signature is not in the snapshot");
    if (snapshot.input.checks[0].manufacturer !== "Hasco") throw new Error("device details missing");
  });

  await step("drawn again from the snapshot it is the stored protocol", async () => {
    firstStored = await fetchBytes(office, `${firstUrl}/protocol`);
    const redrawn = await fetchBytes(office, `${firstUrl}/protocol?redraw`);
    if (!firstStored || !redrawn) throw new Error("download failed");
    const [stored, again] = [await layout(firstStored), await layout(redrawn)];
    if (JSON.stringify(stored) !== JSON.stringify(again))
      throw new Error(`redraw differs:\n${words(stored)}\n---\n${words(again)}`);
    const text = words(stored);
    for (const expected of ["Protokol o revizi", "SVJ Šablonová", "P22-1", "Jana Malá", "PŘEVZAL(A) ZA ZÁKAZNÍKA"])
      if (!text.includes(expected)) throw new Error(`missing "${expected}" in\n${text}`);
    // The signature is drawn into the protocol.
    if (stored[0].images < 1) throw new Error("no signature image");
    await picture(firstStored, `${OUT}/p22-01-protocol.png`);
  });

  await step("a technician may not redraw protocols", async () => {
    const response = await phone.evaluate(
      `fetch(${JSON.stringify(`${firstUrl}/protocol?redraw`)}).then((r) => r.status)`,
    );
    if (response !== 404) throw new Error(`technician redraw: ${response}`);
  });

  await step("a new template version: the issued protocol stays, the next one follows it", async () => {
    const [current] = await selectRows(
      "protocol_template_versions",
      `id=eq.${defaultTemplate.current_version_id}&select=content`,
    );
    const content = structuredClone(current.content);
    content.blocks = content.blocks.filter((block) => block.type !== "signatures");
    content.blocks[0].title = "Zpráva o kontrole PBZ";
    const [version] = await insertRows("protocol_template_versions", [
      {
        organization_id: org,
        template_id: defaultTemplate.id,
        version: 2,
        content,
        note: "Bez podpisů, jiný název",
      },
    ]);
    await updateRows("protocol_templates", `id=eq.${defaultTemplate.id}`, {
      current_version_id: version.id,
    });

    const secondUrl = await inspect(false);
    const second = await protocolRow(secondUrl);
    if (second.template_version_id !== version.id)
      throw new Error(`second protocol's version ${second.template_version_id}`);
    const secondPdf = await fetchBytes(office, `${secondUrl}/protocol`);
    const secondText = words(await layout(secondPdf));
    if (!secondText.includes("Zpráva o kontrole PBZ") || secondText.includes("PŘEVZAL(A) ZA ZÁKAZNÍKA"))
      throw new Error(`second protocol:\n${secondText}`);
    await picture(secondPdf, `${OUT}/p22-02-new-version.png`);

    // The first protocol: the same file, and drawn again still as issued.
    const storedAgain = await fetchBytes(office, `${firstUrl}/protocol`);
    if (hash(storedAgain) !== hash(firstStored)) throw new Error("the stored protocol changed");
    const redrawn = await fetchBytes(office, `${firstUrl}/protocol?redraw`);
    if (JSON.stringify(await layout(redrawn)) !== JSON.stringify(await layout(firstStored)))
      throw new Error("the issued protocol redraws differently after the new version");
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await phone.screenshot(`${OUT}/p22-failure-phone.png`).catch(() => {});
  await office?.screenshot(`${OUT}/p22-failure-office.png`).catch(() => {});
} finally {
  const logs = [...phone.logs, ...(office?.logs ?? [])];
  await phone.close();
  await office?.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

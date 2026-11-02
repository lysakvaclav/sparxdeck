// Part 31 walkthrough: AI assistants over MCP. The owner turns them on (and
// changes) on the AI assistants page; a personal token is shown once and works
// against /api/mcp; an assistant's OAuth sign-in goes through the real consent
// page (company, changes ticked, Allow) and its code becomes a token with the
// write scope; a revoked token stops at once; the usage table lists the calls;
// a technician sees only their own connections and can't flip the switches;
// dark mode, English and the phone.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { launch, sleep } from "./driver.mjs";
import { APP, addMember, cleanup, createUser, insertRows, organizationOf, selectRows, signIn } from "./support.mjs";

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

const PROTOCOL = "2026-07-28";
/** A modern MCP request from outside the browser, as an assistant sends it. */
async function mcp(token, method, params = {}) {
  const name = params.name ?? params.uri;
  const response = await fetch(`${APP}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      "Mcp-Method": method,
      ...(name ? { "Mcp-Name": name } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": PROTOCOL,
          "io.modelcontextprotocol/clientInfo": { name: "e2e", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

const page = await launch({ width: 1440, height: 900 });
let owner;
let tech;
let org;
let personalToken;

try {
  owner = await createUser("part31-owner");
  tech = await createUser("part31-tech");

  await step("setup: a company with a building and a device", async () => {
    await signIn(page, owner);
    await page.waitForUrl("/onboarding");
    await page.type("#organizationName", "Revize s AI");
    await page.type("#displayName", "Olga Majitelová");
    await page.clickText("Vytvořit firmu");
    await page.waitForText("Vítejte, Olga", 30000);
    org = await organizationOf(owner);
    await addMember(org, tech, "technician", "Tomáš Technik");
    const [customer] = await insertRows("customers", [{ organization_id: org, name: "SVJ Lipová" }]);
    const [site] = await insertRows("sites", [{ organization_id: org, customer_id: customer.id, name: "Lipová 12" }]);
    const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
    await insertRows("devices", [{ organization_id: org, site_id: site.id, device_type_id: type.id, attributes: {} }]);
  });

  await step("the owner turns AI assistants on, with changes", async () => {
    await page.goto(`${APP}/assistants`);
    await page.waitForText("Stav ve firmě");
    await page.waitForText("Vypnuto");
    await page.click("#mcp-enabled");
    await page.click("#mcp-write");
    await page.clickText("Uložit");
    await page.waitForText("Uloženo");
    await page.goto(`${APP}/assistants`);
    await page.waitForText("Čtení i změny");
    await page.screenshot(`${OUT}/part31-01-assistants.png`);
  });

  await step("a personal token is shown once and works against /api/mcp", async () => {
    await page.type("#token-name", "Claude Code na notebooku");
    await page.clickText("Vytvořit token");
    await page.waitForText("Token je vytvořený");
    personalToken = await page.evaluate(
      `[...document.querySelectorAll("input[readonly]")].map((el) => el.value).find((v) => v.startsWith("sxd_pat_"))`,
    );
    if (!personalToken) throw new Error("token not shown");
    const list = await mcp(personalToken, "tools/list");
    if (list.status !== 200) throw new Error(`tools/list ${list.status}`);
    const names = list.body.result.tools.map((tool) => tool.name);
    if (!names.includes("get_overview") || names.includes("create_defect"))
      throw new Error(`unexpected tools: ${names.join(",")}`);
    const overview = await mcp(personalToken, "tools/call", { name: "get_overview", arguments: {} });
    if (overview.body.result.structuredContent.company.name !== "Revize s AI") throw new Error("wrong company");
    await page.screenshot(`${OUT}/part31-02-token.png`);
    await page.clickText("Hotovo");
  });

  let accessToken;
  await step("an assistant signs in through the consent page and gets a write token", async () => {
    const redirectUri = "http://127.0.0.1:47123/callback";
    const registered = await (
      await fetch(`${APP}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirectUri] }),
      })
    ).json();
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = randomBytes(8).toString("hex");
    const query = new URLSearchParams({
      response_type: "code",
      client_id: registered.client_id,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: "sparxdeck:read sparxdeck:write",
      state,
      resource: `${APP}/api/mcp`,
    });
    await page.goto(`${APP}/oauth/authorize?${query}`);
    await page.waitForText("Připojit AI asistenta");
    await page.waitForText("Po odpovědi se vrátíte na 127.0.0.1:47123");
    await page.screenshot(`${OUT}/part31-03-consent.png`);
    // The assistant listens on a loopback port, as desktop clients do.
    let landed = "";
    const listener = http.createServer((request, response) => {
      landed = `http://127.0.0.1:47123${request.url}`;
      response.end("ok");
    });
    await new Promise((resolve) => listener.listen(47123, "127.0.0.1", resolve));
    try {
      await page.click('input[name="allow_write"]');
      await page.clickText("Povolit přístup");
      await until("redirect back to the assistant", async () => landed.startsWith(redirectUri));
    } finally {
      listener.close();
    }
    const back = new URL(landed);
    if (back.searchParams.get("state") !== state) throw new Error(`state lost: ${back}`);
    const code = back.searchParams.get("code");
    if (!code) throw new Error(`no code: ${back}`);
    const tokens = await (
      await fetch(`${APP}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: registered.client_id,
          redirect_uri: redirectUri,
          resource: `${APP}/api/mcp`,
        }),
      })
    ).json();
    if (tokens.scope !== "sparxdeck:read sparxdeck:write") throw new Error(`scope ${tokens.scope}`);
    accessToken = tokens.access_token;
    const list = await mcp(accessToken, "tools/list");
    if (!list.body.result.tools.some((tool) => tool.name === "create_defect")) throw new Error("no write tools");
  });

  await step("a revoked token stops at once; the usage table lists the calls", async () => {
    await page.goto(`${APP}/assistants`);
    await page.waitForText("Připojení ve firmě");
    await page.waitForText("Claude Code na notebooku");
    await page.waitForText("get_overview");
    // The personal token is the second connection (the assistant's is newest).
    await page.evaluate(
      `[...document.querySelectorAll("tr")].find((row) => row.textContent.includes("Claude Code na notebooku")).querySelector("button").click()`,
    );
    await page.waitForText("Zrušit připojení?");
    await page.clickText("Zrušit", "[role=alertdialog] button");
    await page.waitForText("Připojení je zrušené.");
    const after = await mcp(personalToken, "tools/list");
    if (after.status !== 401) throw new Error(`revoked token answered ${after.status}`);
    const stillOk = await mcp(accessToken, "tools/list");
    if (stillOk.status !== 200) throw new Error("the other connection stopped too");
    await page.screenshot(`${OUT}/part31-04-revoked.png`);
  });

  await step("a technician sees only their own connections and can't flip the switches", async () => {
    const techPage = await launch({ width: 390, height: 844, mobile: true });
    try {
      await signIn(techPage, tech);
      await techPage.waitForText("Vítejte", 30000);
      await techPage.goto(`${APP}/assistants`);
      await techPage.waitForText("Zapnout nebo vypnout je může jen vlastník firmy.");
      await techPage.waitForText("Moje připojení");
      const disabled = await techPage.evaluate(`document.querySelector("#mcp-enabled").disabled`);
      if (!disabled) throw new Error("switch enabled for a technician");
      await techPage.screenshot(`${OUT}/part31-05-technician-phone.png`);
    } finally {
      await techPage.close();
    }
  });

  await step("dark mode and English", async () => {
    const dark = await launch({ width: 1440, height: 900, dark: true });
    try {
      await signIn(dark, owner);
      await dark.waitForText("Vítejte, Olga", 30000);
      await dark.evaluate(`document.cookie = "NEXT_LOCALE=en; path=/"`);
      await dark.goto(`${APP}/assistants`);
      await dark.waitForText("Company setting");
      await dark.waitForText("Connections in the company");
      await dark.screenshot(`${OUT}/part31-06-dark-en.png`);
    } finally {
      await dark.close();
    }
  });
} catch {
  process.exitCode = 1;
  await page.screenshot(`${OUT}/part31-failure.png`).catch(() => {});
} finally {
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
}

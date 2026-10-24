// Part 19 walkthrough: the calendar shows devices coming due, the owner plans
// a visit from a day and assigns a technician, the workload view and the
// building's page show it; a defect gets a person and a fix-by date that has
// passed; the technician sees both on the dashboard ("My work") and the
// calendar on a phone. Dark mode and English.
// Run: npm run e2e (needs the app on port 3001 and .env.local).
import { launch } from "./driver.mjs";
import {
  APP,
  addMember,
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

/** A calendar day `days` from today (UTC is close enough for a test a few days ahead). */
const dayFrom = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** The same day a number of months earlier (the inspection that makes a device due then). */
const monthsBefore = (iso, months) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
};

/** Sets an input's value the way typing would (date inputs can't take typed text). */
const setValue = (page, selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);

let page = await launch({ width: 1440, height: 900 });
try {
  const owner = await createUser("part19-owner");
  const technician = await createUser("part19-tech");
  const dueDay = dayFrom(5);
  let org;
  let site;
  let device;

  await step(
    "owner sets up a company with a building whose devices come due in 5 days",
    async () => {
      await signIn(page, owner);
      await page.waitForUrl("/onboarding");
      await page.type("#organizationName", "Revize Devatenáct");
      await page.type("#displayName", "Olga Devatenáctá");
      await page.clickText("Vytvořit firmu");
      await page.waitForText("Vítejte, Olga");
      org = await organizationOf(owner);
      await addMember(org, technician, "technician", "Tomáš Technik");
      const [customer] = await insertRows("customers", [
        { organization_id: org, name: "SVJ Kalendářní" },
      ]);
      [site] = await insertRows("sites", [
        { organization_id: org, customer_id: customer.id, name: "Kalendářní 7" },
      ]);
      const [type] = await selectRows("device_types", `organization_id=eq.${org}&select=id`);
      const devices = await insertRows(
        "devices",
        [1, 2, 3].map(() => ({
          organization_id: org,
          site_id: site.id,
          device_type_id: type.id,
          last_inspection_on: monthsBefore(dueDay, 12),
        })),
      );
      device = devices[0];
    },
  );

  await step("the calendar shows the devices on their day and plans a visit from it", async () => {
    await page.goto(`${APP}/calendar?month=${dueDay.slice(0, 7)}`);
    await page.waitForText("Termíny revizí zařízení");
    const cell = await page.evaluate(`document.querySelector('[data-day="${dueDay}"]').innerText`);
    if (!cell.includes("3 zařízení k revizi")) throw new Error(`day cell: ${cell}`);
    await page.click(`.hidden.md\\:block [data-day="${dueDay}"]`);
    await page.waitForText("Termíny revizí");
    await page.waitForText("Kalendářní 7");
    await page.clickText("Naplánovat", "button");
    await page.waitForText("Naplánovat revizi");
    const preset = await page.evaluate(
      `[document.getElementById("plan-site").value, document.getElementById("plan-date").value]`,
    );
    if (preset[0] !== site.id || preset[1] !== dueDay)
      throw new Error(`plan dialog preset ${JSON.stringify(preset)}`);
    await page.selectValue("#plan-technician", technician.id);
    await page.type("#plan-note", "Klíče u správce, přízemí");
    await page.screenshot(`${OUT}/p19-01-plan.png`);
    await page.clickText("Naplánovat", "button");
    await page.waitForText("Revize je naplánovaná.");
    const [plan] = await selectRows(
      "inspection_plans",
      `organization_id=eq.${org}&select=site_id,planned_on,technician_id,note`,
    );
    if (
      plan?.site_id !== site.id ||
      plan.planned_on !== dueDay ||
      plan.technician_id !== technician.id ||
      plan.note !== "Klíče u správce, přízemí"
    )
      throw new Error(`plan ${JSON.stringify(plan)}`);
    await page.goto(`${APP}/calendar?month=${dueDay.slice(0, 7)}`);
    await page.waitForText("Kalendářní 7");
    await page.screenshot(`${OUT}/p19-02-month.png`);
  });

  await step("the workload view and the building's page show the visit", async () => {
    await page.goto(`${APP}/calendar?view=workload`);
    await page.waitForText("Tomáš Technik");
    await page.waitForText("1 revize");
    await page.waitForText("3 zařízení");
    await page.screenshot(`${OUT}/p19-03-workload.png`);
    await page.goto(`${APP}/sites/${site.id}`);
    await page.waitForText("Plánované revize");
    await page.waitForText("Tomáš Technik");
  });

  let defect;
  await step("a defect gets a technician and a fix-by date that has passed", async () => {
    [defect] = await insertRows("defects", [
      {
        organization_id: org,
        device_id: device.id,
        description: "Prasklá hadice",
        severity: "major",
      },
    ]);
    await page.goto(`${APP}/defects/${defect.id}`);
    await page.waitForText("Řešení");
    await page.selectValue("#defect-assignee", technician.id);
    await page.waitForText("přiřadil(a) závadu: Tomáš Technik");
    await setValue(page, "#defect-due", dayFrom(-1));
    await page.clickText("Uložit", "button");
    await page.waitForText("Termín odstranění uplynul");
    await page.waitForText("nastavil(a) termín odstranění");
    await page.screenshot(`${OUT}/p19-04-defect.png`);
    const [row] = await selectRows("defects", `id=eq.${defect.id}&select=assigned_to,due_on`);
    if (row.assigned_to !== technician.id || row.due_on !== dayFrom(-1))
      throw new Error(`defect ${JSON.stringify(row)}`);
    await page.goto(`${APP}/defects?due=overdue`);
    await page.waitForText("Prasklá hadice");
    await page.waitForText("Tomáš Technik");
  });

  await step(
    "the technician sees their visit and defect on the dashboard and the calendar on a phone",
    async () => {
      await page.close();
      page = await launch({ width: 390, height: 844, mobile: true });
      await signIn(page, technician);
      await page.waitForText("Moje práce");
      await page.waitForText("Kalendářní 7");
      await page.waitForText("1 závada přiřazená mně");
      await page.waitForText("1 po termínu odstranění");
      await page.screenshot(`${OUT}/p19-05-my-work.png`);
      await page.goto(`${APP}/calendar?month=${dueDay.slice(0, 7)}`);
      await page.waitForText("Kalendářní 7");
      // Technicians read the plan but don't get the planning button.
      const canPlan = await page.evaluate(
        `[...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Naplánovat revizi")`,
      );
      if (canPlan) throw new Error("a technician sees the planning button");
      await page.click(`.md\\:hidden [data-day="${dueDay}"]`);
      await page.waitForText("Klíče u správce, přízemí");
      await page.screenshot(`${OUT}/p19-06-phone-day.png`);
    },
  );

  await step("dark mode and English", async () => {
    await page.close();
    page = await launch({ width: 1440, height: 900, dark: true });
    await signIn(page, owner);
    await page.waitForText("Vítejte, Olga");
    await page.send("Network.setCookie", { name: "NEXT_LOCALE", value: "en", url: APP });
    await page.goto(`${APP}/calendar?month=${dueDay.slice(0, 7)}`);
    await page.waitForText("Devices' inspection dates");
    await page.waitForText("Kalendářní 7");
    await page.screenshot(`${OUT}/p19-07-dark-en.png`);
    await page.goto(`${APP}/defects/${defect.id}`);
    await page.waitForText("The fix-by date has passed");
    await page.screenshot(`${OUT}/p19-08-dark-en-defect.png`);
  });
} catch (error) {
  process.exitCode = 1;
  console.error("FAILURE:", error);
  await page.screenshot(`${OUT}/p19-failure.png`).catch(() => {});
} finally {
  const logs = [...page.logs];
  await page.close();
  await cleanup();
  console.log(results.join("\n"));
  console.log(logs.length ? `console:\n${logs.join("\n")}` : "console: clean");
}

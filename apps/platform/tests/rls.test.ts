/**
 * Tenant isolation against the real database (dev Supabase project from .env.local).
 * Creates throwaway users and organizations, checks that Row Level Security keeps
 * them apart, and deletes everything afterwards. Skipped when Supabase isn't configured.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInTimeZone } from "@/lib/due";
import type { Database, Json } from "@/lib/supabase/database.types";
import { generateToken, hashToken } from "@/lib/tokens";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
type TestUser = { id: string; email: string; client: Client };

const run = randomUUID().slice(0, 8);
const password = `Rls-${randomUUID()}`;

let admin: Client;
const users: TestUser[] = [];

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${run}@sparxdeck.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = createClient<Database>(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const user = { id: data.user.id, email, client };
  users.push(user);
  return user;
}

const organizations: string[] = [];

async function createOrg(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_organization", {
    p_name: name,
    p_display_name: name,
  });
  if (error || !data) throw error ?? new Error("create_organization failed");
  organizations.push(data);
  return data;
}

describe.skipIf(!configured)("row level security: organizations are isolated", () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    [alice, bob, carol] = await Promise.all([
      createUser("alice"),
      createUser("bob"),
      createUser("carol"),
    ]);
    orgA = await createOrg(alice, `RLS A ${run}`);
    orgB = await createOrg(bob, `RLS B ${run}`);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const org of organizations) {
      const { data: files } = await admin.storage.from("org-assets").list(org);
      if (files?.length)
        await admin.storage.from("org-assets").remove(files.map((f) => `${org}/${f.name}`));
    }
    await admin.from("organizations").delete().in("id", organizations);
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)));
  });

  it("each user sees only their own organization", async () => {
    const { data: aOrgs } = await alice.client.from("organizations").select("id");
    const { data: bOrgs } = await bob.client.from("organizations").select("id");
    expect(aOrgs?.map((o) => o.id)).toEqual([orgA]);
    expect(bOrgs?.map((o) => o.id)).toEqual([orgB]);
  });

  it("each user sees only their own teammates", async () => {
    const { data } = await alice.client.from("memberships").select("organization_id, user_id");
    expect(data).toEqual([{ organization_id: orgA, user_id: alice.id }]);
  });

  it("cannot read another organization even by id", async () => {
    const { data } = await alice.client.from("organizations").select("id").eq("id", orgB);
    expect(data).toEqual([]);
  });

  it("cannot rename another organization", async () => {
    await alice.client.from("organizations").update({ name: "hacked" }).eq("id", orgB);
    const { data } = await admin.from("organizations").select("name").eq("id", orgB).single();
    expect(data?.name).toBe(`RLS B ${run}`);
  });

  it("cannot invite people into another organization", async () => {
    const { error } = await alice.client.from("invitations").insert({
      organization_id: orgB,
      email: `intruder-${run}@sparxdeck.test`,
      role: "admin",
      token_hash: hashToken(generateToken()),
      invited_by: alice.id,
    });
    expect(error).not.toBeNull();
  });

  it("cannot create a second organization", async () => {
    const { error } = await alice.client.rpc("create_organization", {
      p_name: "Second",
      p_display_name: "A",
    });
    expect(error?.message).toContain("already_member");
  });

  it("anonymous visitors see nothing", async () => {
    const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
    const { data } = await anon.from("organizations").select("id");
    expect(data ?? []).toEqual([]);
  });

  describe("invitations", () => {
    let token: string;

    it("an owner can invite into their own organization, and other orgs can't see it", async () => {
      token = generateToken();
      const { error } = await alice.client.from("invitations").insert({
        organization_id: orgA,
        email: carol.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: alice.id,
      });
      expect(error).toBeNull();

      const { data } = await bob.client.from("invitations").select("id");
      expect(data).toEqual([]);
    });

    it("cannot be accepted by someone with a different e-mail", async () => {
      const { error } = await bob.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Bob",
      });
      expect(error?.message).toMatch(/invitation_email_mismatch|already_member/);
    });

    it("the invitee joins as technician and sees only that organization", async () => {
      const { data: joined, error } = await carol.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Carol",
      });
      expect(error).toBeNull();
      expect(joined).toBe(orgA);

      const { data: orgs } = await carol.client.from("organizations").select("id");
      expect(orgs?.map((o) => o.id)).toEqual([orgA]);
    });

    it("a used invitation can't be accepted again", async () => {
      const { error } = await carol.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Carol",
      });
      expect(error).not.toBeNull();
    });

    it("a technician can't invite or change organization details", async () => {
      const { error: inviteError } = await carol.client.from("invitations").insert({
        organization_id: orgA,
        email: `someone-${run}@sparxdeck.test`,
        role: "admin",
        token_hash: hashToken(generateToken()),
        invited_by: carol.id,
      });
      expect(inviteError).not.toBeNull();

      await carol.client.from("organizations").update({ name: "renamed by tech" }).eq("id", orgA);
      const { data } = await admin.from("organizations").select("name").eq("id", orgA).single();
      expect(data?.name).toBe(`RLS A ${run}`);
    });
  });
  describe("organization settings and files", () => {
    // 1×1 transparent PNG.
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );

    it("the database rejects an invalid time zone or threshold", async () => {
      const { error: tzError } = await alice.client
        .from("organizations")
        .update({ timezone: "Mars/Olympus" })
        .eq("id", orgA);
      expect(tzError?.message).toContain("invalid_timezone");
      const { error: daysError } = await alice.client
        .from("organizations")
        .update({ due_soon_days: 0 })
        .eq("id", orgA);
      expect(daysError).not.toBeNull();
      const { error: okError } = await alice.client
        .from("organizations")
        .update({ timezone: "Asia/Tbilisi", due_soon_days: 45 })
        .eq("id", orgA);
      expect(okError).toBeNull();
    });

    it("a technician can't change settings", async () => {
      await carol.client.from("organizations").update({ due_soon_days: 7 }).eq("id", orgA);
      const { data } = await admin
        .from("organizations")
        .select("due_soon_days")
        .eq("id", orgA)
        .single();
      expect(data?.due_soon_days).toBe(45);
    });

    it("the owner uploads a logo into the organization's folder", async () => {
      const { error } = await alice.client.storage
        .from("org-assets")
        .upload(`${orgA}/logo-test.png`, png, { contentType: "image/png" });
      expect(error).toBeNull();
      const { error: pathError } = await alice.client
        .from("organizations")
        .update({ logo_path: `${orgA}/logo-test.png` })
        .eq("id", orgA);
      expect(pathError).toBeNull();
    });

    it("the logo path can't point into another organization's folder", async () => {
      const { error } = await alice.client
        .from("organizations")
        .update({ logo_path: `${orgB}/logo.png` })
        .eq("id", orgA);
      expect(error).not.toBeNull();
    });

    it("teammates can read the logo, other organizations and visitors can't", async () => {
      const { error: carolError } = await carol.client.storage
        .from("org-assets")
        .download(`${orgA}/logo-test.png`);
      expect(carolError).toBeNull();

      const { data: bobData } = await bob.client.storage
        .from("org-assets")
        .download(`${orgA}/logo-test.png`);
      expect(bobData).toBeNull();
      const { data: bobList } = await bob.client.storage.from("org-assets").list(orgA);
      expect(bobList ?? []).toEqual([]);

      const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
      const { data: anonData } = await anon.storage
        .from("org-assets")
        .download(`${orgA}/logo-test.png`);
      expect(anonData).toBeNull();
    });

    it("technicians and other organizations can't upload", async () => {
      const { error: carolError } = await carol.client.storage
        .from("org-assets")
        .upload(`${orgA}/sneaky.png`, png, { contentType: "image/png" });
      expect(carolError).not.toBeNull();
      const { error: aliceIntoB } = await alice.client.storage
        .from("org-assets")
        .upload(`${orgB}/sneaky.png`, png, { contentType: "image/png" });
      expect(aliceIntoB).not.toBeNull();
    });

    it("the bucket rejects files that aren't allowed images", async () => {
      const { error } = await alice.client.storage
        .from("org-assets")
        .upload(`${orgA}/page.html`, new TextEncoder().encode("<script>alert(1)</script>"), {
          contentType: "text/html",
        });
      expect(error).not.toBeNull();
    });
  });

  describe("customers, sites and locations", () => {
    let customerA: string;
    let siteA: string;
    let customerB: string;

    it("an owner creates a customer, a site and locations", async () => {
      const { data: customer, error } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Bytové družstvo Lipová", company_id: "27082440" })
        .select("id")
        .single();
      expect(error).toBeNull();
      customerA = customer!.id;

      const { data: site, error: siteError } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customerA, name: "Lipová 12" })
        .select("id")
        .single();
      expect(siteError).toBeNull();
      siteA = site!.id;

      const { error: locationError } = await alice.client.from("locations").insert([
        { organization_id: orgA, site_id: siteA, name: "Suterén", sort_order: 1 },
        { organization_id: orgA, site_id: siteA, name: "1. patro", sort_order: 2 },
        { organization_id: orgA, site_id: siteA, name: "2. patro", sort_order: 3 },
      ]);
      expect(locationError).toBeNull();

      const { data: other } = await bob.client
        .from("customers")
        .insert({ organization_id: orgB, name: "Customer of B" })
        .select("id")
        .single();
      customerB = other!.id;
    });

    it("another organization can't read or change them", async () => {
      const [{ data: customers }, { data: sites }, { data: locations }] = await Promise.all([
        bob.client.from("customers").select("id").eq("id", customerA),
        bob.client.from("sites").select("id").eq("id", siteA),
        bob.client.from("locations").select("id").eq("site_id", siteA),
      ]);
      expect(customers).toEqual([]);
      expect(sites).toEqual([]);
      expect(locations).toEqual([]);

      const { data: updated } = await bob.client
        .from("customers")
        .update({ name: "hijacked" })
        .eq("id", customerA)
        .select("id");
      expect(updated).toEqual([]);
      const { error: insertError } = await bob.client
        .from("customers")
        .insert({ organization_id: orgA, name: "planted" });
      expect(insertError).not.toBeNull();
    });

    it("a site can't be attached to another organization's customer", async () => {
      // Bob's own organization, Alice's customer: the composite foreign key refuses it.
      const { error } = await bob.client
        .from("sites")
        .insert({ organization_id: orgB, customer_id: customerA, name: "cross-tenant" });
      expect(error).not.toBeNull();
      // And Alice can't attach a location in her org to a site id she doesn't own.
      const { data: bobSite } = await admin
        .from("sites")
        .insert({ organization_id: orgB, customer_id: customerB, name: "B site" })
        .select("id")
        .single();
      const { error: locationError } = await alice.client
        .from("locations")
        .insert({ organization_id: orgA, site_id: bobSite!.id, name: "cross-tenant" });
      expect(locationError).not.toBeNull();
    });

    it("a technician can read but not write", async () => {
      const { data: customers } = await carol.client
        .from("customers")
        .select("id")
        .eq("id", customerA);
      expect(customers?.map((c) => c.id)).toEqual([customerA]);
      const { data: locations } = await carol.client
        .from("locations")
        .select("id")
        .eq("site_id", siteA);
      expect(locations).toHaveLength(3);

      const { error: insertError } = await carol.client
        .from("customers")
        .insert({ organization_id: orgA, name: "by technician" });
      expect(insertError).not.toBeNull();
      const { data: updated } = await carol.client
        .from("sites")
        .update({ name: "renamed by tech" })
        .eq("id", siteA)
        .select("id");
      expect(updated).toEqual([]);
      const { data: deleted } = await carol.client
        .from("locations")
        .delete()
        .eq("site_id", siteA)
        .select("id");
      expect(deleted).toEqual([]);
      const { error: reorderError } = await carol.client.rpc("reorder_locations", {
        p_site: siteA,
        p_ordered: (locations ?? []).map((l) => l.id).reverse(),
      });
      // Security invoker: the update matches nothing for a technician.
      expect(reorderError).toBeNull();
      const { data: order } = await admin
        .from("locations")
        .select("name")
        .eq("site_id", siteA)
        .order("sort_order");
      expect(order?.map((l) => l.name)).toEqual(["Suterén", "1. patro", "2. patro"]);
    });

    it("customers and sites can't be hard-deleted, only soft-deleted", async () => {
      const { error } = await alice.client.from("customers").delete().eq("id", customerA);
      expect(error).not.toBeNull();
      const { data } = await admin.from("customers").select("id").eq("id", customerA);
      expect(data).toHaveLength(1);
    });

    it("locations are reordered atomically and must be the complete set", async () => {
      const { data: locations } = await alice.client
        .from("locations")
        .select("id, name")
        .eq("site_id", siteA)
        .order("sort_order");
      const ids = (locations ?? []).map((l) => l.id);

      const { error: partial } = await alice.client.rpc("reorder_locations", {
        p_site: siteA,
        p_ordered: ids.slice(1),
      });
      expect(partial?.message).toMatch(/locations_mismatch/);

      const { error } = await alice.client.rpc("reorder_locations", {
        p_site: siteA,
        p_ordered: [ids[2]!, ids[0]!, ids[1]!],
      });
      expect(error).toBeNull();
      const { data: order } = await alice.client
        .from("locations")
        .select("name")
        .eq("site_id", siteA)
        .order("sort_order");
      expect(order?.map((l) => l.name)).toEqual(["2. patro", "Suterén", "1. patro"]);
    });

    it("search input can't break out of the filter", async () => {
      const { ilikeAny } = await import("@/lib/search");
      const columns = ["name", "contact_person", "company_id"];
      const search = (q: string) =>
        alice.client
          .from("customers")
          .select("name")
          .eq("organization_id", orgA)
          .or(ilikeAny(columns, q)!);

      expect((await search("lipov")).data?.map((c) => c.name)).toEqual(["Bytové družstvo Lipová"]);
      expect((await search("27082440")).data).toHaveLength(1);
      for (const hostile of ["%", "_", "a,name.neq.x", "x),or(name.neq.", '"', "\\", "zz*zz"]) {
        const { data, error } = await search(hostile);
        expect(error, hostile).toBeNull();
        expect(data, hostile).toEqual([]);
      }
    });

    it("deleting a customer hides its sites, and no new site can be added under it", async () => {
      const { data, error } = await alice.client
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", customerA)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const { data: site } = await admin
        .from("sites")
        .select("deleted_at")
        .eq("id", siteA)
        .single();
      expect(site?.deleted_at).not.toBeNull();

      const { error: siteError } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customerA, name: "too late" });
      expect(siteError?.message).toMatch(/customer_deleted/);
    });
  });

  describe("device types and checklist templates", () => {
    let typeA: string;
    let firstVersion: string;
    const item = (
      label: string,
      type = "pass_fail",
      required = true,
      failCreatesDefect = false,
    ) => ({
      label,
      type,
      required,
      failCreatesDefect,
    });

    it("every organization starts with a sample fire extinguisher and checklist", async () => {
      const { data: types } = await alice.client
        .from("device_types")
        .select("id, code, inspection_interval_months, is_sample");
      expect(types).toHaveLength(1);
      expect(types?.[0]).toMatchObject({
        code: "fire_extinguisher",
        inspection_interval_months: 12,
        is_sample: true,
      });
      typeA = types![0]!.id;

      const { data: templates } = await alice.client
        .from("checklist_templates")
        .select("id, version, active, is_sample")
        .eq("device_type_id", typeA);
      expect(templates).toEqual([
        expect.objectContaining({ version: 1, active: true, is_sample: true }),
      ]);
      firstVersion = templates![0]!.id;

      const { data: items } = await alice.client
        .from("checklist_template_items")
        .select("sort_order, item_type, required, fail_creates_defect")
        .eq("template_id", firstVersion)
        .order("sort_order");
      expect(items).toHaveLength(7);
      expect(items?.[0]).toMatchObject({
        item_type: "pass_fail",
        required: true,
        fail_creates_defect: true,
      });
      expect(items?.[6]).toMatchObject({
        item_type: "text",
        required: false,
        fail_creates_defect: false,
      });
    });

    it("another organization can't see or change them", async () => {
      const { data } = await bob.client.from("device_types").select("id").eq("id", typeA);
      expect(data).toEqual([]);
      const { data: templates } = await bob.client
        .from("checklist_templates")
        .select("id")
        .eq("device_type_id", typeA);
      expect(templates).toEqual([]);
      const { error } = await bob.client.rpc("save_checklist_template", {
        p_device_type: typeA,
        p_name: "hijacked",
        p_items: [item("x")],
      });
      expect(error?.message).toMatch(/forbidden/);
    });

    it("a technician can read but not change types or templates", async () => {
      const { data } = await carol.client.from("device_types").select("id").eq("id", typeA);
      expect(data).toHaveLength(1);
      const { data: updated } = await carol.client
        .from("device_types")
        .update({ inspection_interval_months: 1 })
        .eq("id", typeA)
        .select("id");
      expect(updated).toEqual([]);
      const { error } = await carol.client.rpc("save_checklist_template", {
        p_device_type: typeA,
        p_name: "by technician",
        p_items: [item("x")],
      });
      expect(error?.message).toMatch(/forbidden/);
    });

    it("templates can't be written directly, only through a new version", async () => {
      const { error: insertError } = await alice.client.from("checklist_template_items").insert({
        organization_id: orgA,
        template_id: firstVersion,
        sort_order: 99,
        label: "planted",
        item_type: "text",
      } as never);
      expect(insertError).not.toBeNull();
      const { error: updateError } = await alice.client
        .from("checklist_templates")
        .update({ name: "renamed" } as never)
        .eq("id", firstVersion);
      expect(updateError).not.toBeNull();
    });

    it("the owner sets the interval; the database rejects nonsense", async () => {
      const { data, error } = await alice.client
        .from("device_types")
        .update({ inspection_interval_months: 6, is_sample: false })
        .eq("id", typeA)
        .select("inspection_interval_months");
      expect(error).toBeNull();
      expect(data?.[0]?.inspection_interval_months).toBe(6);
      const { error: zero } = await alice.client
        .from("device_types")
        .update({ inspection_interval_months: 0 })
        .eq("id", typeA);
      expect(zero).not.toBeNull();
      const { error: code } = await alice.client
        .from("device_types")
        .update({ code: "other" } as never)
        .eq("id", typeA);
      expect(code).not.toBeNull();
    });

    it("saving creates a new active version and keeps the old one untouched", async () => {
      const items = [
        item("Plomba je neporušená", "pass_fail", true, true),
        item("Tlak (bar)", "number"),
        item("Poznámka", "text", false),
      ];
      const { data: second, error } = await alice.client.rpc("save_checklist_template", {
        p_device_type: typeA,
        p_name: "Kontrola hasicího přístroje",
        p_items: items,
      });
      expect(error).toBeNull();
      expect(second).not.toBe(firstVersion);

      const { data: versions } = await alice.client
        .from("checklist_templates")
        .select("id, version, active, is_sample")
        .eq("device_type_id", typeA)
        .order("version");
      expect(versions?.map((v) => [v.version, v.active, v.is_sample])).toEqual([
        [1, false, true],
        [2, true, true],
      ]);

      const { count: oldCount } = await alice.client
        .from("checklist_template_items")
        .select("id", { count: "exact", head: true })
        .eq("template_id", firstVersion);
      expect(oldCount).toBe(7);
      const { data: newItems } = await alice.client
        .from("checklist_template_items")
        .select("label, item_type, required, fail_creates_defect")
        .eq("template_id", second!)
        .order("sort_order");
      expect(newItems).toEqual([
        {
          label: "Plomba je neporušená",
          item_type: "pass_fail",
          required: true,
          fail_creates_defect: true,
        },
        { label: "Tlak (bar)", item_type: "number", required: true, fail_creates_defect: false },
        { label: "Poznámka", item_type: "text", required: false, fail_creates_defect: false },
      ]);

      // Saving the same content again keeps version 2.
      const { data: same } = await alice.client.rpc("save_checklist_template", {
        p_device_type: typeA,
        p_name: " Kontrola hasicího přístroje ",
        p_items: items.map((entry) => ({ ...entry, label: ` ${entry.label}` })),
      });
      expect(same).toBe(second);

      // Confirming the items creates version 3 without the sample flag.
      const { data: third } = await alice.client.rpc("save_checklist_template", {
        p_device_type: typeA,
        p_name: "Kontrola hasicího přístroje",
        p_items: items,
        p_verified: true,
      });
      const { data: latest } = await alice.client
        .from("checklist_templates")
        .select("version, active, is_sample")
        .eq("id", third!)
        .single();
      expect(latest).toEqual({ version: 3, active: true, is_sample: false });
    });

    it("invalid templates are refused", async () => {
      for (const items of [
        [],
        [item("")],
        [item("Tlak", "number", true, true)],
        [{ label: "x", type: "photo", required: true, failCreatesDefect: false }],
      ]) {
        const { error } = await alice.client.rpc("save_checklist_template", {
          p_device_type: typeA,
          p_name: "Kontrola",
          p_items: items,
        });
        expect(error?.message, JSON.stringify(items)).toMatch(/invalid_template/);
      }
    });

    it("a new company is seeded in its creator's language", async () => {
      const dave = await createUser("dave");
      const { data: org, error } = await dave.client.rpc("create_organization", {
        p_name: `RLS EN ${run}`,
        p_display_name: "Dave",
        p_locale: "en",
      });
      expect(error).toBeNull();
      try {
        const { data: organization } = await dave.client
          .from("organizations")
          .select("default_locale")
          .eq("id", org!)
          .single();
        expect(organization?.default_locale).toBe("en");
        const { data: types } = await dave.client.from("device_types").select("name");
        expect(types?.map((t) => t.name)).toEqual(["Fire extinguisher"]);
      } finally {
        await admin.from("organizations").delete().eq("id", org!);
      }
    });
  });

  describe("devices and due dates", () => {
    let typeA: string;
    let siteA: string;
    let siteA2: string;
    let otherLocation: string;
    let first: string;
    const created: { id: string; label_number: number; public_token: string }[] = [];
    const columns = "id, label_number, public_token" as const;

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").single();
      typeA = type!.id;
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Devices customer" })
        .select("id")
        .single();
      const { data: sites } = await alice.client
        .from("sites")
        .insert([
          { organization_id: orgA, customer_id: customer!.id, name: "Device site" },
          { organization_id: orgA, customer_id: customer!.id, name: "Other site" },
        ])
        .select("id, name");
      siteA = sites!.find((s) => s.name === "Device site")!.id;
      siteA2 = sites!.find((s) => s.name === "Other site")!.id;
      const { data: location } = await alice.client
        .from("locations")
        .insert({ organization_id: orgA, site_id: siteA2, name: "Elsewhere" })
        .select("id")
        .single();
      otherLocation = location!.id;
    });

    const device = (extra: object = {}) => ({
      organization_id: orgA,
      site_id: siteA,
      device_type_id: typeA,
      ...extra,
    });

    it("label numbers count up per organization, in the order devices are added", async () => {
      const { data: one, error } = await alice.client
        .from("devices")
        .insert(device({ serial_number: "FIRST" }))
        .select(columns)
        .single();
      expect(error).toBeNull();
      expect(one?.label_number).toBe(1);
      first = one!.id;
      created.push(one!);

      const serials = ["S1", "S2", "S3", "S4", "S5"];
      const { data: bulk, error: bulkError } = await alice.client
        .from("devices")
        .insert(serials.map((serial_number) => device({ serial_number })))
        .select(`${columns}, serial_number`);
      expect(bulkError).toBeNull();
      expect(bulk?.map((d) => [d.label_number, d.serial_number])).toEqual([
        [2, "S1"],
        [3, "S2"],
        [4, "S3"],
        [5, "S4"],
        [6, "S5"],
      ]);
      created.push(...bulk!);

      // Bob's company has its own numbering.
      const { data: bobType } = await bob.client.from("device_types").select("id").single();
      const { data: bobCustomer } = await bob.client
        .from("customers")
        .insert({ organization_id: orgB, name: "B devices" })
        .select("id")
        .single();
      const { data: bobSite } = await bob.client
        .from("sites")
        .insert({ organization_id: orgB, customer_id: bobCustomer!.id, name: "B building" })
        .select("id")
        .single();
      const { data: bobDevice } = await bob.client
        .from("devices")
        .insert({ organization_id: orgB, site_id: bobSite!.id, device_type_id: bobType!.id })
        .select("label_number")
        .single();
      expect(bobDevice?.label_number).toBe(1);
    });

    it("labels stay unique and consecutive when devices are added at the same time", async () => {
      const batches = await Promise.all(
        [0, 1, 2, 3].map(() =>
          alice.client
            .from("devices")
            .insert(Array.from({ length: 5 }, () => device()))
            .select(columns),
        ),
      );
      const labels: number[] = [];
      for (const { data, error } of batches) {
        expect(error).toBeNull();
        const numbers = data!.map((d) => d.label_number);
        // Each insert gets a block without gaps.
        expect(numbers).toEqual(numbers.map((_, i) => numbers[0]! + i));
        labels.push(...numbers);
        created.push(...data!);
      }
      expect([...labels].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_, i) => 7 + i),
      );
    });

    it("every device gets a random 12-character label token", () => {
      const tokens = created.map((d) => d.public_token);
      for (const token of tokens) expect(token).toMatch(/^[0-9a-hjkmnp-tv-z]{12}$/);
      expect(new Set(tokens).size).toBe(tokens.length);
    });

    it("a scanned token finds the device only within its own organization", async () => {
      const token = created[0]!.public_token;
      const byToken = (client: Client) =>
        client.from("devices").select("id").eq("public_token", token).maybeSingle();
      expect((await byToken(alice.client)).data?.id).toBe(created[0]!.id);
      expect((await byToken(carol.client)).data?.id).toBe(created[0]!.id);
      // Another company and signed-out visitors get nothing, the same as for an unknown token.
      expect((await byToken(bob.client)).data).toBeNull();
      const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
      expect((await byToken(anon)).data).toBeNull();
    });

    it("label numbers, tokens, due dates and the site can't be written by clients", async () => {
      const { error: insertError } = await alice.client
        .from("devices")
        .insert(device({ label_number: 999 }) as never);
      expect(insertError).not.toBeNull();
      for (const change of [
        { label_number: 999 },
        { public_token: "0000000000aa" },
        { next_due_on: "2099-01-01" },
        { site_id: siteA2 },
        { organization_id: orgB },
      ]) {
        const { error } = await alice.client
          .from("devices")
          .update(change as never)
          .eq("id", first);
        expect(error, JSON.stringify(change)).not.toBeNull();
      }
      const { data } = await admin
        .from("devices")
        .select("label_number, next_due_on, site_id")
        .eq("id", first)
        .single();
      expect(data).toEqual({ label_number: 1, next_due_on: null, site_id: siteA });
    });

    it("the database computes next due dates exactly like the app", async () => {
      const { NEXT_DUE_CASES } = await import("./fixtures/due-cases");
      for (const [last, months, next] of NEXT_DUE_CASES) {
        await admin
          .from("device_types")
          .update({ inspection_interval_months: months })
          .eq("id", typeA);
        const { data, error } = await alice.client
          .from("devices")
          .update({ last_inspection_on: last })
          .eq("id", first)
          .select("next_due_on")
          .single();
        expect(error).toBeNull();
        expect(data?.next_due_on, `${last} + ${months}`).toBe(next);
      }
    });

    it("changing a type's interval moves its devices' due dates", async () => {
      await alice.client
        .from("devices")
        .update({ last_inspection_on: "2026-01-31" })
        .eq("id", first);
      await alice.client
        .from("device_types")
        .update({ inspection_interval_months: 12 })
        .eq("id", typeA);
      const read = async () =>
        (await admin.from("devices").select("next_due_on").eq("id", first).single()).data
          ?.next_due_on;
      expect(await read()).toBe("2027-01-31");
      await alice.client
        .from("device_types")
        .update({ inspection_interval_months: 1 })
        .eq("id", typeA);
      expect(await read()).toBe("2026-02-28");
      await alice.client.from("devices").update({ last_inspection_on: null }).eq("id", first);
      expect(await read()).toBeNull();
    });

    it("another organization can't see, change or plant devices", async () => {
      const { data: seen } = await bob.client.from("devices").select("id").eq("id", first);
      expect(seen).toEqual([]);
      const { data: updated } = await bob.client
        .from("devices")
        .update({ notes: "hijacked" })
        .eq("id", first)
        .select("id");
      expect(updated).toEqual([]);
      const { error: plant } = await bob.client.from("devices").insert(device());
      expect(plant).not.toBeNull();
      // Bob's organization with Alice's building or device type: the foreign keys refuse.
      const { data: bobType } = await bob.client.from("device_types").select("id").single();
      const { error: crossSite } = await bob.client
        .from("devices")
        .insert({ organization_id: orgB, site_id: siteA, device_type_id: bobType!.id });
      expect(crossSite).not.toBeNull();

      const anon = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
      const { data: anonData } = await anon.from("devices").select("id");
      expect(anonData ?? []).toEqual([]);
    });

    it("a device's location must be in the device's building", async () => {
      const { error } = await alice.client
        .from("devices")
        .insert(device({ location_id: otherLocation }));
      expect(error).not.toBeNull();
      const { error: moveError } = await alice.client
        .from("devices")
        .update({ location_id: otherLocation })
        .eq("id", first);
      expect(moveError).not.toBeNull();
    });

    it("deleting a location keeps its devices, without the location", async () => {
      const { data: location } = await alice.client
        .from("locations")
        .insert({ organization_id: orgA, site_id: siteA, name: "Temporary" })
        .select("id")
        .single();
      await alice.client.from("devices").update({ location_id: location!.id }).eq("id", first);
      const { error } = await alice.client.from("locations").delete().eq("id", location!.id);
      expect(error).toBeNull();
      const { data } = await admin
        .from("devices")
        .select("location_id, site_id, deleted_at")
        .eq("id", first)
        .single();
      expect(data).toEqual({ location_id: null, site_id: siteA, deleted_at: null });
    });

    it("a technician can read devices but not add or change them", async () => {
      // Carol is still a technician here (member management runs later).
      const { data } = await carol.client.from("devices").select("id").eq("id", first);
      expect(data).toHaveLength(1);
      const { error } = await carol.client.from("devices").insert(device());
      expect(error).not.toBeNull();
      const { data: updated } = await carol.client
        .from("devices")
        .update({ status: "removed" })
        .eq("id", first)
        .select("id");
      expect(updated).toEqual([]);
    });

    it("devices are soft-deleted; deleting a building hides them and blocks new ones", async () => {
      const { error: hardDelete } = await alice.client.from("devices").delete().eq("id", first);
      expect(hardDelete).not.toBeNull();

      const { data, error } = await alice.client
        .from("sites")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", siteA)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      const { count } = await admin
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteA)
        .is("deleted_at", null);
      expect(count).toBe(0);

      const { error: insertError } = await alice.client.from("devices").insert(device());
      expect(insertError?.message).toMatch(/site_deleted/);
      const { error: restoreError } = await alice.client
        .from("devices")
        .update({ deleted_at: null })
        .eq("id", first);
      expect(restoreError?.message).toMatch(/site_deleted/);
    });

    it("an organization with devices can be deleted completely", async () => {
      const erin = await createUser("erin");
      const org = await createOrg(erin, `RLS devices ${run}`);
      const { data: type } = await erin.client.from("device_types").select("id").single();
      const { data: customer } = await erin.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: site } = await erin.client
        .from("sites")
        .insert({ organization_id: org, customer_id: customer!.id, name: "S" })
        .select("id")
        .single();
      const { data: location } = await erin.client
        .from("locations")
        .insert({ organization_id: org, site_id: site!.id, name: "L" })
        .select("id")
        .single();
      const { error: insertError } = await erin.client.from("devices").insert({
        organization_id: org,
        site_id: site!.id,
        location_id: location!.id,
        device_type_id: type!.id,
      });
      expect(insertError).toBeNull();
      const { error } = await admin.from("organizations").delete().eq("id", org);
      expect(error).toBeNull();
      const { count } = await admin
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org);
      expect(count).toBe(0);
    });

    // Its own organization (not orgA): other blocks assume orgA keeps exactly
    // the one seeded device type, and first's building is soft-deleted by now.
    describe("custom types and device photos (a fresh organization)", () => {
      let frank: TestUser;
      let org: string;
      let site: string;
      let device: string;

      beforeAll(async () => {
        frank = await createUser("frank");
        org = await createOrg(frank, `RLS custom ${run}`);
        const { data: customer } = await frank.client
          .from("customers")
          .insert({ organization_id: org, name: "C" })
          .select("id")
          .single();
        const { data: s } = await frank.client
          .from("sites")
          .insert({ organization_id: org, customer_id: customer!.id, name: "S" })
          .select("id")
          .single();
        site = s!.id;
        const { data: type } = await frank.client.from("device_types").select("id").single();
        const { data: d } = await frank.client
          .from("devices")
          .insert({ organization_id: org, site_id: site, device_type_id: type!.id })
          .select("id")
          .single();
        device = d!.id;
      });

      it("the owner adds a custom type with its own fields; another company can't see or change it", async () => {
        const { data: created, error } = await frank.client
          .from("device_types")
          .insert({
            organization_id: org,
            code: `hydrant_${run}`,
            name: "Hydrant",
            inspection_interval_months: 12,
            custom_fields: [{ key: "diameter", label: "Průměr" }],
          })
          .select("id, custom_fields")
          .single();
        expect(error).toBeNull();
        expect(created?.custom_fields).toEqual([{ key: "diameter", label: "Průměr" }]);

        // Not a member of this organization at all (owner/admin-only is already
        // covered by customers_insert's and sites_insert's own tests).
        const { error: bobInsert } = await bob.client.from("device_types").insert({
          organization_id: org,
          code: `planted_${run}`,
          name: "Planted",
          inspection_interval_months: 12,
        });
        expect(bobInsert).not.toBeNull();

        const { data: bobsView } = await bob.client
          .from("device_types")
          .select("id")
          .eq("id", created!.id);
        expect(bobsView).toEqual([]);
        const { data: bobWrite } = await bob.client
          .from("device_types")
          .update({ custom_fields: [] } as never)
          .eq("id", created!.id)
          .select("id");
        expect(bobWrite).toEqual([]);
      });

      it("device photos go to the device's own folder of its own company", async () => {
        const png = Uint8Array.from(
          atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          ),
          (c) => c.charCodeAt(0),
        );
        const path = `${org}/devices/${device}/photo-${run}.png`;
        const { error: upload } = await frank.client.storage
          .from("org-assets")
          .upload(path, png, { contentType: "image/png" });
        expect(upload).toBeNull();
        const { data: photoId, error } = await frank.client.rpc("add_device_photo", {
          p_device: device,
          p_path: path,
          p_content_type: "image/png",
          p_size: png.length,
        });
        expect(error).toBeNull();

        // Another company's device, or a path outside this device's own folder.
        const { error: bobUpload } = await bob.client.storage
          .from("org-assets")
          .upload(`${org}/devices/${device}/bob-${run}.png`, png, { contentType: "image/png" });
        expect(bobUpload).not.toBeNull();
        const { error: elsewhere } = await frank.client.rpc("add_device_photo", {
          p_device: device,
          p_path: `${org}/devices/${bob.id}/photo-${run}.png`,
          p_content_type: "image/png",
          p_size: png.length,
        });
        expect(elsewhere?.message).toMatch(/not_found/);
        const { error: foreignDevice } = await bob.client.rpc("add_device_photo", {
          p_device: device,
          p_path: `${org}/devices/${device}/bob2-${run}.png`,
          p_content_type: "image/png",
          p_size: png.length,
        });
        expect(foreignDevice?.message).toMatch(/not_found/);
        const { data: bobsPhotos } = await bob.client
          .from("device_photos")
          .select("id")
          .eq("device_id", device);
        expect(bobsPhotos).toEqual([]);

        const { data: deletedPath, error: deleteError } = await frank.client.rpc(
          "delete_device_photo",
          { p_photo: photoId! },
        );
        expect(deleteError).toBeNull();
        expect(deletedPath).toBe(path);
        await frank.client.storage.from("org-assets").remove([path]);
      });
    });
  });

  describe("moving devices (a fresh organization)", () => {
    let ivan: TestUser;
    let jana: TestUser;
    let org: string;
    let siteA: string;
    let siteB: string;
    let locA: string;
    let locB: string;
    let device: string;

    beforeAll(async () => {
      ivan = await createUser("ivan");
      jana = await createUser("jana");
      org = await createOrg(ivan, `RLS moves ${run}`);
      const token = generateToken();
      await ivan.client.from("invitations").insert({
        organization_id: org,
        email: jana.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: ivan.id,
      });
      const { error: joined } = await jana.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Jana",
      });
      expect(joined).toBeNull();
      const { data: customer } = await ivan.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: sites } = await ivan.client
        .from("sites")
        .insert(
          ["A", "B"].map((name) => ({ organization_id: org, customer_id: customer!.id, name })),
        )
        .select("id, name")
        .order("name");
      siteA = sites![0]!.id;
      siteB = sites![1]!.id;
      const { data: locations } = await ivan.client
        .from("locations")
        .insert([
          { organization_id: org, site_id: siteA, name: "Sklep A", sort_order: 1 },
          { organization_id: org, site_id: siteB, name: "Chodba B", sort_order: 1 },
        ])
        .select("id, site_id");
      locA = locations!.find((l) => l.site_id === siteA)!.id;
      locB = locations!.find((l) => l.site_id === siteB)!.id;
      const { data: type } = await ivan.client.from("device_types").select("id").single();
      const { data: d } = await ivan.client
        .from("devices")
        .insert({
          organization_id: org,
          site_id: siteA,
          location_id: locA,
          device_type_id: type!.id,
        })
        .select("id")
        .single();
      device = d!.id;
    });

    const placeOf = async () =>
      (await ivan.client.from("devices").select("site_id, location_id").eq("id", device).single())
        .data;

    it("only an owner or admin of the company moves a device, and only the database writes history", async () => {
      const move = { p_device: device, p_site: siteB, p_location: locB, p_note: "Na opravu" };
      const { error: technician } = await jana.client.rpc("move_device", move);
      expect(technician?.message).toMatch(/not_found/);
      const { error: stranger } = await bob.client.rpc("move_device", move);
      expect(stranger?.message).toMatch(/not_found/);
      expect(await placeOf()).toEqual({ site_id: siteA, location_id: locA });

      // The building column has no update privilege: moving goes through move_device.
      const { error: direct } = await ivan.client
        .from("devices")
        .update({ site_id: siteB } as never)
        .eq("id", device);
      expect(direct).not.toBeNull();
      const { error: forged } = await ivan.client.from("device_moves").insert({
        organization_id: org,
        device_id: device,
        from_site_id: siteA,
        to_site_id: siteB,
      } as never);
      expect(forged).not.toBeNull();
    });

    it("a move to another building records where from, where to, who and the note", async () => {
      const { error } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteB,
        p_location: locB,
        p_note: "  Na opravu  ",
      });
      expect(error).toBeNull();
      expect(await placeOf()).toEqual({ site_id: siteB, location_id: locB });
      const { data: moves } = await jana.client
        .from("device_moves")
        .select("from_site_id, to_site_id, from_location_name, to_location_name, note, moved_by")
        .eq("device_id", device);
      expect(moves).toEqual([
        {
          from_site_id: siteA,
          to_site_id: siteB,
          from_location_name: "Sklep A",
          to_location_name: "Chodba B",
          note: "Na opravu",
          moved_by: ivan.id,
        },
      ]);
      const { data: bobsView } = await bob.client
        .from("device_moves")
        .select("id")
        .eq("device_id", device);
      expect(bobsView).toEqual([]);
    });

    it("a location of another building, the same place, or another company's building are refused", async () => {
      const { error: wrongLocation } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteA,
        p_location: locB,
        p_note: null,
      });
      expect(wrongLocation?.message).toMatch(/locations_mismatch/);
      const { error: same } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteB,
        p_location: locB,
        p_note: null,
      });
      expect(same?.message).toMatch(/no_change/);
      const { data: bobsCustomer } = await bob.client
        .from("customers")
        .insert({ organization_id: orgB, name: "Bob moves" })
        .select("id")
        .single();
      const { data: bobsSite } = await bob.client
        .from("sites")
        .insert({ organization_id: orgB, customer_id: bobsCustomer!.id, name: "Bob moves" })
        .select("id")
        .single();
      const { error: foreign } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: bobsSite!.id,
        p_location: null,
        p_note: null,
      });
      expect(foreign?.message).toMatch(/not_found/);
    });

    it("changing the location in the edit form or deleting the location is in the history too", async () => {
      const { error } = await ivan.client
        .from("devices")
        .update({ location_id: null })
        .eq("id", device)
        .select("id");
      expect(error).toBeNull();
      await ivan.client.from("devices").update({ location_id: locB }).eq("id", device);
      const { error: deleteError } = await ivan.client.from("locations").delete().eq("id", locB);
      expect(deleteError).toBeNull();
      expect(await placeOf()).toEqual({ site_id: siteB, location_id: null });
      const { data: moves } = await ivan.client
        .from("device_moves")
        .select("from_site_id, to_site_id, from_location_name, to_location_name, note")
        .eq("device_id", device)
        .order("moved_at");
      const sameSite = { from_site_id: siteB, to_site_id: siteB, note: null };
      expect(moves?.slice(1)).toEqual([
        { ...sameSite, from_location_name: "Chodba B", to_location_name: null },
        { ...sameSite, from_location_name: null, to_location_name: "Chodba B" },
        { ...sameSite, from_location_name: "Chodba B", to_location_name: null },
      ]);
    });

    it("the spot on the old building's floor plan goes away with a move", async () => {
      const { data: plan, error: planError } = await ivan.client
        .from("floor_plans")
        .insert({
          organization_id: org,
          site_id: siteB,
          name: "Plan B",
          image_path: `${org}/floor-plans/${siteB}/${randomUUID()}.webp`,
          image_width: 100,
          image_height: 100,
        })
        .select("id")
        .single();
      expect(planError).toBeNull();
      const { error: placeError } = await ivan.client.rpc("place_device", {
        p_device: device,
        p_plan: plan!.id,
        p_x: 0.5,
        p_y: 0.5,
      });
      expect(placeError).toBeNull();
      const { error } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteA,
        p_location: locA,
        p_note: null,
      });
      expect(error).toBeNull();
      const { data: placements } = await ivan.client
        .from("device_placements")
        .select("device_id")
        .eq("device_id", device);
      expect(placements).toEqual([]);
    });

    it("a device being checked in a running inspection stays in its building", async () => {
      const { data: inspection, error: startError } = await jana.client.rpc("start_inspection", {
        p_site: siteA,
      });
      expect(startError).toBeNull();
      const { error: openError } = await jana.client.rpc("open_device_check", {
        p_inspection: inspection!,
        p_device: device,
      });
      expect(openError).toBeNull();
      const { error } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteB,
        p_location: null,
        p_note: null,
      });
      expect(error?.message).toMatch(/device_in_inspection/);
      // Within the building the location may still change.
      const { error: within } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: siteA,
        p_location: null,
        p_note: null,
      });
      expect(within).toBeNull();
      const { error: cancelError } = await ivan.client.rpc("cancel_inspection", {
        p_inspection: inspection!,
      });
      expect(cancelError).toBeNull();
    });

    it("sample data and real buildings don't mix", async () => {
      const { data: sampleCustomer, error: sampleError } = await ivan.client.rpc(
        "create_sample_data",
        { p_org: org },
      );
      expect(sampleError).toBeNull();
      const { data: sampleSite } = await ivan.client
        .from("sites")
        .select("id")
        .eq("customer_id", sampleCustomer!)
        .limit(1)
        .single();
      const { error } = await ivan.client.rpc("move_device", {
        p_device: device,
        p_site: sampleSite!.id,
        p_location: null,
        p_note: null,
      });
      expect(error?.message).toMatch(/sample_mismatch/);
      const { error: removeError } = await ivan.client.rpc("remove_sample_data", { p_org: org });
      expect(removeError).toBeNull();
    });
  });

  describe("required photos on checklist questions (a fresh organization)", () => {
    let kate: TestUser;
    let org: string;
    let type: string;
    let site: string;
    let devices: string[];
    let gauge: string;
    let seal: string;
    let inspection: string;
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const items = (photo: boolean) => [
      {
        label: "Tlakoměr",
        type: "number",
        required: true,
        failCreatesDefect: false,
        photoRequired: photo,
      },
      { label: "Plomba", type: "pass_fail", required: true, failCreatesDefect: false },
    ];

    beforeAll(async () => {
      kate = await createUser("kate");
      org = await createOrg(kate, `RLS photos ${run}`);
      const { data: t } = await kate.client.from("device_types").select("id").single();
      type = t!.id;
      const { data: customer } = await kate.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: s } = await kate.client
        .from("sites")
        .insert({ organization_id: org, customer_id: customer!.id, name: "S" })
        .select("id")
        .single();
      site = s!.id;
      const { data: d } = await kate.client
        .from("devices")
        .insert([1, 2].map(() => ({ organization_id: org, site_id: site, device_type_id: type })))
        .select("id, label_number")
        .order("label_number");
      devices = d!.map((row) => row.id);
    });

    it("the template keeps the flag, and switching it makes a new version", async () => {
      const { data: first, error } = await kate.client.rpc("save_checklist_template", {
        p_device_type: type,
        p_name: "Kontrola",
        p_items: items(true),
      });
      expect(error).toBeNull();
      const { data: again } = await kate.client.rpc("save_checklist_template", {
        p_device_type: type,
        p_name: "Kontrola",
        p_items: items(true),
      });
      expect(again).toBe(first);
      const { data: rows } = await kate.client
        .from("checklist_template_items")
        .select("id, label, photo_required")
        .eq("template_id", first!)
        .order("sort_order");
      expect(rows?.map((row) => row.photo_required)).toEqual([true, false]);
      gauge = rows![0]!.id;
      seal = rows![1]!.id;

      const { error: badFlag } = await kate.client.rpc("save_checklist_template", {
        p_device_type: type,
        p_name: "Kontrola",
        p_items: [{ ...items(true)[0], photoRequired: "yes" }],
      });
      expect(badFlag?.message).toMatch(/invalid_template/);
    });

    it("a check can't be finished without the required photo, online or from the phone", async () => {
      const { data: started, error: startError } = await kate.client.rpc("start_inspection", {
        p_site: site,
      });
      expect(startError).toBeNull();
      inspection = started!;
      const { data: opened } = await kate.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
      });
      const item = (opened as { item: string }).item;
      await kate.client.rpc("save_answer", {
        p_item: item,
        p_template_item: gauge,
        p_value_number: 12.5,
      });
      await kate.client.rpc("save_answer", {
        p_item: item,
        p_template_item: seal,
        p_value_pass: true,
      });
      const { error: noPhoto } = await kate.client.rpc("finish_device_check", { p_item: item });
      expect(noPhoto?.message).toMatch(/check_incomplete/);

      // A photo of another question doesn't count.
      const sealPath = `${org}/inspections/${inspection}/${item}/seal-${run}.png`;
      await kate.client.storage
        .from("org-assets")
        .upload(sealPath, png, { contentType: "image/png" });
      await kate.client.rpc("add_inspection_photo", {
        p_item: item,
        p_template_item: seal,
        p_path: sealPath,
        p_content_type: "image/png",
        p_size: png.length,
      });
      const { error: wrongPhoto } = await kate.client.rpc("finish_device_check", { p_item: item });
      expect(wrongPhoto?.message).toMatch(/check_incomplete/);

      const gaugePath = `${org}/inspections/${inspection}/${item}/gauge-${run}.png`;
      await kate.client.storage
        .from("org-assets")
        .upload(gaugePath, png, { contentType: "image/png" });
      const { error: photoError } = await kate.client.rpc("add_inspection_photo", {
        p_item: item,
        p_template_item: gauge,
        p_path: gaugePath,
        p_content_type: "image/png",
        p_size: png.length,
      });
      expect(photoError).toBeNull();
      const { data: outcome, error } = await kate.client.rpc("finish_device_check", {
        p_item: item,
      });
      expect(error).toBeNull();
      expect(outcome).toBe("passed");
      await kate.client.storage.from("org-assets").remove([sealPath, gaugePath]);

      // From the phone: the whole check at once, still refused without the photo.
      const { data: second } = await kate.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[1]!,
      });
      const secondItem = (second as { item: string }).item;
      const { error: phone } = await kate.client.rpc("submit_device_check", {
        p_item: secondItem,
        p_answers: { [gauge]: { number: 11 }, [seal]: { pass: true } },
        p_action: "finish",
      });
      expect(phone?.message).toMatch(/check_incomplete/);

      // Leaving the device out needs no photo.
      const { error: skipError } = await kate.client.rpc("skip_device_check", {
        p_item: secondItem,
        p_reason: "inaccessible",
      });
      expect(skipError).toBeNull();
    });
  });

  describe("planning and defect assignment (a fresh organization)", () => {
    let lada: TestUser;
    let milan: TestUser;
    let org: string;
    let site: string;
    let otherSite: string;
    let device: string;
    let defect: string;
    let milanMembership: string;
    const today = () => todayInTimeZone("Europe/Prague");
    const shift = (days: number) => {
      const date = new Date(`${today()}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    beforeAll(async () => {
      lada = await createUser("lada");
      milan = await createUser("milan");
      org = await createOrg(lada, `RLS planning ${run}`);
      const token = generateToken();
      await lada.client.from("invitations").insert({
        organization_id: org,
        email: milan.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: lada.id,
      });
      const { error: joined } = await milan.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Milan",
      });
      expect(joined).toBeNull();
      const { data: membership } = await lada.client
        .from("memberships")
        .select("id")
        .eq("organization_id", org)
        .eq("user_id", milan.id)
        .single();
      milanMembership = membership!.id;
      const { data: customer } = await lada.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: sites } = await lada.client
        .from("sites")
        .insert(
          ["A", "B"].map((name) => ({ organization_id: org, customer_id: customer!.id, name })),
        )
        .select("id, name")
        .order("name");
      site = sites![0]!.id;
      otherSite = sites![1]!.id;
      const { data: type } = await lada.client.from("device_types").select("id").single();
      const { data: d } = await lada.client
        .from("devices")
        .insert({ organization_id: org, site_id: site, device_type_id: type!.id })
        .select("id")
        .single();
      device = d!.id;
      const { data: created } = await milan.client.rpc("create_defect", {
        p_device: device,
        p_description: "Chybí plomba",
        p_severity: "major",
      });
      defect = created!;
    });

    it("any member assigns a defect to a member and sets its fix-by date, with history", async () => {
      const { error } = await milan.client.rpc("assign_defect", {
        p_defect: defect,
        p_user: lada.id,
      });
      expect(error).toBeNull();
      const { error: dueError } = await milan.client.rpc("set_defect_due", {
        p_defect: defect,
        p_due: shift(-1),
      });
      expect(dueError).toBeNull();
      const { data: row } = await lada.client
        .from("defects")
        .select("assigned_to, due_on")
        .eq("id", defect)
        .single();
      expect(row).toEqual({ assigned_to: lada.id, due_on: shift(-1) });
      const { data: events } = await lada.client
        .from("defect_events")
        .select("kind, actor, from_value, to_value")
        .eq("defect_id", defect)
        .in("kind", ["assignee", "due"])
        .order("created_at");
      expect(events).toEqual([
        { kind: "assignee", actor: milan.id, from_value: null, to_value: lada.id },
        { kind: "due", actor: milan.id, from_value: null, to_value: shift(-1) },
      ]);
      // Setting the same values again records nothing new.
      await milan.client.rpc("assign_defect", { p_defect: defect, p_user: lada.id });
      const { count } = await lada.client
        .from("defect_events")
        .select("id", { count: "exact", head: true })
        .eq("defect_id", defect)
        .eq("kind", "assignee");
      expect(count).toBe(1);
    });

    it("a defect can't go to a non-member, and another company can't touch it", async () => {
      const { error: outsider } = await lada.client.rpc("assign_defect", {
        p_defect: defect,
        p_user: bob.id,
      });
      expect(outsider?.message).toMatch(/member_not_found/);
      const { error: foreign } = await bob.client.rpc("assign_defect", {
        p_defect: defect,
        p_user: bob.id,
      });
      expect(foreign?.message).toMatch(/not_found/);
      const { error: foreignDue } = await bob.client.rpc("set_defect_due", {
        p_defect: defect,
        p_due: null,
      });
      expect(foreignDue?.message).toMatch(/not_found/);
      // The columns themselves are not writable.
      const { error: direct } = await lada.client
        .from("defects")
        .update({ assigned_to: null } as never)
        .eq("id", defect);
      expect(direct).not.toBeNull();
    });

    it("owners and admins plan; technicians and other companies only read or see nothing", async () => {
      const { data: plan, error } = await lada.client
        .from("inspection_plans")
        .insert({
          organization_id: org,
          site_id: site,
          planned_on: shift(3),
          technician_id: milan.id,
          note: "Klíče u správce",
          created_by: lada.id,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      const { data: seen } = await milan.client
        .from("inspection_plans")
        .select("id, technician_id")
        .eq("id", plan!.id);
      expect(seen).toEqual([{ id: plan!.id, technician_id: milan.id }]);

      const { error: technicianInsert } = await milan.client.from("inspection_plans").insert({
        organization_id: org,
        site_id: site,
        planned_on: shift(4),
      });
      expect(technicianInsert).not.toBeNull();
      const { data: technicianUpdate } = await milan.client
        .from("inspection_plans")
        .update({ note: "x" })
        .eq("id", plan!.id)
        .select("id");
      expect(technicianUpdate).toEqual([]);
      const { data: technicianDelete } = await milan.client
        .from("inspection_plans")
        .delete()
        .eq("id", plan!.id)
        .select("id");
      expect(technicianDelete).toEqual([]);

      const { data: bobsView } = await bob.client
        .from("inspection_plans")
        .select("id")
        .eq("id", plan!.id);
      expect(bobsView).toEqual([]);
      const { error: bobInsert } = await bob.client.from("inspection_plans").insert({
        organization_id: org,
        site_id: site,
        planned_on: shift(4),
      });
      expect(bobInsert).not.toBeNull();

      // A technician from outside the company, or the inspection link from the client.
      const { error: outsider } = await lada.client.from("inspection_plans").insert({
        organization_id: org,
        site_id: site,
        planned_on: shift(5),
        technician_id: bob.id,
      });
      expect(outsider?.code).toBe("23503");
      const { error: link } = await lada.client
        .from("inspection_plans")
        .update({ inspection_id: randomUUID() } as never)
        .eq("id", plan!.id);
      expect(link).not.toBeNull();
    });

    it("starting an inspection carries out the earliest open plan; cancelling frees it", async () => {
      const { data: plans } = await lada.client
        .from("inspection_plans")
        .insert([
          { organization_id: org, site_id: site, planned_on: shift(-2) },
          { organization_id: org, site_id: site, planned_on: shift(30) },
        ])
        .select("id, planned_on")
        .order("planned_on");
      const late = plans![0]!.id;
      const { data: inspection } = await milan.client.rpc("start_inspection", { p_site: site });
      const { data: linked } = await lada.client
        .from("inspection_plans")
        .select("id, inspection_id")
        .eq("site_id", site)
        .not("inspection_id", "is", null);
      expect(linked).toEqual([{ id: late, inspection_id: inspection }]);

      const { error } = await lada.client.rpc("cancel_inspection", { p_inspection: inspection! });
      expect(error).toBeNull();
      const { data: freed } = await lada.client
        .from("inspection_plans")
        .select("inspection_id")
        .eq("id", late)
        .single();
      expect(freed?.inspection_id).toBeNull();
    });

    it("removing a member clears their plans and defects; deleting a building drops its open plans", async () => {
      const { error } = await lada.client.rpc("remove_member", { p_membership: milanMembership });
      expect(error).toBeNull();
      const { data: plans } = await lada.client
        .from("inspection_plans")
        .select("technician_id")
        .eq("organization_id", org)
        .not("technician_id", "is", null);
      expect(plans).toEqual([]);
      await lada.client.rpc("assign_defect", { p_defect: defect, p_user: lada.id });

      const { data: other } = await lada.client
        .from("inspection_plans")
        .insert({ organization_id: org, site_id: otherSite, planned_on: shift(1) })
        .select("id")
        .single();
      await lada.client
        .from("sites")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", otherSite);
      const { data: gone } = await lada.client
        .from("inspection_plans")
        .select("id")
        .eq("id", other!.id);
      expect(gone).toEqual([]);
      const { error: deletedSite } = await lada.client
        .from("inspection_plans")
        .insert({ organization_id: org, site_id: otherSite, planned_on: shift(1) });
      expect(deletedSite?.message).toMatch(/site_deleted/);
    });
  });

  describe("inspections", () => {
    let site: string;
    let devices: string[];
    let inspection: string;
    const items: Record<string, string> = {};
    let questions: { id: string; item_type: string; required: boolean }[];
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").single();
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Inspection customer" })
        .select("id")
        .single();
      const { data: s } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customer!.id, name: "Inspection site" })
        .select("id")
        .single();
      site = s!.id;
      await alice.client
        .from("device_types")
        .update({ inspection_interval_months: 12 })
        .eq("id", type!.id);
      const { data: rows } = await alice.client
        .from("devices")
        .insert(
          [1, 2, 3].map(() => ({ organization_id: orgA, site_id: site, device_type_id: type!.id })),
        )
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: template } = await alice.client
        .from("checklist_templates")
        .select("id, checklist_template_items(id, item_type, required, sort_order)")
        .eq("device_type_id", type!.id)
        .eq("active", true)
        .single();
      questions = [...template!.checklist_template_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    });

    /** A valid answer for every required question (yes/no answered `pass`). */
    async function answerAll(client: Client, item: string, pass = true) {
      for (const question of questions.filter((q) => q.required)) {
        const { error } = await client.rpc("save_answer", {
          p_item: item,
          p_template_item: question.id,
          p_value_pass: question.item_type === "pass_fail" ? pass : null,
          p_value_number: question.item_type === "number" ? 12.5 : null,
          p_value_text: question.item_type === "text" ? "OK" : null,
        });
        expect(error).toBeNull();
      }
    }

    it("anyone in the company starts the building's inspection; starting again joins it", async () => {
      const { data, error } = await carol.client.rpc("start_inspection", { p_site: site });
      expect(error).toBeNull();
      inspection = data!;
      const { data: again } = await alice.client.rpc("start_inspection", { p_site: site });
      expect(again).toBe(inspection);
      const { error: bobError } = await bob.client.rpc("start_inspection", { p_site: site });
      expect(bobError?.message).toMatch(/not_found/);
    });

    it("a device's check is held by one person; a colleague sees who and may take it over", async () => {
      const { data: opened } = await carol.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
      });
      const item = (opened as { item: string }).item;
      items[devices[0]!] = item;
      expect(opened).toEqual({ item });

      const { data: blocked } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
      });
      expect(blocked).toEqual({ item, heldBy: "Carol" });
      const { error: notHolding } = await alice.client.rpc("save_answer", {
        p_item: item,
        p_template_item: questions[0]!.id,
        p_value_pass: true,
      });
      expect(notHolding?.message).toMatch(/check_taken_over/);

      const { data: taken } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
        p_take_over: true,
      });
      expect(taken).toEqual({ item });
      // Carol's next save is refused rather than silently overwriting Alice's work.
      const { error: lost } = await carol.client.rpc("save_answer", {
        p_item: item,
        p_template_item: questions[0]!.id,
        p_value_pass: true,
      });
      expect(lost?.message).toMatch(/check_taken_over/);
    });

    it("answers must fit the question", async () => {
      const item = items[devices[0]!]!;
      const yesNo = questions.find((q) => q.item_type === "pass_fail")!;
      const number = questions.find((q) => q.item_type === "number")!;
      const { error: wrongType } = await alice.client.rpc("save_answer", {
        p_item: item,
        p_template_item: yesNo.id,
        p_value_number: 3,
      });
      expect(wrongType?.message).toMatch(/invalid_answer/);
      const { error: textInNumber } = await alice.client.rpc("save_answer", {
        p_item: item,
        p_template_item: number.id,
        p_value_text: "many",
      });
      expect(textInNumber?.message).toMatch(/invalid_answer/);
      const { data: otherTemplateItem } = await admin
        .from("checklist_template_items")
        .select("id, checklist_templates!inner(active)")
        .eq("organization_id", orgA)
        .eq("checklist_templates.active", false)
        .limit(1)
        .single();
      const { error: foreign } = await alice.client.rpc("save_answer", {
        p_item: item,
        p_template_item: otherTemplateItem!.id,
        p_value_pass: true,
      });
      expect(foreign?.message).toMatch(/not_found/);
    });

    it("a check finishes only with every required answer, and fails on any 'no'", async () => {
      const item = items[devices[0]!]!;
      const { error: early } = await alice.client.rpc("finish_device_check", { p_item: item });
      expect(early?.message).toMatch(/check_incomplete/);
      await answerAll(alice.client, item, true);
      const { data: passed } = await alice.client.rpc("finish_device_check", { p_item: item });
      expect(passed).toBe("passed");

      const { data: second } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[1]!,
      });
      items[devices[1]!] = (second as { item: string }).item;
      await answerAll(alice.client, items[devices[1]!]!, false);
      const { data: failed } = await alice.client.rpc("finish_device_check", {
        p_item: items[devices[1]!]!,
      });
      expect(failed).toBe("failed");
    });

    it("changing an answer of a finished check reopens it", async () => {
      const item = items[devices[1]!]!;
      await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[1]!,
      });
      await answerAll(alice.client, item, true);
      const { data } = await admin
        .from("inspection_items")
        .select("outcome")
        .eq("id", item)
        .single();
      expect(data?.outcome).toBeNull();
      // Back to a failed check for the rest of the tests.
      await answerAll(alice.client, item, false);
      await alice.client.rpc("finish_device_check", { p_item: item });
    });

    it("photos go to the held check's folder only", async () => {
      const { data: opened } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[2]!,
      });
      const item = (opened as { item: string }).item;
      const path = `${orgA}/inspections/${inspection}/${item}/photo-${run}.png`;
      const { error: upload } = await alice.client.storage
        .from("org-assets")
        .upload(path, png, { contentType: "image/png" });
      expect(upload).toBeNull();
      const { data: photo, error } = await alice.client.rpc("add_inspection_photo", {
        p_item: item,
        p_template_item: questions[0]!.id,
        p_path: path,
        p_content_type: "image/png",
        p_size: png.length,
      });
      expect(error).toBeNull();

      // A technician who doesn't hold the check, another company, a missing file: refused.
      const { error: carolUpload } = await carol.client.storage
        .from("org-assets")
        .upload(`${orgA}/inspections/${inspection}/${item}/carol-${run}.png`, png, {
          contentType: "image/png",
        });
      expect(carolUpload).not.toBeNull();
      const { error: carolPhoto } = await carol.client.rpc("add_inspection_photo", {
        p_item: item,
        p_template_item: null,
        p_path: path,
        p_content_type: "image/png",
        p_size: png.length,
      });
      expect(carolPhoto?.message).toMatch(/check_taken_over/);
      const { error: bobUpload } = await bob.client.storage
        .from("org-assets")
        .upload(`${orgA}/inspections/${inspection}/${item}/bob-${run}.png`, png, {
          contentType: "image/png",
        });
      expect(bobUpload).not.toBeNull();
      const { error: ghost } = await alice.client.rpc("add_inspection_photo", {
        p_item: item,
        p_template_item: null,
        p_path: `${orgA}/inspections/${inspection}/${item}/missing.png`,
        p_content_type: "image/png",
        p_size: 10,
      });
      expect(ghost?.message).toMatch(/not_found/);

      const { data: removedPath } = await alice.client.rpc("delete_inspection_photo", {
        p_photo: photo!,
      });
      expect(removedPath).toBe(path);
      const { error: removeFile } = await alice.client.storage.from("org-assets").remove([path]);
      expect(removeFile).toBeNull();
      // The third device stays unchecked.
      await alice.client.rpc("release_device_check", { p_item: item });
      await admin.from("inspection_items").delete().eq("id", item);
    });

    it("another company can't see or work on the inspection", async () => {
      const { data } = await bob.client.from("inspections").select("id").eq("id", inspection);
      expect(data).toEqual([]);
      const { data: answers } = await bob.client.from("inspection_answers").select("id");
      expect(answers).toEqual([]);
      const { error } = await bob.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
      });
      expect(error?.message).toMatch(/not_found/);
      const { error: write } = await bob.client.rpc("save_answer", {
        p_item: items[devices[0]!]!,
        p_template_item: questions[0]!.id,
        p_value_pass: false,
      });
      expect(write?.message).toMatch(/not_found/);
      const { error: direct } = await alice.client
        .from("inspection_answers")
        .update({ value_pass: false } as never)
        .eq("item_id", items[devices[0]!]!);
      expect(direct).not.toBeNull();
    });

    it("completing records unchecked devices and moves the date of passed devices only", async () => {
      // A started but unfinished check blocks completion.
      await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[2]!,
      });
      const { error: unfinished } = await alice.client.rpc("complete_inspection", {
        p_inspection: inspection,
      });
      expect(unfinished?.message).toMatch(/checks_unfinished/);
      const { data: open } = await admin
        .from("inspection_items")
        .select("id")
        .eq("inspection_id", inspection)
        .eq("device_id", devices[2]!)
        .single();
      await admin.from("inspection_items").delete().eq("id", open!.id);

      const { data: summary, error } = await carol.client.rpc("complete_inspection", {
        p_inspection: inspection,
        p_notes: " Vše v pořádku kromě jednoho. ",
      });
      expect(error).toBeNull();
      // The failed device answered the defect question "no": one defect.
      expect(summary).toEqual({
        passed: 1,
        failed: 1,
        notChecked: 1,
        skipped: 0,
        defects: 1,
        protocol: expect.any(String),
      });

      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(
        new Date(),
      );
      const { data: rows } = await admin
        .from("devices")
        .select("id, last_inspection_on, next_due_on")
        .in("id", devices);
      const byId = new Map(rows!.map((row) => [row.id, row]));
      // orgA's time zone was set to Asia/Tbilisi in the settings tests.
      expect(byId.get(devices[0]!)?.last_inspection_on).toBe(today);
      expect(byId.get(devices[0]!)?.next_due_on).not.toBeNull();
      expect(byId.get(devices[1]!)?.last_inspection_on).toBeNull();
      expect(byId.get(devices[2]!)?.last_inspection_on).toBeNull();

      const { data: done } = await admin
        .from("inspections")
        .select("status, completed_at, notes")
        .eq("id", inspection)
        .single();
      expect(done).toMatchObject({ status: "completed", notes: "Vše v pořádku kromě jednoho." });

      const { error: late } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: devices[2]!,
      });
      expect(late?.message).toMatch(/inspection_closed/);
      const { data: next } = await alice.client.rpc("start_inspection", { p_site: site });
      expect(next).not.toBe(inspection);
    });
  });

  describe("defects", () => {
    let site: string;
    let devices: string[];
    let questions: {
      id: string;
      item_type: string;
      required: boolean;
      fail_creates_defect: boolean;
    }[];
    let found: string;
    let foundNumber: number;
    let reported: string;
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").single();
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Defects customer" })
        .select("id")
        .single();
      const { data: s } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customer!.id, name: "Defects site" })
        .select("id")
        .single();
      site = s!.id;
      const { data: rows } = await alice.client
        .from("devices")
        .insert(
          [1, 2].map(() => ({ organization_id: orgA, site_id: site, device_type_id: type!.id })),
        )
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: template } = await alice.client
        .from("checklist_templates")
        .select(
          "checklist_template_items(id, item_type, required, fail_creates_defect, sort_order)",
        )
        .eq("device_type_id", type!.id)
        .eq("active", true)
        .single();
      questions = [...template!.checklist_template_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    });

    /** Checks a device in an inspection; `fail` answers the defect question "no". */
    async function check(inspection: string, device: string, fail: boolean, severity?: string) {
      const { data } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: device,
      });
      const item = (data as { item: string }).item;
      for (const question of questions.filter((q) => q.required)) {
        const failing = fail && question.fail_creates_defect;
        const { error } = await alice.client.rpc("save_answer", {
          p_item: item,
          p_template_item: question.id,
          p_value_pass: question.item_type === "pass_fail" ? !failing : null,
          p_value_number: question.item_type === "number" ? 5 : null,
          p_value_text: question.item_type === "text" ? "OK" : null,
          p_note: failing ? "Plomba chybí" : null,
          p_defect_severity: failing && severity ? (severity as "critical") : null,
        });
        expect(error).toBeNull();
      }
      await alice.client.rpc("finish_device_check", { p_item: item });
      return item;
    }

    it("a failed defect question becomes a defect when the inspection completes", async () => {
      const { data: inspection } = await alice.client.rpc("start_inspection", { p_site: site });
      await check(inspection!, devices[0]!, true, "critical");
      await check(inspection!, devices[1]!, false);
      const { data: summary } = await alice.client.rpc("complete_inspection", {
        p_inspection: inspection!,
      });
      expect(summary).toMatchObject({ passed: 1, failed: 1, defects: 1 });

      const { data: defects } = await alice.client
        .from("defects")
        .select("id, number, device_id, inspection_id, description, severity, status")
        .eq("device_id", devices[0]!);
      expect(defects).toHaveLength(1);
      expect(defects![0]).toMatchObject({
        inspection_id: inspection,
        severity: "critical",
        status: "open",
      });
      expect(defects![0]!.description).toMatch(/: Plomba chybí$/);
      found = defects![0]!.id;
      foundNumber = defects![0]!.number;
      const { data: events } = await alice.client
        .from("defect_events")
        .select("kind, to_value, inspection_id")
        .eq("defect_id", found);
      expect(events).toEqual([
        { kind: "created", to_value: "critical", inspection_id: inspection },
      ]);
    });

    it("the same defect found again goes into its history instead of a duplicate", async () => {
      const { data: inspection } = await alice.client.rpc("start_inspection", { p_site: site });
      await check(inspection!, devices[0]!, true);
      await check(inspection!, devices[1]!, false);
      const { data: summary } = await alice.client.rpc("complete_inspection", {
        p_inspection: inspection!,
      });
      expect(summary).toMatchObject({ defects: 0 });
      const { count } = await alice.client
        .from("defects")
        .select("id", { count: "exact", head: true })
        .eq("device_id", devices[0]!);
      expect(count).toBe(1);
      const { data: events } = await alice.client
        .from("defect_events")
        .select("kind, inspection_id")
        .eq("defect_id", found)
        .order("created_at");
      expect(events?.map((e) => e.kind)).toEqual(["created", "observed"]);
      expect(events?.[1]?.inspection_id).toBe(inspection);
    });

    it("a severity belongs only to a failed answer", async () => {
      const { data: inspection } = await alice.client.rpc("start_inspection", { p_site: site });
      const { data } = await alice.client.rpc("open_device_check", {
        p_inspection: inspection!,
        p_device: devices[1]!,
      });
      const yesNo = questions.find((q) => q.item_type === "pass_fail")!;
      const { error } = await alice.client.rpc("save_answer", {
        p_item: (data as { item: string }).item,
        p_template_item: yesNo.id,
        p_value_pass: true,
        p_defect_severity: "minor",
      });
      expect(error?.message).toMatch(/invalid_answer/);
    });

    it("members report, work on, resolve and reopen defects; the history says who", async () => {
      const { data: id, error } = await carol.client.rpc("create_defect", {
        p_device: devices[1]!,
        p_description: " Dveře nejdou zavřít ",
        p_severity: "minor",
      });
      expect(error).toBeNull();
      reported = id!;
      const { data: defect } = await carol.client
        .from("defects")
        .select("number, description, created_by")
        .eq("id", reported)
        .single();
      // Numbered in sequence within the company.
      expect(defect).toEqual({
        number: foundNumber + 1,
        description: "Dveře nejdou zavřít",
        created_by: carol.id,
      });

      await carol.client.rpc("change_defect_status", {
        p_defect: reported,
        p_status: "in_progress",
      });
      const { error: noNote } = await carol.client.rpc("change_defect_status", {
        p_defect: reported,
        p_status: "resolved",
      });
      expect(noNote?.message).toMatch(/resolution_required/);
      await carol.client.rpc("change_defect_status", {
        p_defect: reported,
        p_status: "resolved",
        p_note: "Seřízen zavírač.",
      });
      const { data: resolved } = await alice.client
        .from("defects")
        .select("status, resolved_by, resolution_note, resolved_at")
        .eq("id", reported)
        .single();
      expect(resolved).toMatchObject({
        status: "resolved",
        resolved_by: carol.id,
        resolution_note: "Seřízen zavírač.",
      });

      await alice.client.rpc("change_defect_status", { p_defect: reported, p_status: "open" });
      await alice.client.rpc("change_defect_severity", { p_defect: reported, p_severity: "major" });
      await alice.client.rpc("edit_defect_description", {
        p_defect: reported,
        p_description: "Dveře nedovírají",
      });
      await alice.client.rpc("comment_defect", { p_defect: reported, p_note: "Objednán díl." });
      const { data: reopened } = await alice.client
        .from("defects")
        .select("status, resolved_at, resolution_note, severity")
        .eq("id", reported)
        .single();
      expect(reopened).toEqual({
        status: "open",
        resolved_at: null,
        resolution_note: null,
        severity: "major",
      });
      const { data: events } = await alice.client
        .from("defect_events")
        .select("kind, actor, from_value, to_value")
        .eq("defect_id", reported)
        .order("created_at");
      expect(events?.map((e) => [e.kind, e.from_value, e.to_value])).toEqual([
        ["created", null, "minor"],
        ["status", "open", "in_progress"],
        ["status", "in_progress", "resolved"],
        ["status", "resolved", "open"],
        ["severity", "minor", "major"],
        ["description", "Dveře nejdou zavřít", "Dveře nedovírají"],
        ["comment", null, null],
      ]);
      expect(events?.slice(0, 3).every((e) => e.actor === carol.id)).toBe(true);
    });

    it("another company can't see, report or change defects", async () => {
      const { data } = await bob.client.from("defects").select("id");
      expect(data).toEqual([]);
      const { data: events } = await bob.client.from("defect_events").select("id");
      expect(events).toEqual([]);
      const { error: report } = await bob.client.rpc("create_defect", {
        p_device: devices[0]!,
        p_description: "planted",
        p_severity: "minor",
      });
      expect(report?.message).toMatch(/not_found/);
      const { error: comment } = await bob.client.rpc("comment_defect", {
        p_defect: found,
        p_note: "hijacked",
      });
      expect(comment?.message).toMatch(/not_found/);
      const { error: direct } = await alice.client
        .from("defects")
        .update({ status: "resolved" } as never)
        .eq("id", found);
      expect(direct).not.toBeNull();
    });

    it("photos go to the defect's folder of its own company", async () => {
      const path = `${orgA}/defects/${found}/photo-${run}.png`;
      const { error: upload } = await carol.client.storage
        .from("org-assets")
        .upload(path, png, { contentType: "image/png" });
      expect(upload).toBeNull();
      const { error } = await carol.client.rpc("add_defect_photo", {
        p_defect: found,
        p_path: path,
        p_content_type: "image/png",
        p_size: png.length,
      });
      expect(error).toBeNull();
      const { error: bobUpload } = await bob.client.storage
        .from("org-assets")
        .upload(`${orgA}/defects/${found}/bob-${run}.png`, png, { contentType: "image/png" });
      expect(bobUpload).not.toBeNull();
      const { error: elsewhere } = await carol.client.rpc("add_defect_photo", {
        p_defect: found,
        p_path: `${orgA}/defects/${reported}/photo-${run}.png`,
        p_content_type: "image/png",
        p_size: png.length,
      });
      expect(elsewhere?.message).toMatch(/not_found/);
      await carol.client.storage.from("org-assets").remove([path]);
    });

    // Last in this group: it replaces the type's checklist with a new version.
    it("an item that records defects only on request still adds to an open one", async () => {
      const { data: type } = await alice.client.from("device_types").select("id").single();
      const { error: saved } = await alice.client.rpc("save_checklist_template", {
        p_device_type: type!.id,
        p_name: "Signs",
        p_items: [
          { label: "Sign legible", type: "pass_fail", required: true, failCreatesDefect: false },
        ],
      });
      expect(saved).toBeNull();
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Signs customer" })
        .select("id")
        .single();
      const { data: signSite } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customer!.id, name: "Signs site" })
        .select("id")
        .single();
      const { data: device } = await alice.client
        .from("devices")
        .insert({ organization_id: orgA, site_id: signSite!.id, device_type_id: type!.id })
        .select("id")
        .single();
      const { data: question } = await alice.client
        .from("checklist_template_items")
        .select("id, template:checklist_templates!inner(device_type_id, active)")
        .eq("template.device_type_id", type!.id)
        .eq("template.active", true)
        .single();

      /** One inspection where the sign fails; returns how many defects it created. */
      async function failSign(severity: "minor" | null) {
        const { data: inspection } = await alice.client.rpc("start_inspection", {
          p_site: signSite!.id,
        });
        const { data } = await alice.client.rpc("open_device_check", {
          p_inspection: inspection!,
          p_device: device!.id,
        });
        const item = (data as { item: string }).item;
        await alice.client.rpc("save_answer", {
          p_item: item,
          p_template_item: question!.id,
          p_value_pass: false,
          p_value_number: null,
          p_value_text: null,
          p_note: null,
          p_defect_severity: severity,
        });
        await alice.client.rpc("finish_device_check", { p_item: item });
        const { data: summary } = await alice.client.rpc("complete_inspection", {
          p_inspection: inspection!,
        });
        return (summary as { defects: number }).defects;
      }

      // Not asked for: nothing recorded.
      expect(await failSign(null)).toBe(0);
      // Asked for: a defect.
      expect(await failSign("minor")).toBe(1);
      // Not asked for again, but the defect is open: added to its history.
      expect(await failSign(null)).toBe(0);
      const { data: defects } = await alice.client
        .from("defects")
        .select("severity, defect_events(kind)")
        .eq("device_id", device!.id);
      expect(defects).toHaveLength(1);
      expect(defects![0]!.severity).toBe("minor");
      expect(defects![0]!.defect_events.map((event) => event.kind).sort()).toEqual([
        "created",
        "observed",
      ]);
    });
  });

  describe("protocols", () => {
    let sites: string[] = [];
    let first: { id: string; inspection: string; number: number };
    const pdf = new Blob(["%PDF-1.7"], { type: "application/pdf" });

    beforeAll(async () => {
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Protocols customer" })
        .select("id")
        .single();
      const { data } = await alice.client
        .from("sites")
        .insert(
          [1, 2, 3, 4].map((n) => ({
            organization_id: orgA,
            customer_id: customer!.id,
            name: `Protocols site ${n}`,
          })),
        )
        .select("id");
      sites = data!.map((site) => site.id);
    });

    /** Completes an inspection of a building (nothing checked) and returns the summary. */
    async function completeOn(site: string) {
      const { data: inspection } = await alice.client.rpc("start_inspection", { p_site: site });
      const { data, error } = await alice.client.rpc("complete_inspection", {
        p_inspection: inspection!,
      });
      expect(error).toBeNull();
      return { inspection: inspection!, protocol: (data as { protocol: string }).protocol };
    }

    it("completing an inspection numbers its protocol in the company's language", async () => {
      const { inspection, protocol } = await completeOn(sites[0]!);
      const { data } = await alice.client
        .from("protocols")
        .select("id, inspection_id, year, number, locale, pdf_path")
        .eq("id", protocol)
        .single();
      const year = Number(
        new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
          new Date(),
        ),
      );
      expect(data).toMatchObject({ inspection_id: inspection, year, locale: "cs", pdf_path: null });
      first = { id: protocol, inspection, number: data!.number };
    });

    it("completions at the same time get consecutive numbers, none shared", async () => {
      const started = await Promise.all(
        sites.slice(1).map(async (site) => {
          const { data } = await alice.client.rpc("start_inspection", { p_site: site });
          return data!;
        }),
      );
      const results = await Promise.all(
        started.map((inspection) =>
          alice.client.rpc("complete_inspection", { p_inspection: inspection }),
        ),
      );
      expect(results.map((result) => result.error)).toEqual([null, null, null]);
      const { data } = await alice.client
        .from("protocols")
        .select("number")
        .in("inspection_id", started)
        .order("number");
      expect(data?.map((row) => row.number)).toEqual([
        first.number + 1,
        first.number + 2,
        first.number + 3,
      ]);
    });

    it("asking again returns the same protocol; an open inspection has none", async () => {
      const { data: again } = await alice.client.rpc("ensure_protocol", {
        p_inspection: first.inspection,
      });
      expect(again).toBe(first.id);
      const { data: open } = await alice.client.rpc("start_inspection", { p_site: sites[0]! });
      const { error } = await alice.client.rpc("ensure_protocol", { p_inspection: open! });
      expect(error?.message).toMatch(/inspection_open/);
      await alice.client.rpc("complete_inspection", { p_inspection: open! });
    });

    it("nobody in the app writes protocols or their files", async () => {
      const { error: insert } = await alice.client
        .from("protocols")
        .insert({ organization_id: orgA, inspection_id: first.inspection } as never);
      expect(insert).not.toBeNull();
      const { data: updated } = await alice.client
        .from("protocols")
        .update({ pdf_path: `${orgA}/protocols/fake.pdf` })
        .eq("id", first.id)
        .select("id");
      expect(updated ?? []).toEqual([]);
      // Not even the owner, who may upload the company's logo.
      const { error: upload } = await alice.client.storage
        .from("protocols")
        .upload(`${orgA}/2026/${first.id}.pdf`, pdf, { contentType: "application/pdf" });
      expect(upload).not.toBeNull();
    });

    it("an e-mail is recorded only for a stored PDF, with who sent it", async () => {
      const { error: missing } = await alice.client.rpc("record_protocol_email", {
        p_protocol: first.id,
        p_recipient: "zakaznik@example.com",
      });
      expect(missing?.message).toMatch(/protocol_missing/);

      // The server stores the PDF with the service role.
      const path = `${orgA}/2026/${first.id}.pdf`;
      const { error: stored } = await admin.storage
        .from("protocols")
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      expect(stored).toBeNull();
      await admin
        .from("protocols")
        .update({ pdf_path: path, pdf_size: 8, generated_at: new Date().toISOString() })
        .eq("id", first.id);

      const { error } = await alice.client.rpc("record_protocol_email", {
        p_protocol: first.id,
        p_recipient: " zakaznik@example.com ",
      });
      expect(error).toBeNull();
      const { data: sent } = await alice.client
        .from("protocol_emails")
        .select("recipient, sent_by")
        .eq("protocol_id", first.id);
      expect(sent).toEqual([{ recipient: "zakaznik@example.com", sent_by: alice.id }]);
      const { data: file } = await alice.client.storage.from("protocols").download(path);
      expect(await file?.text()).toBe("%PDF-1.7");
    });

    it("another company sees none of it and can't touch it", async () => {
      const { data: protocols } = await bob.client
        .from("protocols")
        .select("id")
        .eq("id", first.id);
      expect(protocols).toEqual([]);
      const { data: emails } = await bob.client
        .from("protocol_emails")
        .select("id")
        .eq("protocol_id", first.id);
      expect(emails).toEqual([]);
      const { error: ensure } = await bob.client.rpc("ensure_protocol", {
        p_inspection: first.inspection,
      });
      expect(ensure?.message).toMatch(/not_found/);
      const { error: record } = await bob.client.rpc("record_protocol_email", {
        p_protocol: first.id,
        p_recipient: "bob@example.com",
      });
      expect(record?.message).toMatch(/not_found/);
      const { data: file } = await bob.client.storage
        .from("protocols")
        .download(`${orgA}/2026/${first.id}.pdf`);
      expect(file).toBeNull();
      await admin.storage.from("protocols").remove([`${orgA}/2026/${first.id}.pdf`]);
    });
  });

  describe("correcting a completed inspection (a fresh organization)", () => {
    let gina: TestUser;
    let hank: TestUser;
    let org: string;
    let site: string;
    let otherSite: string;
    let devices: string[];
    let questions: {
      id: string;
      item_type: string;
      required: boolean;
      fail_creates_defect: boolean;
    }[];
    let inspection: string;
    let completedAt: string;
    let first: { id: string; year: number; number: number };
    const today = () => todayInTimeZone("Europe/Prague");

    beforeAll(async () => {
      gina = await createUser("gina");
      hank = await createUser("hank");
      org = await createOrg(gina, `RLS corrections ${run}`);
      const token = generateToken();
      await gina.client.from("invitations").insert({
        organization_id: org,
        email: hank.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: gina.id,
      });
      const { error: joined } = await hank.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Hank",
      });
      expect(joined).toBeNull();
      const { data: customer } = await gina.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: s, error: sitesError } = await gina.client
        .from("sites")
        .insert(
          [1, 2].map((n) => ({ organization_id: org, customer_id: customer!.id, name: `S${n}` })),
        )
        .select("id, name")
        .order("name");
      if (!s) throw sitesError;
      site = s[0]!.id;
      otherSite = s![1]!.id;
      const { data: type } = await gina.client.from("device_types").select("id").single();
      const { data: rows } = await gina.client
        .from("devices")
        .insert(
          [1, 2].map(() => ({ organization_id: org, site_id: site, device_type_id: type!.id })),
        )
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: template } = await gina.client
        .from("checklist_templates")
        .select(
          "checklist_template_items(id, item_type, required, fail_creates_defect, sort_order)",
        )
        .eq("device_type_id", type!.id)
        .eq("active", true)
        .single();
      questions = [...template!.checklist_template_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    });

    /** Checks a device; `fail` answers the first defect question "no". */
    async function check(user: TestUser, device: string, fail: boolean) {
      const { data } = await user.client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: device,
      });
      const item = (data as { item: string }).item;
      const defectQuestion = questions.find(
        (q) => q.required && q.item_type === "pass_fail" && q.fail_creates_defect,
      );
      for (const question of questions.filter((q) => q.required)) {
        const failing = fail && question === defectQuestion;
        const { error } = await user.client.rpc("save_answer", {
          p_item: item,
          p_template_item: question.id,
          p_value_pass: question.item_type === "pass_fail" ? !failing : null,
          p_value_number: question.item_type === "number" ? 5 : null,
          p_value_text: question.item_type === "text" ? "OK" : null,
          p_note: failing ? "Plomba chybí" : null,
          p_defect_severity: null,
        });
        expect(error).toBeNull();
      }
      const { error } = await user.client.rpc("finish_device_check", { p_item: item });
      expect(error).toBeNull();
    }

    async function dates() {
      const { data } = await admin
        .from("devices")
        .select("id, last_inspection_on")
        .in("id", devices);
      return devices.map((id) => data!.find((row) => row.id === id)!.last_inspection_on);
    }

    async function protocols() {
      const { data } = await gina.client
        .from("protocols")
        .select("id, year, number, version, active, superseded_at")
        .eq("inspection_id", inspection)
        .order("version");
      return data!;
    }

    it("the technician completes it; only an owner or admin reopens it, with a reason", async () => {
      const { data: started } = await hank.client.rpc("start_inspection", { p_site: site });
      inspection = started!;
      await check(hank, devices[0]!, false);
      await check(hank, devices[1]!, false);
      const { error } = await hank.client.rpc("complete_inspection", { p_inspection: inspection });
      expect(error).toBeNull();
      const [protocol] = await protocols();
      expect(protocol).toMatchObject({ version: 1, active: true, superseded_at: null });
      first = { id: protocol!.id, year: protocol!.year, number: protocol!.number };
      expect(await dates()).toEqual([today(), today()]);
      const { data: row } = await admin
        .from("inspections")
        .select("completed_at")
        .eq("id", inspection)
        .single();
      completedAt = row!.completed_at!;

      const reason = { p_inspection: inspection, p_reason: "Zařízení 1 nevyhovuje" };
      const { error: technician } = await hank.client.rpc("reopen_inspection", reason);
      expect(technician?.message).toMatch(/forbidden/);
      const { error: stranger } = await bob.client.rpc("reopen_inspection", reason);
      expect(stranger?.message).toMatch(/not_found/);
      const { error: blank } = await gina.client.rpc("reopen_inspection", {
        p_inspection: inspection,
        p_reason: "   ",
      });
      expect(blank?.message).toMatch(/invalid_answer/);
    });

    it("reopening takes back its due dates; no new inspection or cancel slips into it", async () => {
      const { error } = await gina.client.rpc("reopen_inspection", {
        p_inspection: inspection,
        p_reason: "Zařízení 1 nevyhovuje",
      });
      expect(error).toBeNull();
      const { data: row } = await admin
        .from("inspections")
        .select("status, completed_at, reopened_at")
        .eq("id", inspection)
        .single();
      expect(row).toMatchObject({ status: "in_progress", completed_at: null });
      expect(row!.reopened_at).not.toBeNull();
      // The devices had no date before this inspection.
      expect(await dates()).toEqual([null, null]);

      const { error: again } = await gina.client.rpc("reopen_inspection", {
        p_inspection: inspection,
        p_reason: "Znovu",
      });
      expect(again?.message).toMatch(/inspection_open/);
      const { error: start } = await hank.client.rpc("start_inspection", { p_site: site });
      expect(start?.message).toMatch(/correction_in_progress/);
      const { error: cancel } = await gina.client.rpc("cancel_inspection", {
        p_inspection: inspection,
      });
      expect(cancel?.message).toMatch(/correction_not_cancellable/);

      const { data: record } = await hank.client
        .from("inspection_reopenings")
        .select("reason, reopened_by, previous_completed_by, completed_at")
        .eq("inspection_id", inspection);
      expect(record).toEqual([
        {
          reason: "Zařízení 1 nevyhovuje",
          reopened_by: gina.id,
          previous_completed_by: hank.id,
          completed_at: null,
        },
      ]);
      const { data: hidden } = await bob.client
        .from("inspection_reopenings")
        .select("id")
        .eq("inspection_id", inspection);
      expect(hidden).toEqual([]);
      const { error: planted } = await gina.client.from("inspection_reopenings").insert({
        organization_id: org,
        inspection_id: inspection,
        reason: "planted",
      } as never);
      expect(planted).not.toBeNull();
    });

    it("completing the correction reissues the protocol and keeps what happened on site", async () => {
      await check(gina, devices[0]!, true);
      const { data, error } = await gina.client.rpc("complete_inspection", {
        p_inspection: inspection,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ passed: 1, failed: 1, defects: 1 });

      const versions = await protocols();
      expect(versions).toMatchObject([
        { version: 1, active: false, year: first.year, number: first.number },
        { version: 2, active: true, year: first.year, number: first.number },
      ]);
      expect(versions[0]!.superseded_at).not.toBeNull();
      expect((data as { protocol: string }).protocol).toBe(versions[1]!.id);

      // The original completion and technician stay; the correction is recorded.
      const { data: row } = await admin
        .from("inspections")
        .select("completed_at, completed_by")
        .eq("id", inspection)
        .single();
      expect(new Date(row!.completed_at!).getTime()).toBe(new Date(completedAt).getTime());
      expect(row!.completed_by).toBe(hank.id);
      const { data: record } = await gina.client
        .from("inspection_reopenings")
        .select("completed_by, completed_at")
        .eq("inspection_id", inspection);
      expect(record![0]!.completed_by).toBe(gina.id);
      expect(record![0]!.completed_at).not.toBeNull();
      const { data: item } = await admin
        .from("inspection_items")
        .select("checked_by, original_checked_by")
        .eq("inspection_id", inspection)
        .eq("device_id", devices[0]!)
        .single();
      expect(item).toEqual({ checked_by: gina.id, original_checked_by: hank.id });

      // The failed device keeps no date; the untouched one gets its date back.
      expect(await dates()).toEqual([null, today()]);
    });

    it("a second correction records nothing twice and uses up no protocol number", async () => {
      const { error: reopened } = await gina.client.rpc("reopen_inspection", {
        p_inspection: inspection,
        p_reason: "Doplnění poznámky",
      });
      expect(reopened).toBeNull();
      await check(gina, devices[0]!, true);
      const { data, error } = await gina.client.rpc("complete_inspection", {
        p_inspection: inspection,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ failed: 1, defects: 0 });

      const { data: defects } = await gina.client
        .from("defects")
        .select("id, defect_events(kind)")
        .eq("device_id", devices[0]!);
      expect(defects).toHaveLength(1);
      expect(defects![0]!.defect_events).toEqual([{ kind: "created" }]);
      expect((await protocols()).map((p) => [p.version, p.active, p.number])).toEqual([
        [1, false, first.number],
        [2, false, first.number],
        [3, true, first.number],
      ]);

      const { data: next } = await gina.client.rpc("start_inspection", { p_site: otherSite });
      const { data: done } = await gina.client.rpc("complete_inspection", {
        p_inspection: next!,
      });
      const { data: nextProtocol } = await gina.client
        .from("protocols")
        .select("number")
        .eq("id", (done as { protocol: string }).protocol)
        .single();
      expect(nextProtocol!.number).toBe(first.number + 1);
    });

    it("a signature comes only from the company's folder and survives a correction", async () => {
      const { data: started } = await gina.client.rpc("start_inspection", { p_site: site });
      const { error: foreign } = await gina.client.rpc("complete_inspection", {
        p_inspection: started!,
        p_signature_path: `${orgB}/signatures/${started}.png`,
        p_signer_name: "Jana Malá",
      });
      expect(foreign?.message).toMatch(/invalid_answer/);
      const path = `${org}/signatures/${started}.png`;
      const { error } = await gina.client.rpc("complete_inspection", {
        p_inspection: started!,
        p_signature_path: path,
        p_signer_name: " Jana Malá ",
      });
      expect(error).toBeNull();
      const signature = async () =>
        (
          await admin
            .from("inspections")
            .select("customer_signature_path, customer_signer_name, customer_signed_at")
            .eq("id", started!)
            .single()
        ).data!;
      const signed = await signature();
      expect(signed).toMatchObject({
        customer_signature_path: path,
        customer_signer_name: "Jana Malá",
      });
      expect(signed.customer_signed_at).not.toBeNull();

      // Corrected without signing again: the signature stays as it was.
      await gina.client.rpc("reopen_inspection", { p_inspection: started!, p_reason: "Překlep" });
      await gina.client.rpc("complete_inspection", { p_inspection: started! });
      expect(await signature()).toEqual(signed);

      // A new name alone replaces the whole signature (no stale drawing under it).
      await gina.client.rpc("reopen_inspection", { p_inspection: started!, p_reason: "Jiný" });
      await gina.client.rpc("complete_inspection", {
        p_inspection: started!,
        p_signer_name: "Petr Nový",
      });
      expect(await signature()).toMatchObject({
        customer_signature_path: null,
        customer_signer_name: "Petr Nový",
      });
    });
  });

  describe("weekly summary", () => {
    it("owners turn it on and off; technicians can't", async () => {
      const { data: initial } = await alice.client
        .from("organizations")
        .select("weekly_digest")
        .eq("id", orgA)
        .single();
      expect(initial?.weekly_digest).toBe(true);
      const { data: off } = await alice.client
        .from("organizations")
        .update({ weekly_digest: false })
        .eq("id", orgA)
        .select("weekly_digest");
      expect(off).toEqual([{ weekly_digest: false }]);
      const { data: technician } = await carol.client
        .from("organizations")
        .update({ weekly_digest: true })
        .eq("id", orgA)
        .select("id");
      expect(technician ?? []).toEqual([]);
      await alice.client.from("organizations").update({ weekly_digest: true }).eq("id", orgA);
    });

    it("a week is sent once; owners and admins of the company see it", async () => {
      const { error: byUser } = await alice.client
        .from("organization_digests")
        .insert({ organization_id: orgA, week: "2026-10-12", recipients: 1 } as never);
      expect(byUser).not.toBeNull();

      // The Monday job (service role) claims the week; a second claim fails.
      const { error } = await admin
        .from("organization_digests")
        .insert({ organization_id: orgA, week: "2026-10-12", recipients: 2 });
      expect(error).toBeNull();
      const { error: again } = await admin
        .from("organization_digests")
        .insert({ organization_id: orgA, week: "2026-10-12", recipients: 2 });
      expect(again?.code).toBe("23505");
      // Weeks are Mondays.
      const { error: tuesday } = await admin
        .from("organization_digests")
        .insert({ organization_id: orgA, week: "2026-10-13", recipients: 1 });
      expect(tuesday).not.toBeNull();

      const { data: owner } = await alice.client
        .from("organization_digests")
        .select("week, recipients")
        .eq("organization_id", orgA);
      expect(owner).toEqual([{ week: "2026-10-12", recipients: 2 }]);
      const { data: technician } = await carol.client
        .from("organization_digests")
        .select("id")
        .eq("organization_id", orgA);
      expect(technician).toEqual([]);
      const { data: other } = await bob.client
        .from("organization_digests")
        .select("id")
        .eq("organization_id", orgA);
      expect(other).toEqual([]);
    });
  });

  describe("getting started", () => {
    const year = Number(
      new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Prague" }).format(
        new Date(),
      ),
    );
    /** The highest real (or, with `sample`, sample) number in use. */
    async function highest(table: "devices" | "protocols", sample = false) {
      if (table === "devices") {
        const query = admin.from("devices").select("label_number").eq("organization_id", orgA);
        const { data } = await (
          sample ? query.gt("label_number", 900000) : query.lt("label_number", 900000)
        )
          .order("label_number", { ascending: false })
          .limit(1);
        return data?.[0]?.label_number ?? 0;
      }
      const query = admin
        .from("protocols")
        .select("number")
        .eq("organization_id", orgA)
        .eq("year", year);
      const { data } = await (sample ? query.gt("number", 900000) : query.lt("number", 900000))
        .order("number", { ascending: false })
        .limit(1);
      return data?.[0]?.number ?? 0;
    }

    it("only owners and admins add sample data, and only once", async () => {
      const { error: technician } = await carol.client.rpc("create_sample_data", { p_org: orgA });
      expect(technician?.message).toMatch(/forbidden/);
      const { error: other } = await bob.client.rpc("create_sample_data", { p_org: orgA });
      expect(other?.message).toMatch(/forbidden/);

      const labelsBefore = await highest("devices");
      const { data: customer, error } = await alice.client.rpc("create_sample_data", {
        p_org: orgA,
      });
      expect(error).toBeNull();
      const { data: sample } = await alice.client
        .from("customers")
        .select("is_sample, sites(id, devices(label_number, status, next_due_on))")
        .eq("id", customer!)
        .single();
      expect(sample?.is_sample).toBe(true);
      expect(sample?.sites).toHaveLength(2);
      const devices = sample!.sites.flatMap((site) => site.devices);
      expect(devices).toHaveLength(9);
      // Sample numbers of their own, far from the real ones.
      expect(devices.map((d) => d.label_number).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 9 }, (_, i) => 900001 + i),
      );
      expect(await highest("devices")).toBe(labelsBefore);
      expect(devices.filter((d) => d.status === "active" && d.next_due_on === null)).toHaveLength(
        1,
      );

      const { error: twice } = await alice.client.rpc("create_sample_data", { p_org: orgA });
      expect(twice?.message).toMatch(/sample_exists/);
    });

    it("no one marks a real customer as a sample, or unmarks one", async () => {
      const { error: insert } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Fake sample", is_sample: true } as never);
      expect(insert).not.toBeNull();
      const { data: real } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Real customer" })
        .select("id")
        .single();
      const { error: mark } = await alice.client
        .from("customers")
        .update({ is_sample: true } as never)
        .eq("id", real!.id);
      expect(mark).not.toBeNull();
    });

    it("removing sample data takes what was done with it; real numbers never moved", async () => {
      const labels = await highest("devices");
      const protocols = await highest("protocols");
      // Try it out: an inspection on a sample building numbers a protocol.
      const { data: sampleSite } = await alice.client
        .from("sites")
        .select("id, customer:customers!inner(is_sample)")
        .eq("customer.is_sample", true)
        .limit(1)
        .single();
      const { data: inspection } = await alice.client.rpc("start_inspection", {
        p_site: sampleSite!.id,
      });
      await alice.client.rpc("complete_inspection", { p_inspection: inspection! });
      expect(await highest("protocols", true)).toBe(900001);
      expect(await highest("protocols")).toBe(protocols);

      const { error: other } = await bob.client.rpc("remove_sample_data", { p_org: orgA });
      expect(other?.message).toMatch(/forbidden/);
      const { error: technician } = await carol.client.rpc("remove_sample_data", { p_org: orgA });
      expect(technician?.message).toMatch(/forbidden/);

      const { data: files, error } = await alice.client.rpc("remove_sample_data", { p_org: orgA });
      expect(error).toBeNull();
      expect(files).toEqual([]);
      const { data: left } = await admin
        .from("customers")
        .select("id")
        .eq("organization_id", orgA)
        .eq("is_sample", true);
      expect(left).toEqual([]);
      const { data: gone } = await admin.from("inspections").select("id").eq("id", inspection!);
      expect(gone).toEqual([]);

      // Real numbers continue right after the highest real one.
      const { data: real } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "After the sample" })
        .select("id")
        .single();
      const { data: site } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: real!.id, name: "After the sample site" })
        .select("id")
        .single();
      const { data: type } = await alice.client.from("device_types").select("id").limit(1).single();
      const { data: device } = await alice.client
        .from("devices")
        .insert({ organization_id: orgA, site_id: site!.id, device_type_id: type!.id })
        .select("label_number")
        .single();
      expect(device?.label_number).toBe(labels + 1);
      const { data: next } = await alice.client.rpc("start_inspection", { p_site: site!.id });
      await alice.client.rpc("complete_inspection", { p_inspection: next! });
      expect(await highest("protocols")).toBe(protocols + 1);
    });

    it("printing labels is noted for the company, by its members only", async () => {
      const { error: other } = await bob.client.rpc("note_labels_printed", { p_org: orgA });
      expect(other?.message).toMatch(/not_found/);
      const { error } = await carol.client.rpc("note_labels_printed", { p_org: orgA });
      expect(error).toBeNull();
      const { data } = await alice.client
        .from("organizations")
        .select("labels_printed_at")
        .eq("id", orgA)
        .single();
      expect(data?.labels_printed_at).not.toBeNull();
    });
  });

  describe("floor plans", () => {
    let site: string;
    let otherSite: string;
    let floor: string;
    let plan: string;
    let secondPlan: string;
    let device: string;
    let deviceElsewhere: string;
    let bobSite: string;
    let bobDevice: string;
    let bobPlan: string;
    const image = (org: string, siteId: string) =>
      `${org}/floor-plans/${siteId}/${randomUUID()}.webp`;

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").limit(1).single();
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Plans customer" })
        .select("id")
        .single();
      const { data: sites } = await alice.client
        .from("sites")
        .insert([
          { organization_id: orgA, customer_id: customer!.id, name: "Plan site" },
          { organization_id: orgA, customer_id: customer!.id, name: "Plan other site" },
        ])
        .select("id, name");
      site = sites!.find((s) => s.name === "Plan site")!.id;
      otherSite = sites!.find((s) => s.name === "Plan other site")!.id;
      const { data: location } = await alice.client
        .from("locations")
        .insert({ organization_id: orgA, site_id: site, name: "1. patro" })
        .select("id")
        .single();
      floor = location!.id;
      const { data: devices } = await alice.client
        .from("devices")
        .insert([
          { organization_id: orgA, site_id: site, device_type_id: type!.id },
          { organization_id: orgA, site_id: otherSite, device_type_id: type!.id },
        ])
        .select("id, site_id");
      device = devices!.find((d) => d.site_id === site)!.id;
      deviceElsewhere = devices!.find((d) => d.site_id === otherSite)!.id;

      const { data: bobType } = await bob.client
        .from("device_types")
        .select("id")
        .limit(1)
        .single();
      const { data: bobCustomer } = await bob.client
        .from("customers")
        .insert({ organization_id: orgB, name: "Bob plans" })
        .select("id")
        .single();
      const { data: bobSiteRow } = await bob.client
        .from("sites")
        .insert({ organization_id: orgB, customer_id: bobCustomer!.id, name: "Bob site" })
        .select("id")
        .single();
      bobSite = bobSiteRow!.id;
      const { data: bobDeviceRow } = await bob.client
        .from("devices")
        .insert({ organization_id: orgB, site_id: bobSite, device_type_id: bobType!.id })
        .select("id")
        .single();
      bobDevice = bobDeviceRow!.id;
      const { data: bobPlanRow, error } = await bob.client
        .from("floor_plans")
        .insert({
          organization_id: orgB,
          site_id: bobSite,
          name: "Bob plan",
          image_path: image(orgB, bobSite),
          image_width: 100,
          image_height: 100,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      bobPlan = bobPlanRow!.id;
    });

    it("an owner adds plans of a building and places its devices", async () => {
      const { data, error } = await alice.client
        .from("floor_plans")
        .insert([
          {
            organization_id: orgA,
            site_id: site,
            location_id: floor,
            name: "1. patro",
            sort_order: 1,
            image_path: image(orgA, site),
            image_width: 4096,
            image_height: 2048,
          },
          {
            organization_id: orgA,
            site_id: site,
            name: "Suterén",
            sort_order: 2,
            image_path: image(orgA, site),
            image_width: 2000,
            image_height: 2000,
          },
        ])
        .select("id, name, created_by");
      expect(error).toBeNull();
      plan = data!.find((p) => p.name === "1. patro")!.id;
      secondPlan = data!.find((p) => p.name === "Suterén")!.id;
      expect(data!.every((p) => p.created_by === alice.id)).toBe(true);

      const { error: placeError } = await alice.client.rpc("place_device", {
        p_device: device,
        p_plan: plan,
        p_x: 0.25,
        p_y: 0.75,
      });
      expect(placeError).toBeNull();
      // Placing again moves it (to another plan of the building).
      const { error: moveError } = await alice.client.rpc("place_device", {
        p_device: device,
        p_plan: secondPlan,
        p_x: 0.5,
        p_y: 0.5,
      });
      expect(moveError).toBeNull();
      const { data: spots } = await alice.client
        .from("device_placements")
        .select("floor_plan_id, site_id, x, y, updated_by")
        .eq("device_id", device);
      expect(spots).toEqual([
        { floor_plan_id: secondPlan, site_id: site, x: 0.5, y: 0.5, updated_by: alice.id },
      ]);
    });

    it("another organization can't see, change or use them", async () => {
      const { data: plans } = await bob.client.from("floor_plans").select("id").eq("site_id", site);
      expect(plans).toEqual([]);
      const { data: spots } = await bob.client
        .from("device_placements")
        .select("device_id")
        .eq("device_id", device);
      expect(spots).toEqual([]);
      const { data: renamed } = await bob.client
        .from("floor_plans")
        .update({ name: "Hacked" })
        .eq("id", plan)
        .select("id");
      expect(renamed).toEqual([]);
      const { data: deleted } = await bob.client
        .from("floor_plans")
        .delete()
        .eq("id", plan)
        .select("id");
      expect(deleted).toEqual([]);
      // Not a plan in A's building, nor A's device on B's plan, nor B's on A's.
      const { error: plant } = await bob.client.from("floor_plans").insert({
        organization_id: orgB,
        site_id: site,
        name: "Planted",
        image_path: image(orgB, site),
        image_width: 10,
        image_height: 10,
      });
      expect(plant).not.toBeNull();
      const { error: steal } = await bob.client.rpc("place_device", {
        p_device: device,
        p_plan: bobPlan,
        p_x: 0.1,
        p_y: 0.1,
      });
      expect(steal).not.toBeNull();
      const { error: intrude } = await bob.client.rpc("place_device", {
        p_device: bobDevice,
        p_plan: plan,
        p_x: 0.1,
        p_y: 0.1,
      });
      expect(intrude).not.toBeNull();
      const { data: unchanged } = await admin
        .from("device_placements")
        .select("floor_plan_id")
        .eq("device_id", device)
        .single();
      expect(unchanged?.floor_plan_id).toBe(secondPlan);
    });

    it("a technician sees the plans but can't change them", async () => {
      const { data } = await carol.client.from("floor_plans").select("id").eq("site_id", site);
      expect(data).toHaveLength(2);
      const { data: spots } = await carol.client
        .from("device_placements")
        .select("device_id")
        .eq("device_id", device);
      expect(spots).toHaveLength(1);
      const { error: insert } = await carol.client.from("floor_plans").insert({
        organization_id: orgA,
        site_id: site,
        name: "Technician plan",
        image_path: image(orgA, site),
        image_width: 10,
        image_height: 10,
      });
      expect(insert).not.toBeNull();
      const { error: place } = await carol.client.rpc("place_device", {
        p_device: device,
        p_plan: plan,
        p_x: 0.9,
        p_y: 0.9,
      });
      expect(place).not.toBeNull();
      const { data: removed } = await carol.client
        .from("device_placements")
        .delete()
        .eq("device_id", device)
        .select("device_id");
      expect(removed).toEqual([]);
    });

    it("a device and its plan are in the same building; spots stay on the plan", async () => {
      const { error: elsewhere } = await alice.client.rpc("place_device", {
        p_device: deviceElsewhere,
        p_plan: plan,
        p_x: 0.5,
        p_y: 0.5,
      });
      expect(elsewhere?.code).toBe("23503");
      const { error: outside } = await alice.client.rpc("place_device", {
        p_device: device,
        p_plan: plan,
        p_x: 1.2,
        p_y: 0.5,
      });
      expect(outside?.code).toBe("23514");
    });

    it("the image is in the organization's folder; building and author don't change", async () => {
      const { error: foreign } = await alice.client.from("floor_plans").insert({
        organization_id: orgA,
        site_id: site,
        name: "Foreign image",
        image_path: image(orgB, bobSite),
        image_width: 10,
        image_height: 10,
      });
      expect(foreign?.code).toBe("23514");
      const { error: move } = await alice.client
        .from("floor_plans")
        .update({ site_id: otherSite } as never)
        .eq("id", plan);
      expect(move).not.toBeNull();
      const { error: author } = await alice.client
        .from("floor_plans")
        .update({ created_by: bob.id } as never)
        .eq("id", plan);
      expect(author).not.toBeNull();
    });

    it("plans are reordered as a complete set", async () => {
      const { error: partial } = await alice.client.rpc("reorder_floor_plans", {
        p_site: site,
        p_ordered: [plan],
      });
      expect(partial?.message).toMatch(/floor_plans_mismatch/);
      const { error } = await alice.client.rpc("reorder_floor_plans", {
        p_site: site,
        p_ordered: [secondPlan, plan],
      });
      expect(error).toBeNull();
      const { data } = await alice.client
        .from("floor_plans")
        .select("id")
        .eq("site_id", site)
        .order("sort_order");
      expect(data?.map((p) => p.id)).toEqual([secondPlan, plan]);
      const { error: technician } = await carol.client.rpc("reorder_floor_plans", {
        p_site: site,
        p_ordered: [plan, secondPlan],
      });
      expect(technician).toBeNull(); // security invoker: RLS lets the update touch nothing
      const { data: still } = await alice.client
        .from("floor_plans")
        .select("id")
        .eq("site_id", site)
        .order("sort_order");
      expect(still?.map((p) => p.id)).toEqual([secondPlan, plan]);
    });

    it("deleting a plan takes its placements; the device stays", async () => {
      const { data, error } = await alice.client
        .from("floor_plans")
        .delete()
        .eq("id", secondPlan)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      const { data: spots } = await admin
        .from("device_placements")
        .select("device_id")
        .eq("device_id", device);
      expect(spots).toEqual([]);
      const { data: kept } = await alice.client.from("devices").select("id").eq("id", device);
      expect(kept).toHaveLength(1);
    });

    it("no new plans in a deleted building", async () => {
      await alice.client
        .from("sites")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", otherSite);
      const { error } = await alice.client.from("floor_plans").insert({
        organization_id: orgA,
        site_id: otherSite,
        name: "Late",
        image_path: image(orgA, otherSite),
        image_width: 10,
        image_height: 10,
      });
      expect(error?.message).toMatch(/site_deleted/);
    });
  });

  describe("imports", () => {
    let typeA: string;
    let typeB: string;
    const row = (
      customer: string,
      site: string,
      device: Json,
      extra: { [key: string]: Json } = {},
    ): Json => ({
      customer: {
        name: customer,
        company_id: null,
        contact_person: null,
        email: null,
        phone: null,
        billing_address: null,
      },
      site: { name: site, address: null, access_notes: null },
      location: null,
      device,
      ...extra,
    });
    const device = (serial: string | null, extra: { [key: string]: Json } = {}): Json => ({
      device_type_id: typeA,
      serial_number: serial,
      manufacturer: null,
      model: null,
      manufacture_year: null,
      installed_on: null,
      last_inspection_on: null,
      notes: null,
      attributes: {},
      ...extra,
    });
    const imported = async (id: string) => {
      const [customers, sites, devices] = await Promise.all([
        admin.from("customers").select("id, deleted_at").eq("import_id", id),
        admin.from("sites").select("id, deleted_at").eq("import_id", id),
        admin.from("devices").select("id, deleted_at, label_number").eq("import_id", id),
      ]);
      return {
        customers: customers.data ?? [],
        sites: sites.data ?? [],
        devices: devices.data ?? [],
      };
    };
    let first: { import_id: string; site_ids: string[] };

    beforeAll(async () => {
      const { data: a } = await alice.client.from("device_types").select("id").limit(1).single();
      const { data: b } = await bob.client.from("device_types").select("id").limit(1).single();
      typeA = a!.id;
      typeB = b!.id;
    });

    it("an owner imports customers, buildings, locations and devices in one go", async () => {
      const { data, error } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "soupis.xlsx",
        p_rows: [
          row(
            "Import družstvo",
            "Import 1",
            device("IMP-1", { last_inspection_on: "2025-05-01" }),
            {
              customer: {
                name: "Import družstvo",
                company_id: "27082440",
                contact_person: "Jana",
                email: "Jana@Example.com",
                phone: "+420 777 000 111",
                billing_address: "Praha",
              },
              location: "Suterén",
            },
          ),
          row("import DRUŽSTVO", "import 1", device("IMP-2"), { location: "suterén" }),
          row("Import družstvo", "Import 2", null),
        ],
      });
      expect(error).toBeNull();
      const result = data as {
        import_id: string;
        customers: number;
        sites: number;
        locations: number;
        devices: number;
        skipped: number;
        site_ids: string[];
      };
      expect(result).toMatchObject({
        customers: 1,
        sites: 2,
        locations: 1,
        devices: 2,
        skipped: 0,
      });
      expect(result.site_ids).toHaveLength(2);
      first = result;

      const records = await imported(result.import_id);
      expect(records.customers).toHaveLength(1);
      expect(records.devices.every((d) => d.label_number > 0)).toBe(true);
      const { data: customer } = await alice.client
        .from("customers")
        .select("email, company_id")
        .eq("id", records.customers[0]!.id)
        .single();
      expect(customer).toEqual({ email: "jana@example.com", company_id: "27082440" });
      const { data: due } = await alice.client
        .from("devices")
        .select("next_due_on")
        .eq("serial_number", "IMP-1")
        .single();
      expect(due?.next_due_on).not.toBeNull();
      const { data: history } = await alice.client
        .from("imports")
        .select("file_name, customers_created, sites_created, devices_created, created_by")
        .eq("id", result.import_id)
        .single();
      expect(history).toEqual({
        file_name: "soupis.xlsx",
        customers_created: 1,
        sites_created: 2,
        devices_created: 2,
        created_by: alice.id,
      });
    });

    it("importing again reuses what exists and skips known serial numbers", async () => {
      const { data, error } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "soupis.xlsx",
        p_rows: [
          // Same company ID under another name: the same customer.
          row("Družstvo (nový název)", "Import 1", device("imp-1"), {
            customer: { name: "Družstvo (nový název)", company_id: "27082440" },
          }),
          row("Import družstvo", "Import 1", device("IMP-3")),
        ],
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ customers: 0, sites: 0, devices: 1, skipped: 1 });
    });

    it("technicians and other organizations can't import or see the history", async () => {
      const { error: technician } = await carol.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "x.csv",
        p_rows: [row("T", "T", null)],
      });
      expect(technician?.message).toMatch(/forbidden/);
      const { data: seen } = await carol.client.from("imports").select("id");
      expect(seen).toEqual([]);
      const { error: other } = await bob.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "x.csv",
        p_rows: [row("B", "B", null)],
      });
      expect(other?.message).toMatch(/forbidden/);
      const { data: foreign } = await bob.client
        .from("imports")
        .select("id")
        .eq("id", first.import_id);
      expect(foreign).toEqual([]);
      const { error: undo } = await bob.client.rpc("undo_import", { p_import: first.import_id });
      expect(undo?.message).toMatch(/not_found/);
      const { error: write } = await alice.client
        .from("imports")
        .update({ file_name: "renamed" } as never)
        .eq("id", first.import_id);
      expect(write).not.toBeNull();
    });

    it("a type of another organization or a bad row rolls the whole import back", async () => {
      const before = (await admin.from("imports").select("id").eq("organization_id", orgA)).data!
        .length;
      const { error } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "bad.csv",
        p_rows: [
          row("Rollback s.r.o.", "R", device("R-1")),
          row("Rollback s.r.o.", "R", device("R-2", { device_type_id: typeB })),
        ],
      });
      expect(error?.message).toMatch(/import_invalid_type/);
      const { error: empty } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "bad.csv",
        p_rows: [],
      });
      expect(empty?.message).toMatch(/import_empty/);
      const { error: noName } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "bad.csv",
        p_rows: [row("", "R", null)],
      });
      expect(noName?.message).toMatch(/import_invalid_row/);
      const after = (await admin.from("imports").select("id").eq("organization_id", orgA)).data!
        .length;
      expect(after).toBe(before);
      const { data: customers } = await admin
        .from("customers")
        .select("id")
        .eq("name", "Rollback s.r.o.");
      expect(customers).toEqual([]);
    });

    it("an import in use can't be undone; an unused one is undone completely", async () => {
      // Something added by hand to an imported building: in use.
      await alice.client
        .from("devices")
        .insert({ organization_id: orgA, site_id: first.site_ids[0]!, device_type_id: typeA });
      const { error: inUse } = await alice.client.rpc("undo_import", { p_import: first.import_id });
      expect(inUse?.message).toMatch(/import_in_use/);

      const { data } = await alice.client.rpc("import_records", {
        p_org: orgA,
        p_file_name: "omyl.csv",
        p_rows: [row("Omyl a.s.", "Omyl", device("O-1"), { location: "Hala" })],
      });
      const mistake = (data as { import_id: string }).import_id;
      const { error: technician } = await carol.client.rpc("undo_import", { p_import: mistake });
      expect(technician?.message).toMatch(/not_found/);
      const { error } = await alice.client.rpc("undo_import", { p_import: mistake });
      expect(error).toBeNull();
      const records = await imported(mistake);
      expect(
        [...records.customers, ...records.sites, ...records.devices].every((r) => r.deleted_at),
      ).toBe(true);
      const { data: locations } = await admin
        .from("locations")
        .select("id")
        .eq("import_id", mistake);
      expect(locations).toEqual([]);
      const { data: history } = await alice.client
        .from("imports")
        .select("undone_at")
        .eq("id", mistake)
        .single();
      expect(history?.undone_at).not.toBeNull();
      const { error: again } = await alice.client.rpc("undo_import", { p_import: mistake });
      expect(again?.message).toMatch(/import_undone/);
    });
  });

  describe("inspections in the field", () => {
    let site: string;
    let elsewhere: string;
    let typeA: string;
    let typeB: string;
    let devices: string[];
    let first: string;
    let questions: { id: string; item_type: string; required: boolean }[];

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").limit(1).single();
      typeA = type!.id;
      const { data: bobType } = await bob.client
        .from("device_types")
        .select("id")
        .limit(1)
        .single();
      typeB = bobType!.id;
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Field customer" })
        .select("id")
        .single();
      const { data: sites } = await alice.client
        .from("sites")
        .insert([
          { organization_id: orgA, customer_id: customer!.id, name: "Field site" },
          { organization_id: orgA, customer_id: customer!.id, name: "Field elsewhere" },
        ])
        .select("id, name");
      site = sites!.find((s) => s.name === "Field site")!.id;
      const other = sites!.find((s) => s.name === "Field elsewhere")!.id;
      const { data: location } = await alice.client
        .from("locations")
        .insert({ organization_id: orgA, site_id: other, name: "Jinde" })
        .select("id")
        .single();
      elsewhere = location!.id;
      const { data: rows } = await alice.client
        .from("devices")
        .insert([1, 2].map(() => ({ organization_id: orgA, site_id: site, device_type_id: typeA })))
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: template } = await alice.client
        .from("checklist_templates")
        .select("id, checklist_template_items(id, item_type, required, sort_order)")
        .eq("device_type_id", typeA)
        .eq("active", true)
        .single();
      questions = [...template!.checklist_template_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    });

    async function open(client: Client, inspection: string, device: string) {
      const { data, error } = await client.rpc("open_device_check", {
        p_inspection: inspection,
        p_device: device,
      });
      expect(error).toBeNull();
      return (data as { item: string }).item;
    }

    async function answerAll(client: Client, item: string, pass: boolean) {
      for (const question of questions.filter((q) => q.required)) {
        const { error } = await client.rpc("save_answer", {
          p_item: item,
          p_template_item: question.id,
          p_value_pass: question.item_type === "pass_fail" ? pass : null,
          p_value_number: question.item_type === "number" ? 12.5 : null,
          p_value_text: question.item_type === "text" ? "OK" : null,
          p_defect_severity:
            question.item_type === "pass_fail" && !pass ? ("critical" as const) : null,
        });
        expect(error).toBeNull();
      }
    }

    it("a device left out counts as handled, with its reason and note", async () => {
      const { data } = await carol.client.rpc("start_inspection", { p_site: site });
      first = data!;
      const item = await open(carol.client, first, devices[0]!);
      // Answered "no" first: leaving it out must not record that as a defect.
      await answerAll(carol.client, item, false);
      const { error: bobError } = await bob.client.rpc("skip_device_check", {
        p_item: item,
        p_reason: "inaccessible",
      });
      expect(bobError?.message).toMatch(/not_found/);
      const { error: notHeld } = await alice.client.rpc("skip_device_check", {
        p_item: item,
        p_reason: "inaccessible",
      });
      expect(notHeld?.message).toMatch(/check_taken_over/);
      const { error } = await carol.client.rpc("skip_device_check", {
        p_item: item,
        p_reason: "inaccessible",
        p_note: "Byt zamčený",
      });
      expect(error).toBeNull();
      const { data: row } = await alice.client
        .from("inspection_items")
        .select("outcome, skip_reason, notes, checked_by, editing_by")
        .eq("id", item)
        .single();
      expect(row).toEqual({
        outcome: "not_checked",
        skip_reason: "inaccessible",
        notes: "Byt zamčený",
        checked_by: carol.id,
        editing_by: null,
      });
    });

    it("answering a left-out device again reopens it without the reason", async () => {
      const item = await open(carol.client, first, devices[1]!);
      await carol.client.rpc("skip_device_check", { p_item: item, p_reason: "missing" });
      await open(carol.client, first, devices[1]!);
      await answerAll(carol.client, item, true);
      const { data: reopened } = await alice.client
        .from("inspection_items")
        .select("outcome, skip_reason")
        .eq("id", item)
        .single();
      expect(reopened).toEqual({ outcome: null, skip_reason: null });
      const { data: outcome } = await carol.client.rpc("finish_device_check", { p_item: item });
      expect(outcome).toBe("passed");
    });

    it("completing records no defect and no new date for a device left out", async () => {
      const { data, error } = await carol.client.rpc("complete_inspection", {
        p_inspection: first,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ passed: 1, failed: 0, notChecked: 1, skipped: 1, defects: 0 });
      const { data: left } = await alice.client
        .from("devices")
        .select("last_inspection_on")
        .eq("id", devices[0]!)
        .single();
      expect(left?.last_inspection_on).toBeNull();
      const { data: defects } = await alice.client
        .from("defects")
        .select("id")
        .eq("device_id", devices[0]!);
      expect(defects).toEqual([]);
      const { error: closed } = await alice.client.rpc("cancel_inspection", {
        p_inspection: first,
      });
      expect(closed?.message).toMatch(/inspection_closed/);
    });

    it("a technician adds a device found during the inspection; others can't", async () => {
      const { data: inspection } = await carol.client.rpc("start_inspection", { p_site: site });
      const { data: added, error } = await carol.client.rpc("add_inspection_device", {
        p_inspection: inspection!,
        p_device_type: typeA,
        p_serial_number: "FIELD-1",
        p_attributes: { agent: "CO2" },
      });
      expect(error).toBeNull();
      const { data: device } = await alice.client
        .from("devices")
        .select("site_id, label_number, added_in_inspection, created_by, serial_number, attributes")
        .eq("id", added!)
        .single();
      expect(device).toMatchObject({
        site_id: site,
        added_in_inspection: inspection,
        created_by: carol.id,
        serial_number: "FIELD-1",
        attributes: { agent: "CO2" },
      });
      expect(device!.label_number).toBeGreaterThan(0);

      const attempt = (client: Client, extra: Record<string, unknown>) =>
        client.rpc("add_inspection_device", {
          p_inspection: inspection!,
          p_device_type: typeA,
          ...extra,
        } as never);
      expect((await attempt(carol.client, { p_serial_number: "field-1" })).error?.message).toMatch(
        /device_exists/,
      );
      expect((await attempt(carol.client, { p_location: elsewhere })).error?.message).toMatch(
        /not_found/,
      );
      expect((await attempt(carol.client, { p_device_type: typeB })).error?.message).toMatch(
        /not_found/,
      );
      expect((await attempt(bob.client, {})).error?.message).toMatch(/not_found/);

      // Whoever started it may cancel it; the device found in it stays and the
      // photos of its checks come back for the server to delete.
      const item = await open(carol.client, inspection!, added!);
      const photo = `${orgA}/inspections/${inspection}/${item}/cancelled.jpg`;
      await admin.from("inspection_photos").insert({
        organization_id: orgA,
        item_id: item,
        storage_path: photo,
        content_type: "image/jpeg",
        size_bytes: 1000,
      } as never);
      const { data: paths, error: cancelError } = await carol.client.rpc("cancel_inspection", {
        p_inspection: inspection!,
      });
      expect(cancelError).toBeNull();
      expect(paths).toEqual([{ path: photo }]);
      const { data: kept } = await alice.client
        .from("devices")
        .select("added_in_inspection, deleted_at")
        .eq("id", added!)
        .single();
      expect(kept).toEqual({ added_in_inspection: null, deleted_at: null });
      const { data: gone } = await admin.from("inspections").select("id").eq("id", inspection!);
      expect(gone).toEqual([]);
    });

    it("only whoever started an inspection, or an owner or admin, cancels it", async () => {
      const { data: inspection } = await alice.client.rpc("start_inspection", { p_site: site });
      const { error: technician } = await carol.client.rpc("cancel_inspection", {
        p_inspection: inspection!,
      });
      expect(technician?.message).toMatch(/forbidden/);
      const { error: other } = await bob.client.rpc("cancel_inspection", {
        p_inspection: inspection!,
      });
      expect(other?.message).toMatch(/not_found/);
      const { error } = await alice.client.rpc("cancel_inspection", { p_inspection: inspection! });
      expect(error).toBeNull();
    });
  });

  describe("inspections without a signal", () => {
    let site: string;
    let inspection: string;
    let startedAt: string;
    let typeA: string;
    let templateA: string;
    let devices: string[];
    let questions: { id: string; item_type: string; required: boolean }[];
    let aliceName: string;

    beforeAll(async () => {
      const { data: type } = await alice.client.from("device_types").select("id").limit(1).single();
      typeA = type!.id;
      const { data: customer } = await alice.client
        .from("customers")
        .insert({ organization_id: orgA, name: "Offline customer" })
        .select("id")
        .single();
      const { data: siteRow } = await alice.client
        .from("sites")
        .insert({ organization_id: orgA, customer_id: customer!.id, name: "Offline site" })
        .select("id")
        .single();
      site = siteRow!.id;
      const { data: rows } = await alice.client
        .from("devices")
        .insert(
          [1, 2, 3, 4, 5].map(() => ({
            organization_id: orgA,
            site_id: site,
            device_type_id: typeA,
          })),
        )
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: template } = await alice.client
        .from("checklist_templates")
        .select("id, checklist_template_items(id, item_type, required, sort_order)")
        .eq("device_type_id", typeA)
        .eq("active", true)
        .single();
      templateA = template!.id;
      questions = [...template!.checklist_template_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      const { data: started } = await carol.client.rpc("start_inspection", { p_site: site });
      inspection = started!;
      const { data: row } = await admin
        .from("inspections")
        .select("started_at")
        .eq("id", inspection)
        .single();
      startedAt = row!.started_at;
      const { data: member } = await admin
        .from("memberships")
        .select("display_name")
        .eq("user_id", alice.id)
        .eq("organization_id", orgA)
        .single();
      aliceName = member!.display_name;
    });

    /** Every required answer, as the phone sends it. */
    const allAnswers = (pass: boolean) =>
      Object.fromEntries(
        questions
          .filter((q) => q.required)
          .map((q) => [
            q.id,
            {
              pass: q.item_type === "pass_fail" ? pass : null,
              number: q.item_type === "number" ? 12.5 : null,
              text: q.item_type === "text" ? "OK" : null,
              note: null,
              severity: q.item_type === "pass_fail" && !pass ? "minor" : null,
            },
          ]),
      );

    async function claim(client: Client, device: string, extra: Record<string, unknown> = {}) {
      const { data, error } = await client.rpc("claim_device_check", {
        p_inspection: inspection,
        p_device: device,
        ...extra,
      } as never);
      expect(error).toBeNull();
      return data as {
        item: string;
        template?: string;
        heldBy?: string;
        conflict?: { name: string; outcome: string | null; checkedAt: string | null };
      };
    }

    it("a check done without a signal arrives whole, dated when it was done", async () => {
      const { item, template } = await claim(carol.client, devices[0]!, {
        p_template: templateA,
      });
      expect(template).toBe(templateA);
      // Done yesterday, before the inspection started: kept at the start.
      const { data, error } = await carol.client.rpc("submit_device_check", {
        p_item: item,
        p_answers: allAnswers(true),
        p_notes: "Zkontrolováno bez signálu",
        p_set_notes: true,
        p_action: "finish",
        p_checked_at: new Date(Date.parse(startedAt) - 86_400_000).toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ outcome: "passed" });
      const { data: row } = await alice.client
        .from("inspection_items")
        .select("outcome, notes, checked_by, checked_at, editing_by")
        .eq("id", item)
        .single();
      expect(row).toMatchObject({
        outcome: "passed",
        notes: "Zkontrolováno bez signálu",
        checked_by: carol.id,
        editing_by: null,
      });
      expect(Date.parse(row!.checked_at!)).toBe(Date.parse(startedAt));
      const { count } = await admin
        .from("inspection_answers")
        .select("id", { count: "exact", head: true })
        .eq("item_id", item);
      expect(count).toBe(questions.filter((q) => q.required).length);

      // A time in the future (a phone's wrong clock) is kept at now.
      const { item: next } = await claim(carol.client, devices[4]!);
      await carol.client.rpc("submit_device_check", {
        p_item: next,
        p_action: "skip",
        p_skip_reason: "missing",
        p_checked_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const { data: skipped } = await admin
        .from("inspection_items")
        .select("outcome, skip_reason, checked_at")
        .eq("id", next)
        .single();
      expect(skipped).toMatchObject({ outcome: "not_checked", skip_reason: "missing" });
      expect(Date.parse(skipped!.checked_at!)).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it("a colleague's check in the meantime is a conflict the technician decides", async () => {
      const { item } = await claim(alice.client, devices[1]!);
      await alice.client.rpc("submit_device_check", {
        p_item: item,
        p_answers: allAnswers(true),
        p_action: "finish",
      });
      const { data: done } = await admin
        .from("inspection_items")
        .select("checked_at")
        .eq("id", item)
        .single();

      // Carol checked it offline, not knowing: her phone saw no check.
      const conflict = await claim(carol.client, devices[1]!, { p_template: templateA });
      expect(conflict.conflict).toEqual({
        name: aliceName,
        outcome: "passed",
        skipReason: null,
        checkedAt: done!.checked_at,
      });
      // Nothing changed hands.
      const { data: untouched } = await admin
        .from("inspection_items")
        .select("outcome, editing_by")
        .eq("id", item)
        .single();
      expect(untouched).toEqual({ outcome: "passed", editing_by: null });
      // A phone that had seen Alice's check may change it: no conflict.
      const seen = await claim(carol.client, devices[1]!, { p_seen: done!.checked_at });
      expect(seen.conflict).toBeUndefined();

      // Carol keeps hers: it replaces Alice's answers.
      const { item: taken } = await claim(carol.client, devices[1]!, {
        p_template: templateA,
        p_take_over: true,
      });
      const failing = allAnswers(false);
      const { data } = await carol.client.rpc("submit_device_check", {
        p_item: taken,
        p_answers: failing,
        p_action: "finish",
        p_replace: true,
      });
      expect(data).toMatchObject({ outcome: "failed" });
      const { data: answers } = await admin
        .from("inspection_answers")
        .select("answered_by")
        .eq("item_id", taken);
      expect(new Set(answers!.map((a) => a.answered_by))).toEqual(new Set([carol.id]));
      expect(answers).toHaveLength(Object.keys(failing).length);
    });

    it("a colleague filling it in right now is reported, and can be taken over", async () => {
      await claim(alice.client, devices[2]!);
      const held = await claim(carol.client, devices[2]!);
      expect(held.heldBy).toBe(aliceName);
      // Not holding it, Carol can't write to it.
      const { error } = await carol.client.rpc("submit_device_check", {
        p_item: held.item,
        p_action: "save",
      });
      expect(error?.message).toMatch(/check_taken_over/);
      const taken = await claim(carol.client, devices[2]!, { p_take_over: true });
      expect(taken.heldBy).toBeUndefined();
      // Saving keeps it open; p_release lets go of it.
      const { data: saved } = await carol.client.rpc("submit_device_check", {
        p_item: taken.item,
        p_answers: { [questions[0]!.id]: allAnswers(true)[questions[0]!.id] ?? {} },
        p_action: "save",
        p_release: true,
      });
      expect(saved).toEqual({ outcome: null, checkedAt: null });
      const { data: row } = await admin
        .from("inspection_items")
        .select("outcome, editing_by")
        .eq("id", taken.item)
        .single();
      expect(row).toEqual({ outcome: null, editing_by: null });
    });

    it("answers on another checklist version conflict; taking over switches the version", async () => {
      const { data: other } = await admin
        .from("checklist_templates")
        .insert({
          organization_id: orgA,
          device_type_id: typeA,
          version: 900,
          name: "Older version",
          is_sample: false,
          active: false,
        } as never)
        .select("id")
        .single();
      const otherTemplate = (other as { id: string }).id;
      await admin.from("checklist_template_items").insert({
        organization_id: orgA,
        template_id: otherTemplate,
        sort_order: 1,
        label: "Starší otázka",
        item_type: "pass_fail",
        required: true,
        fail_creates_defect: false,
      } as never);
      const { item } = await claim(alice.client, devices[3]!);
      await alice.client.rpc("submit_device_check", {
        p_item: item,
        p_answers: { [questions[0]!.id]: allAnswers(true)[questions[0]!.id] ?? {} },
        p_action: "save",
        p_release: true,
      });
      const conflict = await claim(carol.client, devices[3]!, { p_template: otherTemplate });
      expect(conflict.conflict?.name).toBe(aliceName);
      const taken = await claim(carol.client, devices[3]!, {
        p_template: otherTemplate,
        p_take_over: true,
      });
      expect(taken.template).toBe(otherTemplate);
      const { count } = await admin
        .from("inspection_answers")
        .select("id", { count: "exact", head: true })
        .eq("item_id", item);
      expect(count).toBe(0);
      // A version of another type is refused.
      const { data: types } = await admin
        .from("checklist_templates")
        .select("id, device_type_id")
        .eq("organization_id", orgA)
        .neq("device_type_id", typeA)
        .limit(1);
      if (types?.[0]) {
        const { error } = await carol.client.rpc("claim_device_check", {
          p_inspection: inspection,
          p_device: devices[3]!,
          p_template: types[0].id,
        });
        expect(error?.message).toMatch(/not_found/);
      }
    });

    it("another company can't claim or submit; bad requests are refused", async () => {
      const { error: claimError } = await bob.client.rpc("claim_device_check", {
        p_inspection: inspection,
        p_device: devices[0]!,
      });
      expect(claimError?.message).toMatch(/not_found/);
      const { item } = await claim(carol.client, devices[3]!);
      const { error: submitError } = await bob.client.rpc("submit_device_check", {
        p_item: item,
        p_action: "finish",
      });
      expect(submitError?.message).toMatch(/not_found/);
      const refused = async (args: Record<string, unknown>, pattern: RegExp) => {
        const { error } = await carol.client.rpc("submit_device_check", {
          p_item: item,
          ...args,
        } as never);
        expect(error?.message).toMatch(pattern);
      };
      await refused({ p_action: "delete" }, /invalid_answer/);
      await refused({ p_action: "skip" }, /invalid_answer/);
      await refused({ p_action: "finish" }, /check_incomplete/);
      await refused({ p_answers: [] }, /invalid_answer/);

      // Completed in the office meanwhile (its open checks aside).
      await admin
        .from("inspections")
        .update({ status: "completed", completed_at: new Date().toISOString() } as never)
        .eq("id", inspection);
      const { error: closed } = await carol.client.rpc("claim_device_check", {
        p_inspection: inspection,
        p_device: devices[3]!,
      });
      expect(closed?.message).toMatch(/inspection_closed/);
    });
  });

  describe("location of QR scans (a fresh organization)", () => {
    let pavla: TestUser;
    let tomas: TestUser;
    let rita: TestUser;
    let org: string;
    let site: string;
    let siteWithoutPoint: string;
    let devices: string[];
    let bare: string;
    let inspection: string;
    let bareInspection: string;
    // Prague, Old Town Square.
    const building = { latitude: 50.087465, longitude: 14.421254 };

    async function join(user: TestUser, name: string) {
      const token = generateToken();
      await pavla.client.from("invitations").insert({
        organization_id: org,
        email: user.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: pavla.id,
      });
      const { error } = await user.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: name,
      });
      expect(error).toBeNull();
    }

    async function claim(user: TestUser, insp: string, device: string) {
      const { data, error } = await user.client.rpc("claim_device_check", {
        p_inspection: insp,
        p_device: device,
      });
      expect(error).toBeNull();
      return (data as { item: string }).item;
    }

    async function item(insp: string, device: string) {
      const { data } = await admin
        .from("inspection_items")
        .select("*")
        .eq("inspection_id", insp)
        .eq("device_id", device)
        .single();
      return data!;
    }

    beforeAll(async () => {
      pavla = await createUser("pavla");
      tomas = await createUser("tomas");
      rita = await createUser("rita");
      org = await createOrg(pavla, `RLS scan location ${run}`);
      await join(tomas, "Tomáš");
      await join(rita, "Rita");
      const { data: customer } = await pavla.client
        .from("customers")
        .insert({ organization_id: org, name: "C" })
        .select("id")
        .single();
      const { data: sites } = await pavla.client
        .from("sites")
        .insert([
          { organization_id: org, customer_id: customer!.id, name: "A", ...building },
          { organization_id: org, customer_id: customer!.id, name: "B" },
        ])
        .select("id, name")
        .order("name");
      site = sites![0]!.id;
      siteWithoutPoint = sites![1]!.id;
      const { data: type } = await pavla.client.from("device_types").select("id").single();
      const { data: rows } = await pavla.client
        .from("devices")
        .insert(
          [1, 2, 3, 4, 5, 6].map(() => ({
            organization_id: org,
            site_id: site,
            device_type_id: type!.id,
          })),
        )
        .select("id, label_number")
        .order("label_number");
      devices = rows!.map((row) => row.id);
      const { data: other } = await pavla.client
        .from("devices")
        .insert({ organization_id: org, site_id: siteWithoutPoint, device_type_id: type!.id })
        .select("id")
        .single();
      bare = other!.id;
      const { data: started } = await tomas.client.rpc("start_inspection", { p_site: site });
      inspection = started!;
      const { data: startedBare } = await tomas.client.rpc("start_inspection", {
        p_site: siteWithoutPoint,
      });
      bareInspection = startedBare!;
    });

    it("keeps the same rule as the app (rules, distance, verdict)", async () => {
      const { SCAN_LOCATION_RULES } = await import("@/lib/scan-location");
      const { DISTANCE_CASES, VERDICT_CASES } = await import("./fixtures/scan-location-cases");
      const { data: rules } = await tomas.client.rpc("scan_location_rules");
      expect(rules).toEqual(SCAN_LOCATION_RULES);
      for (const [latA, lngA, latB, lngB, metres] of DISTANCE_CASES) {
        const { data } = await tomas.client.rpc("scan_location_distance", {
          p_latitude_a: latA,
          p_longitude_a: lngA,
          p_latitude_b: latB,
          p_longitude_b: lngB,
        });
        expect(Math.round(data!)).toBe(metres);
      }
      for (const [distance, accuracy, radius, state] of VERDICT_CASES) {
        const { data } = await tomas.client.rpc("scan_location_verdict", {
          p_distance_m: distance,
          p_accuracy_m: accuracy,
          p_radius_m: radius,
        });
        expect(data).toBe(state);
      }
    });

    it("stores a building's point with who set it, and a default radius", async () => {
      const { data } = await admin
        .from("sites")
        .select(
          "latitude, longitude, location_radius_m, location_source, location_set_by, location_set_at, location",
        )
        .eq("id", site)
        .single();
      expect(data).toMatchObject({
        ...building,
        location_radius_m: 150,
        location_source: "manual",
        location_set_by: pavla.id,
      });
      expect(data!.location_set_at).not.toBeNull();
      expect(data!.location).not.toBeNull();
    });

    it("refuses coordinates out of range, half a point and a radius out of range", async () => {
      for (const patch of [
        { latitude: 91, longitude: 14 },
        { latitude: 50, longitude: -181 },
        { latitude: 50, longitude: null },
        { location_radius_m: 5 },
        { location_radius_m: 6000 },
      ]) {
        const { error } = await pavla.client.from("sites").update(patch).eq("id", siteWithoutPoint);
        expect(error).not.toBeNull();
      }
    });

    it("lets only owners and admins set a building's point; another company can't see it", async () => {
      const { data: updated } = await tomas.client
        .from("sites")
        .update({ latitude: 49, longitude: 16 })
        .eq("id", site)
        .select("id");
      expect(updated ?? []).toEqual([]);
      const { data: seen } = await bob.client.from("sites").select("latitude").eq("id", site);
      expect(seen).toEqual([]);
      await bob.client.from("sites").update({ latitude: 1, longitude: 1 }).eq("id", site);
      const { data: kept } = await admin.from("sites").select("latitude").eq("id", site).single();
      expect(kept!.latitude).toBe(building.latitude);
    });

    it("decides on the server: at the building, far away, imprecise", async () => {
      await claim(tomas, inspection, devices[0]!);
      const { data: near, error } = await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[0]!,
        // About 60 m from the building's point.
        p_latitude: building.latitude + 0.0005,
        p_longitude: building.longitude + 0.0002,
        p_accuracy_m: 12,
        p_captured_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(near).toMatchObject({ state: "matches" });
      const stored = await item(inspection, devices[0]!);
      expect(stored).toMatchObject({ location_state: "matches", scan_accuracy_m: 12 });
      expect(stored.location_distance_m).toBeGreaterThan(40);
      expect(stored.location_distance_m).toBeLessThan(80);

      await claim(tomas, inspection, devices[1]!);
      const { data: far } = await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[1]!,
        // Brno.
        p_latitude: 49.1951,
        p_longitude: 16.6068,
        p_accuracy_m: 8,
      });
      expect(far).toMatchObject({ state: "mismatch" });

      await claim(tomas, inspection, devices[2]!);
      const { data: vague } = await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[2]!,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 350,
      });
      expect(vague).toMatchObject({ state: "unknown" });
    });

    it("records why there is no position; a building without a point stays unknown", async () => {
      await claim(tomas, inspection, devices[3]!);
      const { data } = await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[3]!,
        p_error: "denied",
      });
      expect(data).toMatchObject({ state: "unknown" });
      expect(await item(inspection, devices[3]!)).toMatchObject({
        scan_location_error: "denied",
        scan_latitude: null,
        location_state: "unknown",
      });

      await claim(tomas, bareInspection, bare);
      const { data: noPoint } = await tomas.client.rpc("record_scan_location", {
        p_inspection: bareInspection,
        p_device: bare,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 5,
      });
      expect(noPoint).toMatchObject({ state: "unknown", distanceM: null });
    });

    it("keeps the phone's clock within the inspection, and the latest scan wins", async () => {
      const { data } = await admin
        .from("inspections")
        .select("started_at")
        .eq("id", inspection)
        .single();
      await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[3]!,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 10,
        p_captured_at: "2020-01-01T00:00:00Z",
      });
      const row = await item(inspection, devices[3]!);
      expect(row).toMatchObject({ location_state: "matches", scan_location_error: null });
      expect(Date.parse(row.scan_captured_at!)).toBe(Date.parse(data!.started_at));
    });

    it("refuses a malformed reading, a colleague's check and another company", async () => {
      for (const args of [
        { p_latitude: 50, p_longitude: null, p_accuracy_m: 5 },
        { p_latitude: 95, p_longitude: 14, p_accuracy_m: 5 },
        { p_latitude: 50, p_longitude: 14, p_accuracy_m: -1 },
        {},
      ]) {
        const { error } = await tomas.client.rpc("record_scan_location", {
          p_inspection: inspection,
          p_device: devices[0]!,
          ...args,
        } as never);
        expect(error?.message).toContain("invalid_location");
      }
      // Tomáš holds the check of device 5: Rita can't add a position to it.
      await claim(tomas, inspection, devices[4]!);
      const { error: taken } = await rita.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[4]!,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 5,
      });
      expect(taken?.message).toContain("check_taken_over");
      const { error: foreign } = await bob.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[0]!,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 5,
      });
      expect(foreign?.message).toContain("not_found");
    });

    it("explains a location: any member of the company, not another company", async () => {
      const row = await item(inspection, devices[1]!);
      const { error } = await tomas.client.rpc("explain_scan_location", {
        p_item: row.id,
        p_note: "Sklep, bez signálu GPS",
      });
      expect(error).toBeNull();
      expect(await item(inspection, devices[1]!)).toMatchObject({
        location_note: "Sklep, bez signálu GPS",
        location_note_by: tomas.id,
      });
      const { error: colleague } = await rita.client.rpc("explain_scan_location", {
        p_item: row.id,
        p_note: "Sklep pod schodištěm",
      });
      expect(colleague).toBeNull();
      const { error: manager } = await pavla.client.rpc("explain_scan_location", {
        p_item: row.id,
        p_note: "  ",
      });
      expect(manager).toBeNull();
      expect(await item(inspection, devices[1]!)).toMatchObject({
        location_note: null,
        location_note_by: null,
      });
      const { error: tooLong } = await tomas.client.rpc("explain_scan_location", {
        p_item: row.id,
        p_note: "x".repeat(501),
      });
      expect(tooLong?.message).toContain("invalid_location");
      const { error: foreign } = await bob.client.rpc("explain_scan_location", {
        p_item: row.id,
        p_note: "x",
      });
      expect(foreign?.message).toContain("not_found");
    });

    it("stores nothing when the company switched the feature off", async () => {
      const { error } = await pavla.client
        .from("organizations")
        .update({ scan_location_enabled: false })
        .eq("id", org);
      expect(error).toBeNull();
      await claim(tomas, inspection, devices[5]!);
      const { data } = await tomas.client.rpc("record_scan_location", {
        p_inspection: inspection,
        p_device: devices[5]!,
        p_latitude: building.latitude,
        p_longitude: building.longitude,
        p_accuracy_m: 5,
      });
      expect(data).toEqual({ state: null, distanceM: null });
      expect(await item(inspection, devices[5]!)).toMatchObject({
        scan_latitude: null,
        location_state: null,
      });
      await pavla.client.from("organizations").update({ scan_location_enabled: true }).eq("id", org);
    });

    it("refuses a reading once the inspection is closed", async () => {
      const { error: cancelled } = await tomas.client.rpc("cancel_inspection", {
        p_inspection: bareInspection,
      });
      expect(cancelled).toBeNull();
      const { error } = await tomas.client.rpc("record_scan_location", {
        p_inspection: bareInspection,
        p_device: bare,
        p_error: "timeout",
      });
      expect(error?.message).toMatch(/not_found|inspection_closed/);
    });
  });

  describe("map of buildings (a fresh organization)", () => {
    let hana: TestUser;
    let karel: TestUser;
    let org: string;
    let customerX: string;
    let customerY: string;
    let typeA: string;
    let typeB: string;
    let months: number;
    const sites: Record<string, string> = {};
    const today = () => todayInTimeZone("Europe/Prague");
    const shift = (days: number) => {
      const date = new Date(`${today()}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    /** A device whose next due date is exactly `due` (null: never inspected). */
    async function device(site: string, due: string | null, patch: Record<string, unknown> = {}) {
      const { addMonths } = await import("@/lib/due");
      const { data, error } = await hana.client
        .from("devices")
        .insert({
          organization_id: org,
          site_id: site,
          device_type_id: typeA,
          last_inspection_on: due ? addMonths(due, -months) : null,
          ...patch,
        })
        .select("id, next_due_on")
        .single();
      expect(error).toBeNull();
      expect(data!.next_due_on).toBe(due);
      return data!.id;
    }

    async function statuses(client: Client, args: Record<string, string> = {}) {
      const { data, error } = await client.rpc("site_map_statuses", args);
      expect(error).toBeNull();
      return new Map((data ?? []).map((row) => [row.name, row]));
    }

    beforeAll(async () => {
      hana = await createUser("hana");
      karel = await createUser("karel");
      org = await createOrg(hana, `RLS map ${run}`);
      const token = generateToken();
      await hana.client.from("invitations").insert({
        organization_id: org,
        email: karel.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: hana.id,
      });
      const { error: joined } = await karel.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Karel",
      });
      expect(joined).toBeNull();
      const { data: customers } = await hana.client
        .from("customers")
        .insert([
          { organization_id: org, name: "X" },
          { organization_id: org, name: "Y" },
        ])
        .select("id, name")
        .order("name");
      customerX = customers![0]!.id;
      customerY = customers![1]!.id;
      const names = [
        "overdue",
        "soon30",
        "ok31",
        "empty",
        "critical",
        "resolved",
        "retired",
        "never",
        "major",
      ];
      const { data: rows } = await hana.client
        .from("sites")
        .insert(
          names.map((name, index) => ({
            organization_id: org,
            customer_id: name === "major" ? customerY : customerX,
            name,
            ...(index < 6 ? { latitude: 50 + index / 100, longitude: 14 + index / 100 } : {}),
          })),
        )
        .select("id, name");
      for (const site of rows ?? []) sites[site.name] = site.id;
      const { data: type } = await hana.client
        .from("device_types")
        .select("id, inspection_interval_months")
        .single();
      typeA = type!.id;
      months = type!.inspection_interval_months;
      const { data: other } = await hana.client
        .from("device_types")
        .insert({
          organization_id: org,
          code: `hydrant_${run}`,
          name: "Hydrant",
          inspection_interval_months: 12,
        })
        .select("id")
        .single();
      typeB = other!.id;

      await device(sites.overdue!, shift(-1));
      await device(sites.overdue!, shift(200));
      await device(sites.soon30!, shift(30));
      await device(sites.ok31!, shift(31));
      const withCritical = await device(sites.critical!, shift(100));
      await device(sites.resolved!, shift(100));
      await device(sites.retired!, shift(-10), { status: "removed" });
      await device(sites.never!, null);
      const withMajor = await device(sites.major!, shift(100));
      await device(sites.major!, shift(-5), { device_type_id: typeB });
      for (const [deviceId, severity] of [
        [withCritical, "critical"],
        [withMajor, "major"],
      ] as const) {
        const { error } = await hana.client.rpc("create_defect", {
          p_device: deviceId,
          p_description: `Závada ${severity}`,
          p_severity: severity,
        });
        expect(error).toBeNull();
      }
      const resolvedDevice = (
        await hana.client.from("devices").select("id").eq("site_id", sites.resolved!).single()
      ).data!.id;
      const { data: defect } = await hana.client.rpc("create_defect", {
        p_device: resolvedDevice,
        p_description: "Vyřešená",
        p_severity: "critical",
      });
      const { error: resolved } = await hana.client.rpc("change_defect_status", {
        p_defect: defect!,
        p_status: "resolved",
        p_note: "Opraveno",
      });
      expect(resolved).toBeNull();
    });

    it("keeps the same due-date rule as the app", async () => {
      const { DUE_STATE_CASES } = await import("./fixtures/site-map-cases");
      for (const [next, day, soon, state] of DUE_STATE_CASES) {
        const { data } = await hana.client.rpc("due_state", {
          p_next_due: next,
          p_today: day,
          p_soon_days: soon,
        });
        expect(data).toBe(state);
      }
    });

    it("gives each building its state, as the app's rule does", async () => {
      const { siteStatus } = await import("@/lib/site-map");
      const rows = await statuses(hana.client);
      const state = (name: string) => rows.get(name)?.status;
      expect(state("overdue")).toBe("critical");
      // Exactly the company's 30 days away is "soon"; a day later is fine.
      expect(state("soon30")).toBe("warning");
      expect(state("ok31")).toBe("ok");
      expect(state("empty")).toBe("none");
      expect(state("critical")).toBe("critical");
      // A resolved defect doesn't count; a retired device doesn't either.
      expect(state("resolved")).toBe("ok");
      expect(state("retired")).toBe("none");
      expect(state("never")).toBe("warning");
      expect(rows.get("major")).toMatchObject({ status: "critical", defects_major: 1, overdue: 1 });
      for (const row of rows.values()) expect(row.status).toBe(siteStatus(row));
      expect(rows.get("overdue")).toMatchObject({
        devices: 2,
        overdue: 1,
        next_due: shift(-1),
        latitude: 50,
        longitude: 14,
      });
      // Buildings without a point are listed too (for "without a location").
      expect(rows.get("never")).toMatchObject({ latitude: null, longitude: null });
    });

    it("filters by customer, device type and technician", async () => {
      const byCustomer = await statuses(hana.client, { p_customer: customerY });
      expect([...byCustomer.keys()]).toEqual(["major"]);
      // Only the type's devices and their defects count.
      const byType = await statuses(hana.client, { p_device_type: typeB });
      expect([...byType.keys()]).toEqual(["major"]);
      expect(byType.get("major")).toMatchObject({ devices: 1, defects_major: 0, overdue: 1 });
      expect(await statuses(hana.client, { p_technician: karel.id })).toEqual(new Map());
      const { error } = await hana.client.from("inspection_plans").insert({
        organization_id: org,
        site_id: sites.soon30!,
        planned_on: shift(3),
        technician_id: karel.id,
      });
      expect(error).toBeNull();
      expect([...(await statuses(hana.client, { p_technician: karel.id })).keys()]).toEqual([
        "soon30",
      ]);
    });

    it("shows a technician the same map, and another company nothing", async () => {
      expect((await statuses(karel.client)).size).toBe(9);
      expect((await statuses(bob.client)).has("overdue")).toBe(false);
      const foreign = await statuses(bob.client, { p_customer: customerX });
      expect(foreign.size).toBe(0);
    });
  });

  describe("member management", () => {
    async function membershipOf(user: TestUser) {
      const { data } = await admin
        .from("memberships")
        .select("id, role, display_name, email")
        .eq("user_id", user.id)
        .eq("organization_id", orgA)
        .single();
      return data!;
    }

    it("a technician can't change roles or remove anyone", async () => {
      const aliceMembership = await membershipOf(alice);
      const { error: roleError } = await carol.client.rpc("change_member_role", {
        p_membership: aliceMembership.id,
        p_role: "technician",
      });
      expect(roleError).not.toBeNull();
      const { error: removeError } = await carol.client.rpc("remove_member", {
        p_membership: aliceMembership.id,
      });
      expect(removeError).not.toBeNull();
    });

    it("another organization can't touch our members", async () => {
      const carolMembership = await membershipOf(carol);
      const { error } = await bob.client.rpc("change_member_role", {
        p_membership: carolMembership.id,
        p_role: "admin",
      });
      expect(error?.message).toContain("forbidden");
      const { error: removeError } = await bob.client.rpc("remove_member", {
        p_membership: carolMembership.id,
      });
      expect(removeError?.message).toContain("forbidden");
      expect((await membershipOf(carol)).role).toBe("technician");
    });

    it("the owner can promote a technician to admin", async () => {
      const carolMembership = await membershipOf(carol);
      const { error } = await alice.client.rpc("change_member_role", {
        p_membership: carolMembership.id,
        p_role: "admin",
      });
      expect(error).toBeNull();
      expect((await membershipOf(carol)).role).toBe("admin");
    });

    it("an admin can't demote, remove or replace the owner", async () => {
      const aliceMembership = await membershipOf(alice);
      const { error: roleError } = await carol.client.rpc("change_member_role", {
        p_membership: aliceMembership.id,
        p_role: "technician",
      });
      expect(roleError?.message).toContain("owner_protected");
      const { error: removeError } = await carol.client.rpc("remove_member", {
        p_membership: aliceMembership.id,
      });
      expect(removeError?.message).toContain("owner_protected");
      const { error: transferError } = await carol.client.rpc("transfer_ownership", {
        p_membership: (await membershipOf(carol)).id,
      });
      expect(transferError).not.toBeNull();
      const { error: promoteError } = await carol.client.rpc("change_member_role", {
        p_membership: (await membershipOf(carol)).id,
        p_role: "owner",
      });
      expect(promoteError).not.toBeNull();
      expect((await membershipOf(alice)).role).toBe("owner");
    });

    it("members edit only their own name, never their role", async () => {
      await carol.client
        .from("memberships")
        .update({ display_name: "Carol C." })
        .eq("user_id", carol.id);
      expect((await membershipOf(carol)).display_name).toBe("Carol C.");

      await carol.client
        .from("memberships")
        .update({ display_name: "hacked" })
        .eq("user_id", alice.id);
      expect((await membershipOf(alice)).display_name).not.toBe("hacked");

      // Column privileges: role isn't writable through the API at all.
      const { error } = await carol.client
        .from("memberships")
        .update({ role: "owner" } as never)
        .eq("user_id", carol.id);
      expect(error).not.toBeNull();
      expect((await membershipOf(carol)).role).toBe("admin");
    });

    it("a confirmed e-mail change is copied to memberships", async () => {
      const newEmail = `rls-carol-new-${run}@sparxdeck.test`;
      const { error } = await admin.auth.admin.updateUserById(carol.id, {
        email: newEmail,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect((await membershipOf(carol)).email).toBe(newEmail);
    });

    it("ownership can be handed over and back, with exactly one owner", async () => {
      const { error } = await alice.client.rpc("transfer_ownership", {
        p_membership: (await membershipOf(carol)).id,
      });
      expect(error).toBeNull();
      expect((await membershipOf(carol)).role).toBe("owner");
      expect((await membershipOf(alice)).role).toBe("admin");

      const { error: backError } = await carol.client.rpc("transfer_ownership", {
        p_membership: (await membershipOf(alice)).id,
      });
      expect(backError).toBeNull();
      expect((await membershipOf(alice)).role).toBe("owner");
    });

    it("a removed member loses access", async () => {
      const { error } = await alice.client.rpc("remove_member", {
        p_membership: (await membershipOf(carol)).id,
      });
      expect(error).toBeNull();
      const { data } = await carol.client.from("organizations").select("id");
      expect(data).toEqual([]);
    });
  });

  describe("protocol templates (a fresh organization)", () => {
    let olga: TestUser;
    let tomas: TestUser;
    let org: string;
    let customerX: string;
    let customerY: string;
    let typeA: string;
    let typeB: string;
    let defaultTemplate: string;
    let defaultVersion: string;
    const sites: Record<string, string> = {};

    async function device(site: string, type: string) {
      const { data, error } = await olga.client
        .from("devices")
        .insert({ organization_id: org, site_id: site, device_type_id: type })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id;
    }

    /** Inspects every device of the building (left out as inaccessible) and completes it. */
    async function inspect(site: string, devices: string[]) {
      const { data: inspection, error } = await olga.client.rpc("start_inspection", { p_site: site });
      expect(error).toBeNull();
      for (const id of devices) {
        const { data: opened } = await olga.client.rpc("open_device_check", {
          p_inspection: inspection!,
          p_device: id,
        });
        const { error: skipped } = await olga.client.rpc("skip_device_check", {
          p_item: (opened as { item: string }).item,
          p_reason: "inaccessible",
        });
        expect(skipped).toBeNull();
      }
      const { error: completed } = await olga.client.rpc("complete_inspection", { p_inspection: inspection! });
      expect(completed).toBeNull();
      return inspection!;
    }

    async function protocolOf(inspection: string) {
      const { data } = await olga.client
        .from("protocols")
        .select("id, version, template_version_id")
        .eq("inspection_id", inspection)
        .eq("active", true)
        .single();
      return data!;
    }

    /** A published template of the company (owner's own JSON). */
    async function publishedTemplate(name: string) {
      const { data, error } = await olga.client
        .from("protocol_templates")
        .insert({ organization_id: org, name })
        .select("id")
        .single();
      expect(error).toBeNull();
      const { DEFAULT_PROTOCOL_TEMPLATE } = await import("@/lib/protocol-template/default-template");
      const { error: published } = await olga.client.rpc("publish_protocol_template", {
        p_template: data!.id,
        p_content: { ...DEFAULT_PROTOCOL_TEMPLATE, style: { font: "noto-sans", size: 9 } } as unknown as Json,
        p_note: `První verze ${name}`,
      });
      expect(published).toBeNull();
      const { data: row } = await olga.client
        .from("protocol_templates")
        .select("current_version_id")
        .eq("id", data!.id)
        .single();
      return { template: data!.id, version: row!.current_version_id! };
    }

    beforeAll(async () => {
      olga = await createUser("template-owner");
      tomas = await createUser("template-tech");
      org = await createOrg(olga, `RLS templates ${run}`);
      const token = generateToken();
      await olga.client.from("invitations").insert({
        organization_id: org,
        email: tomas.email,
        role: "technician",
        token_hash: hashToken(token),
        invited_by: olga.id,
      });
      const { error: joined } = await tomas.client.rpc("accept_invitation", {
        p_token: token,
        p_display_name: "Tomáš",
      });
      expect(joined).toBeNull();
      const { data: customers } = await olga.client
        .from("customers")
        .insert([
          { organization_id: org, name: "Zákazník X" },
          { organization_id: org, name: "Zákazník Y" },
        ])
        .select("id, name");
      customerX = customers!.find((row) => row.name === "Zákazník X")!.id;
      customerY = customers!.find((row) => row.name === "Zákazník Y")!.id;
      const { data: siteRows } = await olga.client
        .from("sites")
        .insert([
          { organization_id: org, customer_id: customerX, name: "X1" },
          { organization_id: org, customer_id: customerY, name: "Y1" },
          { organization_id: org, customer_id: customerY, name: "Y2" },
        ])
        .select("id, name");
      for (const row of siteRows ?? []) sites[row.name] = row.id;
      const { data: types } = await olga.client
        .from("device_types")
        .select("id")
        .eq("organization_id", org);
      typeA = types![0]!.id;
      const { data: second, error: typeError } = await olga.client
        .from("device_types")
        .insert({ organization_id: org, name: "Hydrant", code: "hydrant", inspection_interval_months: 12 })
        .select("id")
        .single();
      expect(typeError).toBeNull();
      typeB = second!.id;
      const { error: checklist } = await olga.client.rpc("save_checklist_template", {
        p_device_type: typeB,
        p_name: "Hydrant",
        p_items: [{ label: "Tlak vody", type: "pass_fail", required: true, failCreatesDefect: false }],
      });
      expect(checklist).toBeNull();
      const { data: templates } = await olga.client
        .from("protocol_templates")
        .select("id, current_version_id")
        .eq("organization_id", org);
      defaultTemplate = templates![0]!.id;
      defaultVersion = templates![0]!.current_version_id!;
    });

    it("a new company starts with the default template, published and in use", async () => {
      const { DEFAULT_PROTOCOL_TEMPLATE } = await import("@/lib/protocol-template/default-template");
      const { data: templates } = await olga.client
        .from("protocol_templates")
        .select("name, usage, status, is_default, current_version_id")
        .eq("organization_id", org);
      expect(templates).toEqual([
        {
          name: "Výchozí protokol",
          usage: "inspection",
          status: "published",
          is_default: true,
          current_version_id: defaultVersion,
        },
      ]);
      const { data: version } = await olga.client
        .from("protocol_template_versions")
        .select("version, content, note")
        .eq("id", defaultVersion)
        .single();
      // The database's copy of the default is the app's (default_protocol_template()).
      expect(version).toEqual({ version: 1, content: DEFAULT_PROTOCOL_TEMPLATE, note: "Výchozí vzhled" });
      const { data: events } = await olga.client
        .from("protocol_template_events")
        .select("kind, version")
        .eq("template_id", defaultTemplate)
        .order("kind");
      expect(events).toEqual([
        { kind: "created", version: null },
        { kind: "published", version: 1 },
      ]);
    });

    it("another company sees none of it and can change none of it", async () => {
      for (const table of [
        "protocol_templates",
        "protocol_template_versions",
        "protocol_template_events",
        "protocol_template_assignments",
      ] as const) {
        const { data } = await bob.client.from(table).select("id").eq("organization_id", org);
        expect(data, table).toEqual([]);
      }
      const { error: inserted } = await bob.client
        .from("protocol_templates")
        .insert({ organization_id: org, name: "Cizí" });
      expect(inserted).not.toBeNull();
      await bob.client.from("protocol_templates").update({ name: "Přejmenováno" }).eq("id", defaultTemplate);
      const { data: kept } = await admin.from("protocol_templates").select("name").eq("id", defaultTemplate).single();
      expect(kept!.name).toBe("Výchozí protokol");
      const { error: published } = await bob.client.rpc("publish_protocol_template", {
        p_template: defaultTemplate,
        p_content: { schema: 1 },
        p_note: "Cizí verze",
      });
      expect(published?.message).toMatch(/not_found/);
      const { error: assigned } = await bob.client.from("protocol_template_assignments").insert({
        organization_id: org,
        template_id: defaultTemplate,
        customer_id: customerX,
      });
      expect(assigned).not.toBeNull();
      // Nor through its own company: the template and the customer must be of one company.
      const { data: bobTemplates } = await bob.client.from("protocol_templates").select("id").limit(1);
      const { error: crossed } = await bob.client.from("protocol_template_assignments").insert({
        organization_id: orgB,
        template_id: bobTemplates![0]!.id,
        customer_id: customerX,
      });
      expect(crossed).not.toBeNull();
    });

    it("a technician uses templates but doesn't change them", async () => {
      const { data } = await tomas.client.from("protocol_templates").select("id").eq("organization_id", org);
      expect(data?.length).toBe(1);
      const { error: inserted } = await tomas.client
        .from("protocol_templates")
        .insert({ organization_id: org, name: "Technikova" });
      expect(inserted).not.toBeNull();
      await tomas.client.from("protocol_templates").update({ draft: { schema: 1 } }).eq("id", defaultTemplate);
      const { data: row } = await admin.from("protocol_templates").select("draft").eq("id", defaultTemplate).single();
      expect(row!.draft).toBeNull();
      const { error: published } = await tomas.client.rpc("publish_protocol_template", {
        p_template: defaultTemplate,
        p_content: { schema: 1 },
        p_note: "Technik",
      });
      expect(published?.message).toMatch(/not_found/);
      const { error: assigned } = await tomas.client.from("protocol_template_assignments").insert({
        organization_id: org,
        template_id: defaultTemplate,
        customer_id: customerX,
      });
      expect(assigned).not.toBeNull();
    });

    it("the owner saves a draft (stamped), but status and version change only by publishing", async () => {
      const { error } = await olga.client
        .from("protocol_templates")
        .update({ draft: { schema: 1, note: "rozpracováno" } })
        .eq("id", defaultTemplate);
      expect(error).toBeNull();
      const { data: row } = await olga.client
        .from("protocol_templates")
        .select("draft_updated_by, draft_updated_at")
        .eq("id", defaultTemplate)
        .single();
      expect(row!.draft_updated_by).toBe(olga.id);
      expect(row!.draft_updated_at).not.toBeNull();
      for (const patch of [{ status: "archived" }, { is_default: false }, { current_version_id: null }]) {
        const { error: refused } = await olga.client
          .from("protocol_templates")
          .update(patch as never)
          .eq("id", defaultTemplate);
        expect(refused, JSON.stringify(patch)).not.toBeNull();
      }
      const { error: notJson } = await olga.client
        .from("protocol_templates")
        .update({ draft: ["seznam"] as unknown as Json })
        .eq("id", defaultTemplate);
      expect(notJson).not.toBeNull();
    });

    it("publishing needs a note and a template, and makes a new version", async () => {
      const { data: draft } = await olga.client
        .from("protocol_templates")
        .insert({ organization_id: org, name: "Koncept" })
        .select("id, status")
        .single();
      expect(draft!.status).toBe("draft");
      const publish = (content: Json, note: string) =>
        olga.client.rpc("publish_protocol_template", { p_template: draft!.id, p_content: content, p_note: note });
      expect((await publish({ schema: 1 }, "  ")).error?.message).toMatch(/note_required/);
      expect((await publish({ schema: 2 }, "Poznámka")).error?.message).toMatch(/invalid_template/);
      expect((await publish(["x"], "Poznámka")).error?.message).toMatch(/invalid_template/);
      const first = await publish({ schema: 1 }, "První");
      expect(first.data).toBe(1);
      const second = await publish({ schema: 1, page: "A4" }, "Druhá");
      expect(second.data).toBe(2);
      const { data: versions } = await olga.client
        .from("protocol_template_versions")
        .select("version, note, published_by")
        .eq("template_id", draft!.id)
        .order("version");
      expect(versions).toEqual([
        { version: 1, note: "První", published_by: olga.id },
        { version: 2, note: "Druhá", published_by: olga.id },
      ]);
      const { data: template } = await olga.client
        .from("protocol_templates")
        .select("status, draft")
        .eq("id", draft!.id)
        .single();
      expect(template).toEqual({ status: "published", draft: null });
    });

    it("a published version never changes, not even for the service role", async () => {
      const { error } = await admin
        .from("protocol_template_versions")
        .update({ note: "Přepsáno" } as never)
        .eq("id", defaultVersion);
      expect(error?.message).toMatch(/version_immutable/);
      const { error: user } = await olga.client
        .from("protocol_template_versions")
        .delete()
        .eq("id", defaultVersion);
      expect(user?.code).toBe("42501");
      const { data } = await admin.from("protocol_template_versions").select("id").eq("id", defaultVersion);
      expect(data?.length).toBe(1);
    });

    it("a protocol records its template version: customer, then device type, then the default", async () => {
      const x1 = await device(sites.X1!, typeA);
      const y1a = await device(sites.Y1!, typeB);
      const y2a = await device(sites.Y2!, typeA);
      const y2b = await device(sites.Y2!, typeB);

      // Nothing assigned: the company's default.
      const first = await protocolOf(await inspect(sites.X1!, [x1]));
      expect(first.template_version_id).toBe(defaultVersion);

      const forType = await publishedTemplate("Hydranty");
      const forCustomer = await publishedTemplate("Pro zákazníka X");
      const { error: typeAssigned } = await olga.client.from("protocol_template_assignments").insert({
        organization_id: org,
        template_id: forType.template,
        device_type_id: typeB,
      });
      expect(typeAssigned).toBeNull();
      const { error: customerAssigned } = await olga.client.from("protocol_template_assignments").insert({
        organization_id: org,
        template_id: forCustomer.template,
        customer_id: customerX,
      });
      expect(customerAssigned).toBeNull();
      // One template per customer.
      const { error: twice } = await olga.client.from("protocol_template_assignments").insert({
        organization_id: org,
        template_id: forType.template,
        customer_id: customerX,
      });
      expect(twice).not.toBeNull();

      // The customer's template wins.
      expect((await protocolOf(await inspect(sites.X1!, [x1]))).template_version_id).toBe(forCustomer.version);
      // Only hydrants: the hydrants' template.
      expect((await protocolOf(await inspect(sites.Y1!, [y1a]))).template_version_id).toBe(forType.version);
      // Mixed device types: the default.
      expect((await protocolOf(await inspect(sites.Y2!, [y2a, y2b]))).template_version_id).toBe(defaultVersion);
    });

    it("a correction keeps the template version of the protocol it replaces", async () => {
      const x1 = await device(sites.X1!, typeA);
      // X1 has the customer's template; drop it so the default applies.
      await olga.client.from("protocol_template_assignments").delete().eq("customer_id", customerX);
      const inspection = await inspect(sites.X1!, [x1]);
      const original = await protocolOf(inspection);
      expect(original.template_version_id).toBe(defaultVersion);

      // The default gets a new version; the reissue still uses the original one.
      const { DEFAULT_PROTOCOL_TEMPLATE } = await import("@/lib/protocol-template/default-template");
      const { data: newVersion } = await olga.client.rpc("publish_protocol_template", {
        p_template: defaultTemplate,
        p_content: DEFAULT_PROTOCOL_TEMPLATE as unknown as Json,
        p_note: "Druhá verze výchozího",
      });
      expect(newVersion).toBe(2);
      const { error: reopened } = await olga.client.rpc("reopen_inspection", {
        p_inspection: inspection,
        p_reason: "Oprava údajů",
      });
      expect(reopened).toBeNull();
      const { error: completed } = await olga.client.rpc("complete_inspection", { p_inspection: inspection });
      expect(completed).toBeNull();
      const reissued = await protocolOf(inspection);
      expect(reissued.version).toBe(2);
      expect(reissued.template_version_id).toBe(defaultVersion);

      // A new inspection gets the new version.
      const fresh = await protocolOf(await inspect(sites.X1!, [x1]));
      expect(fresh.template_version_id).not.toBe(defaultVersion);
    });

    it("protocols' template version and snapshot are not the client's to write", async () => {
      const { data: protocol } = await olga.client.from("protocols").select("id").limit(1).single();
      await olga.client
        .from("protocols")
        .update({ snapshot: { forged: true } } as never)
        .eq("id", protocol!.id);
      const { data } = await admin.from("protocols").select("snapshot").eq("id", protocol!.id).single();
      expect(data!.snapshot).toBeNull();
    });
  });
});

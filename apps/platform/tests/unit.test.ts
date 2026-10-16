import { describe, expect, it } from "vitest";
import cs from "../messages/cs.json";
import en from "../messages/en.json";
import { matchesPath, PUBLIC_PATHS } from "@/lib/routes";
import { safeNextPath } from "@/lib/safe-next";
import { generateToken, hashToken } from "@/lib/tokens";
import {
  inviteSchema,
  onboardingSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation";

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/team")).toBe("/team");
    expect(safeNextPath("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it("rejects anything that could leave the app", () => {
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "evil",
      "/a\nb",
      "",
    ]) {
      expect(safeNextPath(bad, "/fallback")).toBe("/fallback");
    }
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("matchesPath", () => {
  it("treats sub-paths of public paths as public, but not look-alikes", () => {
    expect(matchesPath("/invite/token", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/auth/callback", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/login", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/loginx", PUBLIC_PATHS)).toBe(false);
    expect(matchesPath("/team", PUBLIC_PATHS)).toBe(false);
    expect(matchesPath("/", PUBLIC_PATHS)).toBe(false);
  });
});

describe("tokens", () => {
  it("are long, URL-safe and unique", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });

  it("hash to the same hex digest Postgres computes with digest(token, 'sha256')", () => {
    // encode(digest('abc', 'sha256'), 'hex')
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("validation", () => {
  it("normalizes e-mails and enforces password length", () => {
    expect(signupSchema.parse({ email: "  Jan@Example.COM ", password: "12345678" }).email).toBe(
      "jan@example.com",
    );
    expect(signupSchema.safeParse({ email: "jan@example.com", password: "short" }).success).toBe(
      false,
    );
  });

  it("requires matching passwords on reset", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("passwordMismatch");
  });

  it("never allows inviting someone as owner", () => {
    expect(inviteSchema.safeParse({ email: "a@b.cz", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.cz", role: "technician" }).success).toBe(true);
  });

  it("trims organization names and rejects blanks", () => {
    expect(
      onboardingSchema.safeParse({ organizationName: "   ", displayName: "Jan" }).success,
    ).toBe(false);
  });
});

describe("translations", () => {
  // Every key in Czech (the source) must exist in English, and vice versa.
  function keys(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      keys(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it("have the same keys in every language", () => {
    expect(keys(en).sort()).toEqual(keys(cs).sort());
  });
});

describe("password policy", async () => {
  const { passwordPolicyError } = await import("@/lib/password");

  it("rejects common passwords regardless of case", () => {
    expect(passwordPolicyError("password123")).toBe("passwordTooCommon");
    expect(passwordPolicyError("Qwertyuiop")).toBe("passwordTooCommon");
    expect(passwordPolicyError("heslo123")).toBe("passwordTooCommon");
  });

  it("rejects repeated characters and plain sequences", () => {
    expect(passwordPolicyError("aaaaaaaaaa")).toBe("passwordTooCommon");
    expect(passwordPolicyError("23456789")).toBe("passwordTooCommon");
    expect(passwordPolicyError("abcdefghij")).toBe("passwordTooCommon");
  });

  it("rejects passwords containing the e-mail name", () => {
    expect(passwordPolicyError("novak-2026!", "jan.novak@firma.cz")).toBeNull();
    expect(passwordPolicyError("jan.novak2026", "jan.novak@firma.cz")).toBe(
      "passwordContainsEmail",
    );
  });

  it("accepts a reasonable password", () => {
    expect(passwordPolicyError("modry-hasicak-42")).toBeNull();
  });
});

describe("organization settings validation", async () => {
  const { companyDetailsSchema, deadlineSettingsSchema, isValidCompanyId } =
    await import("@/lib/validation");

  it("checks the Czech company ID (IČO) check digit", () => {
    expect(isValidCompanyId("27082440")).toBe(true);
    expect(isValidCompanyId("25596641")).toBe(true);
    expect(isValidCompanyId("27082441")).toBe(false);
    expect(isValidCompanyId("1234567")).toBe(true); // other countries: free format
    expect(isValidCompanyId("!!")).toBe(false);
  });

  it("turns empty optional fields into null and normalizes the VAT ID", () => {
    const parsed = companyDetailsSchema.parse({
      name: "  Hasiči s.r.o. ",
      legalName: "",
      companyId: "27082440",
      vatId: "cz 270 824 40",
      address: "",
      email: "",
      phone: "",
    });
    expect(parsed).toEqual({
      name: "Hasiči s.r.o.",
      legalName: null,
      companyId: "27082440",
      vatId: "CZ27082440",
      address: null,
      email: null,
      phone: null,
    });
  });

  it("limits the due-soon threshold to 1–365 days", () => {
    expect(deadlineSettingsSchema.parse({ dueSoonDays: "45" }).dueSoonDays).toBe(45);
    expect(deadlineSettingsSchema.safeParse({ dueSoonDays: 0 }).success).toBe(false);
    expect(deadlineSettingsSchema.safeParse({ dueSoonDays: 400 }).success).toBe(false);
    expect(deadlineSettingsSchema.safeParse({ dueSoonDays: 2.5 }).success).toBe(false);
  });
});

describe("image sniffing", async () => {
  const { sniffImage } = await import("@/lib/storage");
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it("recognizes PNG, JPEG and WebP by their content", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      "image/png",
    );
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.mime).toBe("image/webp");
  });

  it("rejects everything else, including SVG and HTML", () => {
    expect(
      sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>")),
    ).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF
  });
});

describe("list helpers", async () => {
  const { ilikeAny, pageParam } = await import("@/lib/search");
  const { isActive } = await import("@/components/app/nav-items");

  it("builds a quoted, escaped PostgREST filter", () => {
    expect(ilikeAny(["name", "email"], "  Novák ")).toBe(
      'name.ilike."%Novák%",email.ilike."%Novák%"',
    );
    // LIKE escapes (\%) are themselves escaped inside the quoted value (\\%).
    expect(ilikeAny(["name"], "50%_off")).toBe(String.raw`name.ilike."%50\\%\\_off%"`);
    expect(ilikeAny(["name"], 'a"b,c)')).toBe('name.ilike."%a\\"b,c)%"');
    expect(ilikeAny(["name"], "   ")).toBeNull();
    expect(ilikeAny(["name"], "*")).toBeNull();
  });

  it("reads a page number defensively", () => {
    expect(pageParam(undefined)).toBe(1);
    expect(pageParam("3")).toBe(3);
    expect(pageParam(["2", "5"])).toBe(2);
    for (const bad of ["0", "-1", "1.5", "abc", ""]) expect(pageParam(bad)).toBe(1);
  });

  it("highlights Customers on a site's page too", () => {
    const customers = { href: "/customers", also: ["/sites"] };
    expect(isActive("/customers/abc", customers)).toBe(true);
    expect(isActive("/sites/abc/edit", customers)).toBe(true);
    expect(isActive("/sitesx", customers)).toBe(false);
    expect(isActive("/customers", { href: "/" })).toBe(false);
  });
});

describe("connection graph", async () => {
  const g = await import("@/lib/graph");
  const T = "2026-10-11T10:00:00.000Z";
  const data: import("@/lib/graph").GraphData = {
    customers: [
      {
        id: "c2",
        name: "Žižkov SVJ",
        companyId: null,
        vatId: null,
        contactPerson: null,
        email: null,
        phone: null,
        billingAddress: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
      {
        id: "c1",
        name: "Bytové družstvo Lipová",
        companyId: "27082440",
        vatId: null,
        contactPerson: "Jana",
        email: null,
        phone: null,
        billingAddress: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
    ],
    sites: [
      {
        id: "s2",
        customerId: "c1",
        name: "Lipová 14",
        address: null,
        accessNotes: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
      {
        id: "s1",
        customerId: "c1",
        name: "Lipová 12",
        address: "Praha 2",
        accessNotes: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
      {
        id: "s3",
        customerId: "c2",
        name: "Seifertova 5",
        address: null,
        accessNotes: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
      {
        id: "orphan",
        customerId: "deleted",
        name: "Ghost",
        address: null,
        accessNotes: null,
        notes: null,
        createdAt: T,
        updatedAt: T,
      },
    ],
    locations: [
      { id: "l2", siteId: "s1", name: "1. patro", sortOrder: 2, createdAt: T, updatedAt: T },
      { id: "l1", siteId: "s1", name: "Suterén", sortOrder: 1, createdAt: T, updatedAt: T },
    ],
    devices: [
      device("d2", "s1", null, 2, { serialNumber: "SN-77", nextDueOn: "2026-10-20" }),
      device("d1", "s1", "l2", 1, { nextDueOn: "2026-10-01" }),
      device("d3", "s2", null, 3, { status: "out_of_service", nextDueOn: "2026-01-01" }),
      // A location of another building: the device hangs on its own building.
      device("d4", "s3", "l1", 4, { nextDueOn: "2027-06-01" }),
      device("d5", "orphan", null, 5, {}),
    ],
    due: { today: "2026-10-12", soonDays: 30 },
  };
  function device(
    id: string,
    siteId: string,
    locationId: string | null,
    labelNumber: number,
    extra: Partial<import("@/lib/graph").GraphData["devices"][number]>,
  ): import("@/lib/graph").GraphData["devices"][number] {
    return {
      id,
      siteId,
      locationId,
      labelNumber,
      typeName: "Hasicí přístroj",
      serialNumber: null,
      status: "active",
      nextDueOn: null,
      lastInspectionOn: null,
      createdAt: T,
      updatedAt: T,
      ...extra,
    };
  }
  const graph = g.buildGraph(data);
  const view = (expanded: string[], hidden: string[] = []) => ({
    e: new Set(expanded),
    h: new Set(hidden),
  });

  it("builds a sorted tree and drops objects without a parent", () => {
    expect(graph.roots).toEqual(["c1", "c2"]);
    expect(graph.nodes.get("c1")!.childIds).toEqual(["s1", "s2"]);
    // Locations in route order, then devices without a location.
    expect(graph.nodes.get("s1")!.childIds).toEqual(["l1", "l2", "d2"]);
    expect(graph.nodes.get("l2")!.childIds).toEqual(["d1"]);
    expect(graph.nodes.get("s3")!.childIds).toEqual(["d4"]);
    expect(graph.nodes.has("orphan")).toBe(false);
    expect(graph.nodes.has("d5")).toBe(false);
    expect(graph.counts).toEqual({ customer: 2, site: 3, location: 2, device: 4 });
    expect(graph.nodes.get("l1")!.rootId).toBe("c1");
    expect(graph.nodes.get("l1")!.href).toBe("/sites/s1");
  });

  it("shows only expanded branches, in display order", () => {
    const { e, h } = view(["c1"]);
    expect(g.visibleIds(graph, e, h)).toEqual(["c1", "s1", "s2", "c2"]);
    const all = view(g.defaultExpanded(graph));
    expect(g.visibleIds(graph, all.e, all.h)).toEqual([
      "c1",
      "s1",
      "l1",
      "l2",
      "d1",
      "d2",
      "s2",
      "d3",
      "c2",
      "s3",
      "d4",
    ]);
    const hidden = view(g.defaultExpanded(graph), ["s1"]);
    expect(g.visibleIds(graph, hidden.e, hidden.h)).toEqual(["c1", "s2", "d3", "c2", "s3", "d4"]);
  });

  it("lays out columns by type without overlapping rows", () => {
    const { e, h } = view(g.defaultExpanded(graph));
    const positions = g.autoLayout(graph, e, h);
    expect(positions.get("c1")!.x).toBe(0);
    expect(positions.get("s1")!.x).toBe(g.columnX("lineage")[1]);
    expect(positions.get("l1")!.x).toBe(g.columnX("lineage")[2]);
    expect(positions.get("d1")!.x).toBe(g.columnX("lineage")[3]);
    // A device without a location sits in the location column.
    expect(positions.get("d2")!.x).toBe(g.columnX("lineage")[2]);
    // Rows in one column never overlap.
    for (const depth of [0, 1, 2, 3]) {
      const column = [...graph.nodes.values()]
        .filter((n) => n.depth === depth)
        .map((n) => ({ y: positions.get(n.id)!.y, h: g.nodeSize(n, "lineage").height }))
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < column.length; i++) {
        expect(column[i]!.y).toBeGreaterThanOrEqual(column[i - 1]!.y + column[i - 1]!.h);
      }
    }
    // A parent is centred on its children.
    const center = (id: string) =>
      positions.get(id)!.y + g.nodeSize(graph.nodes.get(id)!, "lineage").height / 2;
    expect(center("s1")).toBeCloseTo((center("l1") + center("d2")) / 2);
    expect(center("l2")).toBeCloseTo(center("d1"));
  });

  it("keeps moved nodes in place and moves their subtree along", () => {
    const { e, h } = view(g.defaultExpanded(graph));
    const visible = g.visibleIds(graph, e, h);
    const auto = g.autoLayout(graph, e, h);
    const moved = g.resolvePositions(graph, visible, auto, { s1: { x: 1000, y: 1000 } });
    expect(moved.get("s1")).toEqual({ x: 1000, y: 1000 });
    expect(moved.get("l1")!.x - 1000).toBe(auto.get("l1")!.x - auto.get("s1")!.x);
    expect(moved.get("c1")).toEqual(auto.get("c1"));
  });

  it("finds lineage, search matches and reveals hidden paths", () => {
    expect([...g.lineage(graph, ["s1"])].sort()).toEqual(["c1", "d1", "d2", "l1", "l2", "s1"]);
    expect(g.ancestors(graph, "l2")).toEqual(["s1", "c1"]);
    expect(g.searchNodes(graph, "lipova")).toEqual(["c1", "s1", "s2"]);
    expect(g.searchNodes(graph, "27082440")).toEqual(["c1"]);
    expect(g.searchNodes(graph, "praha")).toEqual(["s1"]);
    // Devices by label number, serial number and type.
    expect(g.searchNodes(graph, "0001")).toEqual(["d1"]);
    expect(g.searchNodes(graph, "sn-77")).toEqual(["d2"]);
    expect(g.searchNodes(graph, "hasici")).toEqual(["d1", "d2", "d3", "d4"]);
    const start = { expanded: [], hidden: ["c1"], positions: {} };
    const revealed = g.reveal(graph, start, "l1");
    expect(revealed.hidden).toEqual([]);
    expect(new Set(revealed.expanded)).toEqual(new Set(["c1", "s1"]));
    expect(g.reveal(graph, revealed, "l1")).toBe(revealed);
  });

  it("sanitises a saved view against current data", () => {
    expect(g.sanitizeView(graph, null)).toBeNull();
    expect(
      g.sanitizeView(graph, {
        expanded: ["c1", "gone"],
        hidden: ["s9"],
        positions: { s1: { x: 1, y: 2 }, gone: { x: 0, y: 0 }, s2: { x: Number.NaN, y: 0 } },
      }),
    ).toEqual({ expanded: ["c1"], hidden: [], positions: { s1: { x: 1, y: 2 } } });
  });

  it("sizes nodes for both styles and keeps columns apart", () => {
    const short = g.nodeSize({ kind: "site", label: "A" }, "lineage");
    const long = g.nodeSize({ kind: "site", label: "x".repeat(200) }, "lineage");
    expect(short.height).toBe(20);
    expect(short.width).toBe(110);
    expect(long.width).toBe(250);
    expect(g.nodeSize({ kind: "customer", label: "Lipová" }, "lineage").height).toBe(36);
    expect(g.nodeSize({ kind: "location", label: "Suterén" }, "cards")).toEqual({
      width: 224,
      height: 62,
    });
    for (const style of ["lineage", "cards"] as const) {
      const xs = g.columnX(style);
      expect(xs[0]).toBe(0);
      // The widest node of a column never reaches the next column.
      expect(xs[1]!).toBeGreaterThan(260);
      expect(xs[2]! - xs[1]!).toBeGreaterThan(250 - 1);
    }
    const { e, h } = view(g.defaultExpanded(graph));
    const cards = g.autoLayout(graph, e, h, "cards");
    expect(cards.get("l2")!.y - cards.get("l1")!.y).toBeGreaterThanOrEqual(62);
  });

  it("carries subtitles and dates for lists and details", () => {
    expect(graph.nodes.get("c1")!.subtitle).toBe("Jana");
    expect(graph.nodes.get("s1")!.subtitle).toBe("Praha 2");
    expect(graph.nodes.get("l1")!.subtitle).toBeNull();
    expect(graph.nodes.get("l1")!.createdAt).toBe(T);
  });

  it("applies colour overrides per mode and picks readable text", () => {
    expect(g.nodeColor(graph, "s1", "type", { "type:site": "#d99e0b" })).toBe("#d99e0b");
    expect(g.nodeColor(graph, "s1", "customer", { "type:site": "#d99e0b" })).toBe(
      g.CUSTOMER_PALETTE[0],
    );
    expect(g.nodeColor(graph, "l1", "customer", { "customer:c1": "#182026" })).toBe("#182026");
    expect(g.readableText("#ffc940")).toBe("#182026");
    expect(g.readableText("#137cbd")).toBe("#ffffff");
    expect(g.readableText("var(--node-site)")).toBe("#ffffff");
  });

  it("colours by type or by customer", () => {
    expect(g.nodeColor(graph, "s1", "type")).toBe("var(--node-site)");
    expect(g.nodeColor(graph, "d1", "type")).toBe("var(--node-device)");
    expect(g.nodeColor(graph, "l1", "customer")).toBe(g.CUSTOMER_PALETTE[0]);
    expect(g.nodeColor(graph, "s3", "customer")).toBe(g.CUSTOMER_PALETTE[1]);
  });

  it("gives devices their due state and rolls the most urgent one up", () => {
    const due = (id: string) => graph.nodes.get(id)!.due;
    expect([due("d1"), due("d2"), due("d3"), due("d4")]).toEqual(["overdue", "soon", null, "ok"]);
    // An inactive device doesn't count; a building with only that has no state.
    expect(due("s2")).toBeNull();
    expect([due("l2"), due("s1"), due("c1")]).toEqual(["overdue", "overdue", "overdue"]);
    expect([due("s3"), due("c2"), due("l1")]).toEqual(["ok", "ok", null]);
    expect(g.colorGroup(graph, "s2", "due")).toBe("none");
    expect(g.nodeColor(graph, "s1", "due")).toBe(g.DUE_COLOR.overdue);
    expect(g.nodeColor(graph, "d2", "due")).toBe(g.DUE_COLOR.soon);
    expect(g.nodeColor(graph, "d2", "due", { "due:soon": "#d99e0b" })).toBe("#d99e0b");
  });

  it("describes devices for the inspector and links them to their page", () => {
    const node = graph.nodes.get("d2")!;
    expect(node.label).toBe("Hasicí přístroj 0002");
    expect(node.href).toBe("/devices/d2");
    expect(node.subtitle).toBe("SN-77");
    expect(node.fields).toContainEqual({ key: "label", value: "0002", format: "mono" });
    expect(node.fields).toContainEqual({ key: "nextDue", value: "2026-10-20", format: "date" });
    // An inactive device has no next due date to show.
    expect(graph.nodes.get("d3")!.fields).toContainEqual({
      key: "nextDue",
      value: null,
      format: "date",
    });
  });
});

describe("class merging", async () => {
  const { cn } = await import("@/lib/utils");
  it("keeps workspace text sizes next to text colours", () => {
    expect(cn("text-ui-xs text-muted-foreground")).toBe("text-ui-xs text-muted-foreground");
    expect(cn("text-ui", "text-sm")).toBe("text-sm");
  });
});

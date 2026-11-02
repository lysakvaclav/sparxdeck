import "server-only";
import { defectNumber } from "@/lib/defects";
import { formatLabel } from "@/lib/devices";
import type { DefectSeverity, MemberRole } from "@/lib/supabase/database.types";
import type { Tx } from "./db";
import type { Org } from "./read";
import { ToolError } from "./output";

// What MCP tools may change (part 31), always in two steps: a preview of the
// change, then (with the user's confirmation) the change itself through the
// same database functions and policies as the app. Nothing is deleted and no
// protocol is issued from here.

export type Change = { field: string; from: unknown; to: unknown };
export type Preview = { summary: string; target: Record<string, unknown>; changes: Change[] };

const MANAGERS: readonly MemberRole[] = ["owner", "admin"];

function requireManager(role: MemberRole, what: string) {
  if (!MANAGERS.includes(role))
    throw new ToolError("forbidden", `Only an owner or administrator can ${what}, as in the app.`);
}

/** Database errors as tool errors the assistant can explain. */
export function databaseError(error: unknown): ToolError {
  if (error instanceof ToolError) return error;
  const pg = error as { code?: string; message?: string };
  const message = pg.message ?? "The change failed.";
  if (pg.code === "42501") return new ToolError("forbidden", "Your role does not allow this change.");
  if (pg.code === "P0002" || /not_found/.test(message)) return new ToolError("not_found", "The record was not found.");
  if (pg.code === "23514" || pg.code === "22001") return new ToolError("invalid_input", "A value is too long or not allowed.");
  if (/plan_in_route/.test(message))
    return new ToolError("conflict", "The visit is part of a route; change it in the route instead.");
  return new ToolError("failed", message.slice(0, 200));
}

async function memberName(tx: Tx, org: Org, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const [row] = await tx<{ display_name: string }[]>`
    select display_name from public.memberships where organization_id = ${org.id} and user_id = ${userId}`;
  if (!row) throw new ToolError("invalid_input", "That person is not a member of this company. Use list_members.");
  return row.display_name;
}

type DefectRow = {
  id: string;
  number: number;
  description: string;
  severity: DefectSeverity;
  status: string;
  due_on: string | null;
  assigned_to: string | null;
  device_label: number;
  site_name: string;
};

async function loadDefect(tx: Tx, org: Org, defectId: string): Promise<DefectRow> {
  const [row] = await tx<DefectRow[]>`
    select f.id, f.number, f.description, f.severity::text as severity, f.status::text as status,
           f.due_on::text as due_on, f.assigned_to, d.label_number as device_label, s.name as site_name
      from public.defects f
      join public.devices d on d.id = f.device_id
      join public.sites s on s.id = d.site_id
     where f.id = ${defectId} and f.organization_id = ${org.id}`;
  if (!row) throw new ToolError("not_found", "No such defect in this company.");
  return row;
}

const defectTarget = (row: DefectRow) => ({
  defect: `D-${defectNumber(row.number)}`,
  device: formatLabel(row.device_label),
  site: row.site_name,
});

// ---------- create_defect ----------

export type CreateDefect = {
  device_id: string;
  description: string;
  severity: DefectSeverity;
  due_on?: string;
  assigned_to?: string;
};

export async function previewCreateDefect(tx: Tx, org: Org, args: CreateDefect): Promise<Preview> {
  const [device] = await tx<{ label_number: number; type: string; site: string }[]>`
    select d.label_number, t.name as type, s.name as site from public.devices d
      join public.device_types t on t.id = d.device_type_id join public.sites s on s.id = d.site_id
     where d.id = ${args.device_id} and d.organization_id = ${org.id} and d.deleted_at is null`;
  if (!device) throw new ToolError("not_found", "No such device in this company.");
  const assignee = await memberName(tx, org, args.assigned_to);
  return {
    summary: `New ${args.severity} defect on device ${formatLabel(device.label_number)} (${device.type}) in ${device.site}.`,
    target: { device: formatLabel(device.label_number), type: device.type, site: device.site },
    changes: [
      { field: "description", from: null, to: args.description },
      { field: "severity", from: null, to: args.severity },
      ...(args.due_on ? [{ field: "due_on", from: null, to: args.due_on }] : []),
      ...(assignee ? [{ field: "assigned_to", from: null, to: assignee }] : []),
    ],
  };
}

export async function createDefect(tx: Tx, org: Org, args: CreateDefect) {
  const [created] = await tx<{ id: string }[]>`
    select public.create_defect(${args.device_id}, ${args.description}, ${args.severity}::public.defect_severity) as id`;
  const id = created!.id;
  if (args.due_on) await tx`select public.set_defect_due(${id}, ${args.due_on}::date)`;
  if (args.assigned_to) await tx`select public.assign_defect(${id}, ${args.assigned_to})`;
  const row = await loadDefect(tx, org, id);
  return { id, ...defectTarget(row), status: row.status };
}

// ---------- update_defect ----------

export type UpdateDefect = {
  defect_id: string;
  severity?: DefectSeverity;
  description?: string;
  status?: "open" | "in_progress";
  assigned_to?: string | null;
  due_on?: string | null;
};

export async function previewUpdateDefect(tx: Tx, org: Org, args: UpdateDefect): Promise<Preview> {
  const row = await loadDefect(tx, org, args.defect_id);
  if (row.status === "resolved" && args.status === undefined)
    throw new ToolError("conflict", "The defect is resolved. Set status to open to reopen it first.");
  const changes: Change[] = [];
  if (args.severity !== undefined && args.severity !== row.severity)
    changes.push({ field: "severity", from: row.severity, to: args.severity });
  if (args.description !== undefined && args.description.trim() !== row.description)
    changes.push({ field: "description", from: row.description, to: args.description.trim() });
  if (args.status !== undefined && args.status !== row.status)
    changes.push({ field: "status", from: row.status, to: args.status });
  if (args.assigned_to !== undefined && args.assigned_to !== row.assigned_to)
    changes.push({
      field: "assigned_to",
      from: await memberName(tx, org, row.assigned_to),
      to: await memberName(tx, org, args.assigned_to),
    });
  if (args.due_on !== undefined && args.due_on !== row.due_on)
    changes.push({ field: "due_on", from: row.due_on, to: args.due_on });
  if (!changes.length) throw new ToolError("invalid_input", "Nothing would change: the defect already has these values.");
  return { summary: `Change defect ${defectTarget(row).defect}.`, target: defectTarget(row), changes };
}

export async function updateDefect(tx: Tx, org: Org, args: UpdateDefect) {
  const row = await loadDefect(tx, org, args.defect_id);
  if (args.status !== undefined && args.status !== row.status)
    await tx`select public.change_defect_status(${row.id}, ${args.status}::public.defect_status, null)`;
  if (args.severity !== undefined && args.severity !== row.severity)
    await tx`select public.change_defect_severity(${row.id}, ${args.severity}::public.defect_severity)`;
  if (args.description !== undefined && args.description.trim() !== row.description)
    await tx`select public.edit_defect_description(${row.id}, ${args.description})`;
  if (args.assigned_to !== undefined && args.assigned_to !== row.assigned_to)
    await tx`select public.assign_defect(${row.id}, ${args.assigned_to})`;
  if (args.due_on !== undefined && args.due_on !== row.due_on)
    await tx`select public.set_defect_due(${row.id}, ${args.due_on}::date)`;
  const after = await loadDefect(tx, org, row.id);
  return {
    ...defectTarget(after),
    status: after.status,
    severity: after.severity,
    due_on: after.due_on,
    assigned_to: await memberName(tx, org, after.assigned_to),
  };
}

// ---------- comment_defect, resolve_defect ----------

export async function previewCommentDefect(tx: Tx, org: Org, args: { defect_id: string; note: string }): Promise<Preview> {
  const row = await loadDefect(tx, org, args.defect_id);
  return {
    summary: `Add a comment to defect ${defectTarget(row).defect}.`,
    target: defectTarget(row),
    changes: [{ field: "comment", from: null, to: args.note.trim() }],
  };
}

export async function commentDefect(tx: Tx, org: Org, args: { defect_id: string; note: string }) {
  const row = await loadDefect(tx, org, args.defect_id);
  await tx`select public.comment_defect(${row.id}, ${args.note})`;
  return { ...defectTarget(row), commented: true };
}

export async function previewResolveDefect(tx: Tx, org: Org, args: { defect_id: string; note: string }): Promise<Preview> {
  const row = await loadDefect(tx, org, args.defect_id);
  if (row.status === "resolved") throw new ToolError("conflict", "The defect is already resolved.");
  return {
    summary: `Resolve defect ${defectTarget(row).defect}: "${row.description.slice(0, 120)}".`,
    target: defectTarget(row),
    changes: [
      { field: "status", from: row.status, to: "resolved" },
      { field: "resolution_note", from: null, to: args.note.trim() },
    ],
  };
}

export async function resolveDefect(tx: Tx, org: Org, args: { defect_id: string; note: string }) {
  const row = await loadDefect(tx, org, args.defect_id);
  if (row.status === "resolved") throw new ToolError("conflict", "The defect is already resolved.");
  await tx`select public.change_defect_status(${row.id}, 'resolved'::public.defect_status, ${args.note})`;
  return { ...defectTarget(row), status: "resolved" };
}

// ---------- schedule_visit, reschedule_visit ----------

export type ScheduleVisit = { site_id: string; planned_on: string; technician_id?: string; note?: string };

export async function previewScheduleVisit(tx: Tx, org: Org, role: MemberRole, args: ScheduleVisit): Promise<Preview> {
  requireManager(role, "plan visits");
  const [site] = await tx<{ name: string; customer: string }[]>`
    select s.name, c.name as customer from public.sites s join public.customers c on c.id = s.customer_id
     where s.id = ${args.site_id} and s.organization_id = ${org.id} and s.deleted_at is null`;
  if (!site) throw new ToolError("not_found", "No such building in this company.");
  if (args.planned_on < org.today) throw new ToolError("invalid_input", "The day is in the past.");
  const technician = await memberName(tx, org, args.technician_id);
  return {
    summary: `Plan a visit to ${site.name} (${site.customer}) on ${args.planned_on}${technician ? ` for ${technician}` : ""}.`,
    target: { site: site.name, customer: site.customer },
    changes: [
      { field: "planned_on", from: null, to: args.planned_on },
      ...(technician ? [{ field: "technician", from: null, to: technician }] : []),
      ...(args.note ? [{ field: "note", from: null, to: args.note }] : []),
    ],
  };
}

export async function scheduleVisit(tx: Tx, org: Org, userId: string, args: ScheduleVisit) {
  const [row] = await tx<{ id: string }[]>`
    insert into public.inspection_plans (organization_id, site_id, planned_on, technician_id, note, created_by)
    values (${org.id}, ${args.site_id}, ${args.planned_on}, ${args.technician_id ?? null},
            ${args.note?.trim() || null}, ${userId})
    returning id`;
  return { visit_id: row!.id, planned_on: args.planned_on };
}

export type RescheduleVisit = {
  visit_id: string;
  planned_on?: string;
  technician_id?: string | null;
  note?: string | null;
};

type VisitRow = { id: string; planned_on: string; technician_id: string | null; note: string | null; site: string };

async function loadVisit(tx: Tx, org: Org, visitId: string): Promise<VisitRow> {
  const [row] = await tx<VisitRow[]>`
    select p.id, p.planned_on::text as planned_on, p.technician_id, p.note, s.name as site
      from public.inspection_plans p join public.sites s on s.id = p.site_id
     where p.id = ${visitId} and p.organization_id = ${org.id}`;
  if (!row) throw new ToolError("not_found", "No such planned visit in this company.");
  return row;
}

export async function previewRescheduleVisit(tx: Tx, org: Org, role: MemberRole, args: RescheduleVisit): Promise<Preview> {
  requireManager(role, "change planned visits");
  const row = await loadVisit(tx, org, args.visit_id);
  const changes: Change[] = [];
  if (args.planned_on !== undefined && args.planned_on !== row.planned_on) {
    if (args.planned_on < org.today) throw new ToolError("invalid_input", "The day is in the past.");
    changes.push({ field: "planned_on", from: row.planned_on, to: args.planned_on });
  }
  if (args.technician_id !== undefined && args.technician_id !== row.technician_id)
    changes.push({
      field: "technician",
      from: await memberName(tx, org, row.technician_id),
      to: await memberName(tx, org, args.technician_id),
    });
  if (args.note !== undefined && (args.note?.trim() || null) !== row.note)
    changes.push({ field: "note", from: row.note, to: args.note?.trim() || null });
  if (!changes.length) throw new ToolError("invalid_input", "Nothing would change.");
  return { summary: `Change the visit to ${row.site} on ${row.planned_on}.`, target: { site: row.site }, changes };
}

export async function rescheduleVisit(tx: Tx, org: Org, args: RescheduleVisit) {
  const row = await loadVisit(tx, org, args.visit_id);
  const updated = await tx`
    update public.inspection_plans
       set planned_on = ${args.planned_on ?? row.planned_on},
           technician_id = ${args.technician_id === undefined ? row.technician_id : args.technician_id},
           note = ${args.note === undefined ? row.note : args.note?.trim() || null}
     where id = ${row.id} and organization_id = ${org.id}
    returning id`;
  if (!updated.length) throw new ToolError("forbidden", "Your role does not allow this change.");
  const after = await loadVisit(tx, org, row.id);
  return {
    visit_id: after.id,
    site: after.site,
    planned_on: after.planned_on,
    technician: await memberName(tx, org, after.technician_id),
    note: after.note,
  };
}

// ---------- add_note ----------

export type AddNote = { target: "customer" | "site" | "device"; id: string; text: string };

const NOTE_LIMIT = 5000;

async function loadNote(tx: Tx, org: Org, args: AddNote): Promise<{ name: string; notes: string | null }> {
  const rows =
    args.target === "customer"
      ? await tx<{ name: string; notes: string | null }[]>`
          select name, notes from public.customers
           where id = ${args.id} and organization_id = ${org.id} and deleted_at is null`
      : args.target === "site"
        ? await tx<{ name: string; notes: string | null }[]>`
            select name, notes from public.sites
             where id = ${args.id} and organization_id = ${org.id} and deleted_at is null`
        : await tx<{ name: string; notes: string | null }[]>`
            select lpad(label_number::text, 4, '0') as name, notes from public.devices
             where id = ${args.id} and organization_id = ${org.id} and deleted_at is null`;
  if (!rows[0]) throw new ToolError("not_found", `No such ${args.target} in this company.`);
  return rows[0];
}

/** The note grows by one dated line; what was there stays. */
export function appendNote(existing: string | null, line: string): string {
  return existing?.trim() ? `${existing.trimEnd()}\n${line}` : line;
}

function noteLine(org: Org, author: string, text: string) {
  return `[${org.today}, ${author}, AI] ${text.trim().replace(/\s*\n\s*/g, " ")}`;
}

export async function previewAddNote(
  tx: Tx,
  org: Org,
  role: MemberRole,
  author: string,
  args: AddNote,
): Promise<Preview> {
  requireManager(role, "edit notes");
  const current = await loadNote(tx, org, args);
  const line = noteLine(org, author, args.text);
  if (appendNote(current.notes, line).length > NOTE_LIMIT)
    throw new ToolError("invalid_input", "The note would be longer than 5000 characters; shorten it or tidy the notes in the app.");
  return {
    summary: `Add a line to the notes of ${args.target} ${current.name}.`,
    target: { [args.target]: current.name },
    changes: [{ field: "notes (added line)", from: null, to: line }],
  };
}

export async function addNote(tx: Tx, org: Org, author: string, args: AddNote) {
  const current = await loadNote(tx, org, args);
  const notes = appendNote(current.notes, noteLine(org, author, args.text));
  const updated =
    args.target === "customer"
      ? await tx`update public.customers set notes = ${notes} where id = ${args.id} and organization_id = ${org.id} returning id`
      : args.target === "site"
        ? await tx`update public.sites set notes = ${notes} where id = ${args.id} and organization_id = ${org.id} returning id`
        : await tx`update public.devices set notes = ${notes} where id = ${args.id} and organization_id = ${org.id} returning id`;
  if (!updated.length) throw new ToolError("forbidden", "Your role does not allow this change.");
  return { [args.target]: current.name, notes };
}

-- Part 10: the weekly summary of coming due dates, e-mailed to owners and admins.
--
-- A scheduled job (GET /api/cron/weekly-summary) runs every Monday morning with
-- the service role. Before sending, it claims the organization's week here: the
-- unique key means a retried or doubled run never sends the same week twice.

alter table public.organizations
  add column weekly_digest boolean not null default true;

comment on column public.organizations.weekly_digest is
  'Send the weekly summary of due dates to owners and admins.';

create table public.organization_digests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Monday of the week, in the organization's time zone.
  week date not null check (extract(isodow from week) = 1),
  recipients integer not null check (recipients >= 0),
  sent_at timestamptz not null default now(),
  unique (organization_id, week)
);

alter table public.organization_digests enable row level security;

-- Owners and admins see when the summary went out; only the server writes.
create policy organization_digests_select on public.organization_digests
  for select to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

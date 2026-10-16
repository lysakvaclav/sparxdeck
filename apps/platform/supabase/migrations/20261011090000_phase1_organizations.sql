-- Phase 1: organizations, memberships, invitations.
--
-- Multi-tenancy rule: every tenant table carries organization_id and is protected
-- by Row Level Security. Writes that need to span tables (creating an organization
-- together with its owner, accepting an invitation) go through SECURITY DEFINER
-- functions with explicit checks, never through broad table policies.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Supabase installs pgcrypto in the "extensions" schema; make sure it is there.
create extension if not exists pgcrypto with schema extensions;

create type public.member_role as enum ('owner', 'admin', 'technician');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  legal_name text,
  company_id text,
  vat_id text,
  address text,
  email text,
  phone text,
  logo_path text,
  default_locale text not null default 'cs' check (default_locale in ('cs', 'en')),
  protocol_footer_text text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  -- Copied from auth.users at join time so teammates can see it without access to auth.
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role public.member_role not null check (role <> 'owner'),
  -- SHA-256 of the token sent in the e-mail; the token itself is never stored.
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitations_organization_id_idx on public.invitations (organization_id);

-- At most one open invitation per e-mail and organization.
create unique index invitations_open_unique
  on public.invitations (organization_id, email)
  where accepted_at is null;

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (used by RLS policies in this and later phases)
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so policies on memberships can call them without recursing
-- into the memberships policies themselves.
create or replace function public.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

-- organizations: members read, owners/admins edit. Created only via create_organization().
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::public.member_role[]));

-- memberships: members see their teammates. Rows are written only by functions.
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_member(organization_id));

-- invitations: managed by owners/admins of the organization.
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
  );

create policy invitations_delete on public.invitations
  for delete to authenticated
  using (
    accepted_at is null
    and public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  );

-- Anonymous visitors get nothing from these tables.
revoke all on public.organizations, public.memberships, public.invitations from anon;

-- ---------------------------------------------------------------------------
-- Functions callable by the app
-- ---------------------------------------------------------------------------

-- Creates an organization with the caller as owner, atomically. A user who already
-- belongs to an organization cannot create another one (one active org in the MVP).
create or replace function public.create_organization(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_org uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into public.organizations (name)
  values (btrim(p_name))
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'owner', btrim(p_display_name), lower(v_email));

  return v_org;
end;
$$;

-- What an invitation link shows before the invitee signs in: organization name,
-- role and the invited e-mail. Holding the token is the only requirement.
create or replace function public.get_invitation(p_token text)
returns table (organization_name text, role public.member_role, email text, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.role, i.email, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Accepts an invitation for the signed-in user. The invitation must be open,
-- unexpired and addressed to the caller's e-mail.
create or replace function public.accept_invitation(p_token text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_invite public.invitations;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;

  select * into v_invite
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_invite.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_invite.organization_id, v_user, v_invite.role, btrim(p_display_name), v_email);

  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(text, text) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.has_role(uuid, public.member_role[]) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to authenticated;
-- get_invitation is intentionally callable by anon: the invite page works before sign-in.
grant execute on function public.get_invitation(text) to anon, authenticated;

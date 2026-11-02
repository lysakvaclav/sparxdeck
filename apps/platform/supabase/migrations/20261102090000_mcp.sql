-- Part 31: AI assistants over MCP (Model Context Protocol).
--
-- A company's owner turns MCP on (and, separately, writing); members then
-- connect their assistant (Claude and others) through OAuth or a personal
-- token. Every MCP call runs in the database as that member (role
-- "authenticated" with their id), so Row Level Security and the write
-- functions apply exactly as in the app.
--
-- * organizations.mcp_enabled / mcp_write_enabled: off by default, changed only
--   by an owner through set_mcp_settings (a trigger refuses other updates).
-- * mcp_clients, mcp_auth_codes, mcp_rate, mcp_confirmations: the server's own
--   bookkeeping. RLS on and no policies: no client can read or write them.
-- * mcp_tokens: one row per connection (an OAuth grant or a personal token).
--   Only hashes of the secrets are stored, and members cannot read even those:
--   they see their own connections, owners and admins see all of the company's.
--   Revoked through revoke_mcp_token. Removing a member removes their tokens.
-- * mcp_audit: who called what, when, with which arguments and how it ended.
--   Written by the server only; members read their own rows, owners and admins
--   the company's.
--
-- Down:
--   drop function public.revoke_mcp_token(uuid);
--   drop function public.set_mcp_settings(uuid, boolean, boolean);
--   drop trigger organizations_mcp_guard on public.organizations;
--   drop function public.organizations_mcp_guard();
--   drop table public.mcp_confirmations, public.mcp_rate, public.mcp_audit,
--     public.mcp_auth_codes, public.mcp_tokens, public.mcp_clients;
--   alter table public.organizations drop column mcp_enabled, drop column mcp_write_enabled;

alter table public.organizations
  add column mcp_enabled boolean not null default false,
  add column mcp_write_enabled boolean not null default false;

-- Only set_mcp_settings may change the switches (it raises this flag for its
-- own update). The server (no auth.uid()) is not stopped: tests and support.
create or replace function public.organizations_mcp_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.mcp_enabled is distinct from old.mcp_enabled
      or new.mcp_write_enabled is distinct from old.mcp_write_enabled)
     and auth.uid() is not null
     and coalesce(current_setting('sparxdeck.mcp_settings', true), '') <> 'on' then
    raise exception 'mcp_settings_owner_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_mcp_guard
  before update on public.organizations
  for each row execute function public.organizations_mcp_guard();

-- The owner's switches. Writing needs MCP itself on.
create or replace function public.set_mcp_settings(
  p_organization uuid,
  p_enabled boolean,
  p_write boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(p_organization, array['owner']::public.member_role[]) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  perform set_config('sparxdeck.mcp_settings', 'on', true);
  update public.organizations
     set mcp_enabled = p_enabled,
         mcp_write_enabled = p_enabled and p_write
   where id = p_organization;
end;
$$;

revoke all on function public.set_mcp_settings(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_mcp_settings(uuid, boolean, boolean) to authenticated;

-- OAuth clients: registered dynamically (RFC 7591) or described by a Client
-- ID Metadata Document (the client_id is then its https URL).
create table public.mcp_clients (
  client_id text primary key check (char_length(client_id) between 8 and 2048),
  kind text not null check (kind in ('registered', 'metadata')),
  client_name text check (char_length(client_name) <= 200),
  client_uri text check (char_length(client_uri) <= 2048),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  secret_hash text,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mcp_clients enable row level security;
revoke all on public.mcp_clients from anon, authenticated;

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('oauth', 'personal')),
  client_id text references public.mcp_clients (client_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  scopes text[] not null
    check (scopes <@ array['sparxdeck:read', 'sparxdeck:write'] and 'sparxdeck:read' = any (scopes)),
  access_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_hash text unique,
  previous_refresh_hash text,
  -- The connection's end: the refresh token's for OAuth, the chosen one for a personal token.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade,
  check ((kind = 'oauth') = (client_id is not null))
);

create index mcp_tokens_org on public.mcp_tokens (organization_id, created_at desc);
create index mcp_tokens_user on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_tokens from anon, authenticated;
-- Never the hashes.
grant select (id, organization_id, user_id, kind, client_id, name, scopes, access_expires_at,
              expires_at, created_at, last_used_at, revoked_at, revoked_by)
  on public.mcp_tokens to authenticated;

create policy mcp_tokens_select on public.mcp_tokens
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_member(organization_id))
    or public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  );

-- Your own connection, or any of the company's for an owner or admin.
create or replace function public.revoke_mcp_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_user uuid;
begin
  select organization_id, user_id into v_org, v_user
    from public.mcp_tokens where id = p_token;
  if v_org is null
     or not (
       (v_user = auth.uid() and public.is_member(v_org))
       or public.has_role(v_org, array['owner', 'admin']::public.member_role[])
     ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.mcp_tokens
     set revoked_at = coalesce(revoked_at, now()),
         revoked_by = coalesce(revoked_by, auth.uid())
   where id = p_token;
end;
$$;

revoke all on function public.revoke_mcp_token(uuid) from public, anon;
grant execute on function public.revoke_mcp_token(uuid) to authenticated;

-- Authorization codes: one use, ten minutes, PKCE (S256) and the resource they are for.
create table public.mcp_auth_codes (
  code_hash text primary key,
  client_id text not null references public.mcp_clients (client_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  scopes text[] not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  token_id uuid references public.mcp_tokens (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade
);

alter table public.mcp_auth_codes enable row level security;
revoke all on public.mcp_auth_codes from anon, authenticated;

create table public.mcp_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Kept when the member leaves: the record of what happened stays.
  user_id uuid not null,
  token_id uuid references public.mcp_tokens (id) on delete set null,
  client_name text,
  method text not null check (char_length(method) <= 100),
  name text check (char_length(name) <= 300),
  params jsonb,
  outcome text not null check (outcome in ('ok', 'error', 'denied', 'rate_limited')),
  error_code text check (char_length(error_code) <= 100),
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index mcp_audit_org on public.mcp_audit (organization_id, created_at desc);
create index mcp_audit_token on public.mcp_audit (token_id, created_at desc);

alter table public.mcp_audit enable row level security;
revoke all on public.mcp_audit from anon, authenticated;
grant select on public.mcp_audit to authenticated;

create policy mcp_audit_select on public.mcp_audit
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_member(organization_id))
    or public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  );

-- Calls per token in the current minute and day.
create table public.mcp_rate (
  token_id uuid not null references public.mcp_tokens (id) on delete cascade,
  period text not null check (period in ('minute', 'day')),
  started_at timestamptz not null,
  calls integer not null,
  primary key (token_id, period)
);

alter table public.mcp_rate enable row level security;
revoke all on public.mcp_rate from anon, authenticated;

-- A previewed change waiting for the user's yes: bound to the token, the tool
-- and the exact arguments; ten minutes, one use.
create table public.mcp_confirmations (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.mcp_tokens (id) on delete cascade,
  tool text not null,
  params_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mcp_confirmations enable row level security;
revoke all on public.mcp_confirmations from anon, authenticated;

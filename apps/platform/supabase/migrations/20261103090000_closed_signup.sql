-- Closed sign-up (owner's decision 2026-11-03): nobody can create an account
-- on their own. An account can be created only for
--   * an e-mail on public.signup_allowlist (a company the owner of SparxDeck
--     agreed with; they then create their company and invite their team), or
--   * an e-mail with a pending, unexpired invitation into a team.
-- Only an allowlisted e-mail may create a company (create_organization).
-- The list is kept by hand in the Supabase dashboard (Table Editor →
-- signup_allowlist): one row per e-mail, or "@domain.cz" for a whole domain.
-- Clients can neither read nor change it. Existing accounts are untouched.
--
-- Down:
--   drop trigger guard_signup on auth.users;
--   drop function public.guard_signup();
--   (re-create create_organization from 20261011210000_device_types_templates.sql)
--   drop function public.signup_allowlisted(text), public.signup_allowed(text);
--   drop trigger signup_allowlist_normalize on public.signup_allowlist;
--   drop function public.signup_allowlist_normalize();
--   drop table public.signup_allowlist;

create table public.signup_allowlist (
  email text primary key
    check (email = lower(btrim(email)) and (email like '%_@_%._%' or email like '@_%._%')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  -- When the e-mail created its company (for the overview; the row stays).
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

comment on table public.signup_allowlist is
  'Who may create a SparxDeck account and company: an e-mail, or @domain for a whole domain. Invited team members need no row.';

alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

-- Typed by hand in the dashboard: spaces and capitals are forgiven.
create or replace function public.signup_allowlist_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

create trigger signup_allowlist_normalize
  before insert or update of email on public.signup_allowlist
  for each row execute function public.signup_allowlist_normalize();

-- On the list: the e-mail itself or its domain.
create or replace function public.signup_allowlisted(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.signup_allowlist a
     where a.email = lower(btrim(p_email))
        or a.email = '@' || split_part(lower(btrim(p_email)), '@', 2)
  );
$$;

-- May create an account: on the list, or invited into a team (pending, unexpired).
create or replace function public.signup_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is not null and (
    public.signup_allowlisted(p_email)
    or exists (
      select 1 from public.invitations i
       where i.email = lower(btrim(p_email))
         and i.accepted_at is null
         and i.expires_at > now()
    )
  );
$$;

-- Neither function is for clients (it would tell who is on the list).
revoke all on function public.signup_allowlisted(text) from public, anon, authenticated;
revoke all on function public.signup_allowed(text) from public, anon, authenticated;

-- Every new account, however it is created (sign-up, magic link, invitation).
create or replace function public.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.signup_allowed(new.email) then
    raise exception 'signup_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_signup() from public, anon, authenticated;

create trigger guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup();

-- Only an allowlisted e-mail founds a company; invited people join theirs.
create or replace function public.create_organization(p_name text, p_display_name text, p_locale text default 'cs')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_org uuid;
  v_locale text := case when p_locale = 'en' then 'en' else 'cs' end;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_user;

  if not public.signup_allowlisted(v_email) then
    raise exception 'signup_not_allowed' using errcode = '42501';
  end if;

  insert into public.organizations (name, default_locale)
  values (btrim(p_name), v_locale)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'owner', btrim(p_display_name), lower(v_email));

  perform public.seed_organization_defaults(v_org, v_locale);

  update public.signup_allowlist
     set used_at = coalesce(used_at, now()), used_by = coalesce(used_by, v_user)
   where email = lower(v_email);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

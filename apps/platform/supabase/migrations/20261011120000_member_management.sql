-- Part 1: member management (change role, remove, transfer ownership), editing your
-- own display name, and keeping the copied e-mail in memberships in sync.
--
-- Rules:
-- * Owners and admins manage members. Nobody can remove the owner or change the
--   owner's role; ownership moves only through transfer_ownership().
-- * Only the owner can transfer ownership. The previous owner becomes an admin, so
--   an organization always has exactly one owner.
-- * Admins cannot promote anyone to owner. Members cannot remove themselves here.

-- ---------------------------------------------------------------------------
-- Editing your own display name: column-level privilege + own-row policy, so a
-- member can change their name but never their role or organization.
-- ---------------------------------------------------------------------------

revoke update on public.memberships from authenticated;
grant update (display_name) on public.memberships to authenticated;

create policy memberships_update_own on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Keep memberships.email in sync when a user confirms a new e-mail address.
-- ---------------------------------------------------------------------------

create or replace function public.sync_membership_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.memberships set email = lower(new.email) where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_membership_email();

-- ---------------------------------------------------------------------------
-- Member management functions
-- ---------------------------------------------------------------------------

-- Changes a member's role to admin or technician.
create or replace function public.change_member_role(p_membership uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
begin
  if p_role = 'owner' then
    raise exception 'use_transfer_ownership' using errcode = 'P0001';
  end if;

  select * into v_target from public.memberships where id = p_membership for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_target.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_target.role = 'owner' then
    raise exception 'owner_protected' using errcode = 'P0001';
  end if;
  if v_target.user_id = (select auth.uid()) then
    raise exception 'cannot_change_self' using errcode = 'P0001';
  end if;

  update public.memberships set role = p_role where id = p_membership;
end;
$$;

-- Removes a member from the organization. Their account stays; open invitations
-- they sent remain valid.
create or replace function public.remove_member(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
begin
  select * into v_target from public.memberships where id = p_membership for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_target.organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_target.role = 'owner' then
    raise exception 'owner_protected' using errcode = 'P0001';
  end if;
  if v_target.user_id = (select auth.uid()) then
    raise exception 'cannot_change_self' using errcode = 'P0001';
  end if;

  delete from public.memberships where id = p_membership;
end;
$$;

-- Hands the organization to another member. Caller must be the owner; they become admin.
create or replace function public.transfer_ownership(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_target public.memberships;
begin
  select * into v_target from public.memberships where id = p_membership for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_target.organization_id, array['owner']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_target.user_id = v_user then
    raise exception 'cannot_change_self' using errcode = 'P0001';
  end if;

  update public.memberships set role = 'admin'
  where organization_id = v_target.organization_id and user_id = v_user;

  update public.memberships set role = 'owner' where id = p_membership;
end;
$$;

-- Exactly one owner per organization, enforced by the database as well.
create unique index memberships_one_owner
  on public.memberships (organization_id)
  where role = 'owner';

revoke all on function public.change_member_role(uuid, public.member_role) from public, anon;
revoke all on function public.remove_member(uuid) from public, anon;
revoke all on function public.transfer_ownership(uuid) from public, anon;
revoke all on function public.sync_membership_email() from public, anon, authenticated;
grant execute on function public.change_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid) to authenticated;

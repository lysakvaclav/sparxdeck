-- Part 2: organization settings and private file storage.

-- ---------------------------------------------------------------------------
-- Settings columns. Typed columns (not settings jsonb) so the database itself
-- rejects invalid values.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column timezone text not null default 'Europe/Prague',
  add column due_soon_days integer not null default 30
    check (due_soon_days between 1 and 365);

alter table public.organizations
  add constraint organizations_name_length check (char_length(name) <= 200),
  add constraint organizations_legal_name_length check (char_length(legal_name) <= 200),
  add constraint organizations_company_id_length check (char_length(company_id) <= 20),
  add constraint organizations_vat_id_length check (char_length(vat_id) <= 20),
  add constraint organizations_address_length check (char_length(address) <= 500),
  add constraint organizations_email_length check (char_length(email) <= 254),
  add constraint organizations_phone_length check (char_length(phone) <= 40),
  add constraint organizations_footer_length check (char_length(protocol_footer_text) <= 1000),
  -- The logo must live in the organization's own storage folder.
  add constraint organizations_logo_path_own_folder check (logo_path is null or logo_path like id::text || '/%');

-- Time zones must be real IANA names; pg_timezone_names isn't usable in a CHECK.
create or replace function public.validate_organization_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger organizations_validate_timezone
  before insert or update of timezone on public.organizations
  for each row execute function public.validate_organization_timezone();

-- ---------------------------------------------------------------------------
-- Private storage for organization files (logo now; photos and PDFs later).
-- Objects live under "<organization_id>/...". The bucket itself enforces size
-- and type; policies enforce who may read and write.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-assets', 'org-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Organization id from an object path, or null when the path isn't "<uuid>/...".
create or replace function public.storage_organization_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[1]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create policy org_assets_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-assets'
    and public.is_member(public.storage_organization_id(name))
  );

create policy org_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

create policy org_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-assets'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  )
  with check (
    bucket_id = 'org-assets'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

create policy org_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and public.has_role(public.storage_organization_id(name), array['owner', 'admin']::public.member_role[])
  );

grant execute on function public.storage_organization_id(text) to authenticated;
revoke all on function public.validate_organization_timezone() from public, anon, authenticated;

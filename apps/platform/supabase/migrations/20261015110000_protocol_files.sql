-- Part 9 follow-up: protocol PDFs get their own private bucket. org-assets takes
-- images up to 2 MB that owners and admins upload; protocols are PDFs that only
-- the server writes (service role) and members read, under "<organization_id>/".
-- The org-assets policies go back to what they were before the protocols folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('protocols', 'protocols', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read only: no insert, update or delete policy, so no app user can change a protocol.
create policy protocols_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'protocols'
    and public.is_member(public.storage_organization_id(name))
  );

drop policy org_assets_insert on storage.objects;
drop policy org_assets_update on storage.objects;
drop policy org_assets_delete on storage.objects;

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

-- A required photo on a checklist question: the check of a device can't be
-- finished until that question has at least one photo. Leaving the device out
-- ("can't be checked") needs none. Templates stay versioned: switching the flag
-- makes a new version, earlier inspections keep theirs.

alter table public.checklist_template_items
  add column photo_required boolean not null default false;

-- Same as before (20261011210000_device_types_templates.sql) plus the optional
-- "photoRequired" of each item (missing = false, so older callers still work).
create or replace function public.save_checklist_template(
  p_device_type uuid,
  p_name text,
  p_items jsonb,
  p_verified boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_current public.checklist_templates%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_version integer;
  v_id uuid;
  v_item jsonb;
begin
  select organization_id into v_org from public.device_types where id = p_device_type;
  if v_org is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Validate the whole template before writing anything.
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 160
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'invalid_template' using errcode = 'P0001';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or char_length(btrim(coalesce(v_item ->> 'label', ''))) not between 1 and 200
       or coalesce(v_item ->> 'type', '') not in ('pass_fail', 'number', 'text')
       or jsonb_typeof(v_item -> 'required') is distinct from 'boolean'
       or jsonb_typeof(v_item -> 'failCreatesDefect') is distinct from 'boolean'
       or (v_item ? 'photoRequired' and jsonb_typeof(v_item -> 'photoRequired') is distinct from 'boolean')
       or ((v_item ->> 'failCreatesDefect')::boolean and v_item ->> 'type' <> 'pass_fail') then
      raise exception 'invalid_template' using errcode = 'P0001';
    end if;
  end loop;

  -- Serialise saves of the same type.
  perform 1 from public.device_types where id = p_device_type for update;

  select * into v_current
  from public.checklist_templates
  where device_type_id = p_device_type and active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'label', btrim(e ->> 'label'),
           'type', e ->> 'type',
           'required', (e ->> 'required')::boolean,
           'failCreatesDefect', (e ->> 'failCreatesDefect')::boolean,
           'photoRequired', coalesce((e ->> 'photoRequired')::boolean, false)) order by ord), '[]'::jsonb)
    into v_new
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);

  if v_current.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'label', label,
             'type', item_type::text,
             'required', required,
             'failCreatesDefect', fail_creates_defect,
             'photoRequired', photo_required) order by sort_order), '[]'::jsonb)
      into v_old
    from public.checklist_template_items
    where template_id = v_current.id;

    -- Nothing changed: keep the current version.
    if v_old = v_new and v_current.name = btrim(p_name) and (not p_verified or not v_current.is_sample) then
      return v_current.id;
    end if;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.checklist_templates where device_type_id = p_device_type;

  update public.checklist_templates set active = false
  where device_type_id = p_device_type and active;

  insert into public.checklist_templates
    (organization_id, device_type_id, version, name, is_sample, active, created_by)
  values
    (v_org, p_device_type, v_version, btrim(p_name),
     coalesce(v_current.is_sample, false) and not p_verified, true, (select auth.uid()))
  returning id into v_id;

  insert into public.checklist_template_items
    (organization_id, template_id, sort_order, label, item_type, required, fail_creates_defect,
     photo_required)
  select v_org, v_id, ord, e ->> 'label', (e ->> 'type')::public.checklist_item_type,
         (e ->> 'required')::boolean, (e ->> 'failCreatesDefect')::boolean,
         (e ->> 'photoRequired')::boolean
  from jsonb_array_elements(v_new) with ordinality as t(e, ord);

  return v_id;
end;
$$;

-- Complete = every required question answered and every photo-required question
-- with a photo of this check. Used by finishing a check (online and from the phone).
create or replace function public.check_answers_complete(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.inspection_items i
    join public.checklist_template_items t on t.template_id = i.template_id
    left join public.inspection_answers a
      on a.item_id = i.id and a.template_item_id = t.id
    where i.id = p_item
      and (
        (t.required and case t.item_type
          when 'pass_fail' then a.value_pass is null
          when 'number' then a.value_number is null
          else coalesce(a.value_text, '') = ''
        end)
        or (t.photo_required and not exists (
          select 1 from public.inspection_photos p
          where p.item_id = i.id and p.template_item_id = t.id
        ))
      )
  );
$$;

revoke all on function public.save_checklist_template(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_checklist_template(uuid, text, jsonb, boolean) to authenticated;
revoke all on function public.check_answers_complete(uuid) from public, anon, authenticated;

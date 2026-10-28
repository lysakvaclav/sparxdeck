-- Part 22, stage C: a protocol template may set the language of its protocols
-- ("language": "cs" or "en" in its JSON; none or "organization" = the
-- company's). The protocol takes it when it is numbered, with the template
-- version; a reissue keeps the language of the protocol it replaces (it copies
-- the row's locale, as before).
--
-- Rollback: run the definition of public.stamp_protocol_template() from
-- 20261029090000_protocol_templates.sql again (same signature, no language).

create or replace function public.stamp_protocol_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text;
begin
  if new.template_version_id is not null then
    return new;
  end if;
  if new.version > 1 then
    select template_version_id into new.template_version_id
    from public.protocols
    where inspection_id = new.inspection_id and version = new.version - 1;
  else
    new.template_version_id := public.protocol_template_version_for(new.inspection_id);
    select content ->> 'language' into v_language
    from public.protocol_template_versions
    where id = new.template_version_id;
    if v_language in ('cs', 'en') then
      new.locale := v_language;
    end if;
  end if;
  return new;
end;
$$;

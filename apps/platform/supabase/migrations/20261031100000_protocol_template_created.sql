-- Part 22, stage D: a template's history starts with its creation, however it
-- is made (new, copied, imported). The default template a company gets is
-- published at once and writes its own (seed_protocol_template).
--
-- Rollback:
--   drop trigger protocol_templates_created on public.protocol_templates;
--   drop function public.log_protocol_template_created();

create or replace function public.log_protocol_template_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    insert into public.protocol_template_events (organization_id, template_id, kind, actor)
    values (new.organization_id, new.id, 'created', (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger protocol_templates_created
  after insert on public.protocol_templates
  for each row execute function public.log_protocol_template_created();

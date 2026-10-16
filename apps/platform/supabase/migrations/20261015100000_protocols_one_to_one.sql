-- Part 9 follow-up: the protocol's key to its inspection is (inspection_id,
-- organization_id). Unique on exactly those columns, the API embeds an
-- inspection's protocol as one object instead of a list.

alter table public.protocols
  add constraint protocols_inspection_id_organization_id_key unique (inspection_id, organization_id);

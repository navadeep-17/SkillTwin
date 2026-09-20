-- Advance reproducibility metadata after the P1 role-bank and product-completion migrations.
insert into public.system_metadata(key,value,updated_at) values
  ('schema_contract_version','skilltwin-full-spec-v1','now'::timestamptz),
  ('seed_version','seed-2026-09-20-v3','now'::timestamptz),
  ('resource_catalog_version','resource-catalog-d2','now'::timestamptz),
  ('demo_fixture_version','demo-backend-v1','now'::timestamptz)
on conflict(key) do update set value=excluded.value,updated_at=now();

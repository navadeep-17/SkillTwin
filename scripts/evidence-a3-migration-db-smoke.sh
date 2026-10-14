#!/usr/bin/env bash
set -euo pipefail

# Isolated ephemeral PostgreSQL schema smoke test. No Supabase credentials.
container=skilltwin-a3-pg-qa
docker rm -f "$container" >/dev/null 2>&1 || true
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-ci-only postgres:17 >/dev/null
for i in $(seq 1 40); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres -d postgres >/dev/null

cat <<'SQL' | docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null
create role anon nologin;
create role authenticated nologin;
create table public.users(id uuid primary key);
create table public.profile_projects(
  id uuid primary key, user_id uuid not null references public.users(id));
create table public.skills(id uuid primary key, slug text not null unique);
SQL

# Real migration parser/executor. No mock of migration SQL.
cat supabase/migrations/0029_a3_practical_review_attestations.sql | \
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null

cat <<'SQL' | docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres
do $test$
declare rls_count integer; denied_count integer; cols integer;
begin
  select count(*) into rls_count
  from pg_class where oid in ('public.competency_reviewers'::regclass,
      'public.competency_practical_reviews'::regclass) and relrowsecurity;
  if rls_count <> 2 then raise exception 'A3_RLS_NOT_ENABLED'; end if;

  select count(*) into denied_count
  from (values ('anon'),('authenticated')) as roles(name)
  cross join (values ('competency_reviewers'),('competency_practical_reviews')) as tables(name)
  where has_table_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,DELETE');
  if denied_count <> 0 then raise exception 'A3_CLIENT_ROLE_TABLE_ACCESS'; end if;

  select count(*) into cols from information_schema.columns
  where table_schema='public' and table_name='competency_practical_reviews'
    and column_name in ('reviewed_source_path','reviewed_blob_sha',
      'learner_user_id','reviewer_user_id','criterion_id','project_version','commit_sha');
  if cols <> 7 then raise exception 'A3_AUDIT_COLUMNS_MISSING'; end if;
end
$test$;

insert into public.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.profile_projects(id,user_id) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
insert into public.skills(id,slug) values
  ('44444444-4444-4444-8444-444444444444','rest-api');
insert into public.competency_reviewers(user_id,active,rationale) values
  ('22222222-2222-4222-8222-222222222222',true,'Dedicated isolated CI reviewer');

insert into public.competency_practical_reviews(
  learner_user_id,reviewer_user_id,project_id,project_version,
  skill_id,criterion_id,rubric_version,repository_url,commit_sha,
  reviewed_source_path,reviewed_blob_sha,review_method,
  practical_task,observed_result,test_procedure,verdict)
values(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',1,
  '44444444-4444-4444-8444-444444444444',
  'rest-api.resource-routing','competency-rubrics-a3-draft1',
  'https://github.com/test/repo',
  repeat('a',40),'src/api.ts',repeat('b',40),'OBSERVED_PRACTICAL_DEMO',
  'Observed learner implement resource routing on a pinned commit and explain the data flow.',
  'Observed a test request return the expected status and correct resource identifier.',
  'Sent GET /orders/42 to the test service and inspected the response.',
  'PASS');

do $test$
begin
  if (select count(*) from public.competency_practical_reviews) <> 1 then
    raise exception 'A3_INSERT_FAILED';
  end if;
  begin
    insert into public.competency_practical_reviews(
      learner_user_id,reviewer_user_id,project_id,project_version,
      skill_id,criterion_id,rubric_version,repository_url,commit_sha,
      reviewed_source_path,reviewed_blob_sha,
      practical_task,observed_result,test_procedure,verdict)
    select reviewer_user_id,reviewer_user_id,project_id,project_version,
      skill_id,criterion_id,rubric_version,repository_url,repeat('c',40),
      reviewed_source_path,reviewed_blob_sha,practical_task,observed_result,
      test_procedure,verdict from public.competency_practical_reviews limit 1;
    raise exception 'A3_SELF_REVIEW_WAS_ACCEPTED';
  exception when check_violation then null;
  end;
end
$test$;
SQL

echo 'A3_EPHEMERAL_POSTGRES_MIGRATION=PASS'

-- Align planner with the current verified resource catalog and backfill missing
-- resource assignments for already-generated active plans.

insert into public.learning_resources(
  id,title,provider,url,tags,levels,format,duration_minutes,quality,
  is_verified,status,catalog_version,last_verified_at
) values (
  '72000000-0000-0000-0000-000000000001',
  'Preprocessing data',
  'scikit-learn',
  'https://scikit-learn.org/stable/modules/preprocessing.html',
  '["feature-engineering","scikit-learn","preprocessing"]'::jsonb,
  '["BEGINNER","INTERMEDIATE"]'::jsonb,
  'DOCS',
  45,
  0.90,
  true,
  'ACTIVE',
  'resource-catalog-d2',
  now()
)
on conflict(url) do update set
  tags=excluded.tags,
  levels=excluded.levels,
  quality=excluded.quality,
  is_verified=true,
  status='ACTIVE',
  catalog_version='resource-catalog-d2',
  last_verified_at=now();

insert into public.task_resource_assignments(
  task_id,resource_id,rank_score,ranker_version,explanation
)
select
  lt.id,
  matched.id,
  matched.quality,
  'resource-ranker-d2-backfill',
  'Verified resource matched the task skill tag and current resource catalog.'
from public.learning_tasks lt
join public.learning_plans lp on lp.id=lt.plan_id and lp.status='ACTIVE'
join public.skills s on s.id=lt.skill_id
join lateral (
  select lr.id,lr.quality
  from public.learning_resources lr
  where lr.is_verified=true
    and lr.status='ACTIVE'
    and lr.catalog_version='resource-catalog-d2'
    and lr.tags ? s.slug
  order by lr.quality desc,lr.title
  limit 1
) matched on true
where lt.type='LEARN'
  and not exists (
    select 1 from public.task_resource_assignments tra where tra.task_id=lt.id
  )
on conflict(task_id,resource_id) do nothing;

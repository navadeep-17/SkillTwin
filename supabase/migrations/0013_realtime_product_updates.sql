-- Realtime product synchronization for learner-facing canonical state.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='user_skills'
  ) then
    execute 'alter publication supabase_realtime add table public.user_skills';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='gap_snapshots'
  ) then
    execute 'alter publication supabase_realtime add table public.gap_snapshots';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='learning_plans'
  ) then
    execute 'alter publication supabase_realtime add table public.learning_plans';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='skill_assessments'
  ) then
    execute 'alter publication supabase_realtime add table public.skill_assessments';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='plan_diffs'
  ) then
    execute 'alter publication supabase_realtime add table public.plan_diffs';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='agent_events'
  ) then
    execute 'alter publication supabase_realtime add table public.agent_events';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='profile_analysis_runs'
  ) then
    execute 'alter publication supabase_realtime add table public.profile_analysis_runs';
  end if;
end
$$;

-- Remove duplicate indexes only when the equivalent historical index is also present.
do $$
begin
  if to_regclass('public.ix_project_recommendations_user') is not null
     and to_regclass('public.ix_project_recommendations_user_created') is not null then
    execute 'drop index public.ix_project_recommendations_user';
  end if;

  if to_regclass('public.ix_role_generation_runs_user_created') is not null
     and to_regclass('public.ix_role_generation_user_created') is not null then
    execute 'drop index public.ix_role_generation_runs_user_created';
  end if;

  if to_regclass('public.ix_weekly_reports_user') is not null
     and to_regclass('public.ix_weekly_reports_user_week') is not null then
    execute 'drop index public.ix_weekly_reports_user';
  end if;
end $$;

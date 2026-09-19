-- Security/performance hardening verified against the live SkillTwin project.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select to authenticated using (id=(select auth.uid()));
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists "user_skills_select_own" on public.user_skills;
create policy "user_skills_select_own" on public.user_skills for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "skill_evidence_select_own" on public.skill_evidence;
create policy "skill_evidence_select_own" on public.skill_evidence for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "skill_history_select_own" on public.skill_history;
create policy "skill_history_select_own" on public.skill_history for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "agent_events_select_own" on public.agent_events;
create policy "agent_events_select_own" on public.agent_events for select to authenticated using (user_id=(select auth.uid()));

drop policy if exists "career_goals_select_own" on public.career_goals;
create policy "career_goals_select_own" on public.career_goals for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "career_goals_insert_own" on public.career_goals;
create policy "career_goals_insert_own" on public.career_goals for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "career_goals_update_own" on public.career_goals;
create policy "career_goals_update_own" on public.career_goals for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "gap_snapshots_select_own" on public.gap_snapshots;
create policy "gap_snapshots_select_own" on public.gap_snapshots for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "skill_gap_results_select_own" on public.skill_gap_results;
create policy "skill_gap_results_select_own" on public.skill_gap_results for select to authenticated using (user_id=(select auth.uid()));

drop policy if exists "profile_documents_select_own" on public.profile_documents;
create policy "profile_documents_select_own" on public.profile_documents for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "profile_documents_insert_own" on public.profile_documents;
create policy "profile_documents_insert_own" on public.profile_documents for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "profile_documents_update_own" on public.profile_documents;
create policy "profile_documents_update_own" on public.profile_documents for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "document_parse_runs_select_own" on public.document_parse_runs;
create policy "document_parse_runs_select_own" on public.document_parse_runs for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "analysis_runs_select_own" on public.profile_analysis_runs;
create policy "analysis_runs_select_own" on public.profile_analysis_runs for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "source_blocks_select_own" on public.profile_source_blocks;
create policy "source_blocks_select_own" on public.profile_source_blocks for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "candidate_claims_select_own" on public.candidate_skill_claims;
create policy "candidate_claims_select_own" on public.candidate_skill_claims for select to authenticated using (user_id=(select auth.uid()));

drop policy if exists "profile_storage_select_own" on storage.objects;
create policy "profile_storage_select_own" on storage.objects for select to authenticated
using (bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "profile_storage_insert_own" on storage.objects;
create policy "profile_storage_insert_own" on storage.objects for insert to authenticated
with check (bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "profile_storage_delete_own" on storage.objects;
create policy "profile_storage_delete_own" on storage.objects for delete to authenticated
using (bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

create index if not exists ix_user_skills_skill_id on public.user_skills(skill_id);
create index if not exists ix_skill_evidence_skill_id on public.skill_evidence(skill_id);
create index if not exists ix_skill_history_skill_id on public.skill_history(skill_id);
create index if not exists ix_role_requirements_group on public.role_skill_requirements(group_id);
create index if not exists ix_role_requirements_skill on public.role_skill_requirements(skill_id);
create index if not exists ix_role_edges_prereq on public.role_dependency_edges(prerequisite_requirement_id);
create index if not exists ix_role_edges_dependent on public.role_dependency_edges(dependent_requirement_id);
create index if not exists ix_gap_results_user on public.skill_gap_results(user_id);
create index if not exists ix_gap_results_requirement on public.skill_gap_results(requirement_id);
create index if not exists ix_gap_results_group on public.skill_gap_results(group_id);
create index if not exists ix_gap_results_skill on public.skill_gap_results(skill_id);
create index if not exists ix_parse_runs_user on public.document_parse_runs(user_id);
create index if not exists ix_source_blocks_user on public.profile_source_blocks(user_id);
create index if not exists ix_claims_user on public.candidate_skill_claims(user_id);
create index if not exists ix_claims_block on public.candidate_skill_claims(source_block_id);
create index if not exists ix_claims_skill on public.candidate_skill_claims(canonical_skill_id);

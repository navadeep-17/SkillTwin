-- SkillTwin FK coverage indexes for production query/delete performance.
-- Intentionally does not touch unrelated legacy mental-health tables.

create index if not exists ix_career_goals_role_version
  on public.career_goals(role_version_id);

create index if not exists ix_gap_snapshots_goal
  on public.gap_snapshots(goal_id);
create index if not exists ix_gap_snapshots_role_version
  on public.gap_snapshots(role_version_id);

create index if not exists ix_requirement_groups_role_version
  on public.requirement_groups(role_version_id);

create index if not exists ix_skills_parent
  on public.skills(parent_skill_id);

create index if not exists ix_skill_evidence_superseded_by
  on public.skill_evidence(superseded_by_id);

create index if not exists ix_learning_plans_gap_snapshot
  on public.learning_plans(gap_snapshot_id);
create index if not exists ix_learning_plans_parent
  on public.learning_plans(parent_plan_id);

create index if not exists ix_learning_objectives_week
  on public.learning_objectives(week_id);
create index if not exists ix_learning_objectives_requirement
  on public.learning_objectives(requirement_id);

create index if not exists ix_learning_tasks_week
  on public.learning_tasks(week_id);
create index if not exists ix_learning_tasks_objective
  on public.learning_tasks(objective_id);
create index if not exists ix_learning_tasks_inserted_by_diff
  on public.learning_tasks(inserted_by_plan_diff_id);

create index if not exists ix_task_resource_resource
  on public.task_resource_assignments(resource_id);

create index if not exists ix_plan_generation_goal
  on public.plan_generation_runs(goal_id);
create index if not exists ix_plan_generation_gap_snapshot
  on public.plan_generation_runs(gap_snapshot_id);
create index if not exists ix_plan_generation_result_plan
  on public.plan_generation_runs(result_plan_id);

create index if not exists ix_skill_assessments_skill
  on public.skill_assessments(skill_id);
create index if not exists ix_skill_assessments_source_task
  on public.skill_assessments(source_task_id);

create index if not exists ix_skill_questions_bank_question
  on public.skill_assessment_questions(bank_question_id);

create index if not exists ix_skill_attempts_question
  on public.skill_assessment_attempts(question_id);

create index if not exists ix_skill_signals_attempt
  on public.skill_assessment_concept_signals(attempt_id);
create index if not exists ix_skill_signals_user
  on public.skill_assessment_concept_signals(user_id);
create index if not exists ix_skill_signals_skill
  on public.skill_assessment_concept_signals(skill_id);

create index if not exists ix_skill_outcomes_skill
  on public.skill_assessment_outcomes(skill_id);
create index if not exists ix_skill_outcomes_gap_snapshot
  on public.skill_assessment_outcomes(gap_snapshot_id);

create index if not exists ix_replan_decisions_goal
  on public.replan_decisions(goal_id);
create index if not exists ix_replan_decisions_from_plan
  on public.replan_decisions(from_plan_id);

create index if not exists ix_plan_diffs_goal
  on public.plan_diffs(goal_id);
create index if not exists ix_plan_diffs_to_plan
  on public.plan_diffs(to_plan_id);

create index if not exists ix_chat_proposals_thread
  on public.chat_action_proposals(thread_id);
create index if not exists ix_chat_proposals_source_message
  on public.chat_action_proposals(source_message_id);

-- Normalize JSONB values that were previously written as JSON-encoded strings.
-- This keeps canonical state queryable and avoids client/runtime parsing failures.

update public.career_goals
set learning_days = (learning_days #>> '{}')::jsonb
where jsonb_typeof(learning_days)='string';

update public.career_goals
set preferred_formats = (preferred_formats #>> '{}')::jsonb
where jsonb_typeof(preferred_formats)='string';

update public.gap_snapshots
set selected_alternatives = (selected_alternatives #>> '{}')::jsonb
where jsonb_typeof(selected_alternatives)='string';

update public.learning_plans
set rationale = (rationale #>> '{}')::jsonb
where jsonb_typeof(rationale)='string';

update public.learning_plans
set warnings = (warnings #>> '{}')::jsonb
where jsonb_typeof(warnings)='string';

update public.plan_weeks
set focus_skill_ids = (focus_skill_ids #>> '{}')::jsonb
where jsonb_typeof(focus_skill_ids)='string';

update public.skill_assessments
set blueprint_json = (blueprint_json #>> '{}')::jsonb
where jsonb_typeof(blueprint_json)='string';

update public.skill_assessment_questions
set concept_ids = (concept_ids #>> '{}')::jsonb
where jsonb_typeof(concept_ids)='string';

update public.skill_assessment_questions
set options = (options #>> '{}')::jsonb
where options is not null and jsonb_typeof(options)='string';

update public.skill_assessment_questions
set answer_key = (answer_key #>> '{}')::jsonb
where jsonb_typeof(answer_key)='string';

update public.skill_assessment_questions
set rubric = (rubric #>> '{}')::jsonb
where jsonb_typeof(rubric)='string';

update public.skill_assessment_outcomes
set strengths = (strengths #>> '{}')::jsonb
where jsonb_typeof(strengths)='string';

update public.skill_assessment_outcomes
set weaknesses = (weaknesses #>> '{}')::jsonb
where jsonb_typeof(weaknesses)='string';

update public.skill_assessment_outcomes
set concept_summary = (concept_summary #>> '{}')::jsonb
where jsonb_typeof(concept_summary)='string';

update public.skill_assessment_outcomes
set evidence_batch_result = (evidence_batch_result #>> '{}')::jsonb
where evidence_batch_result is not null and jsonb_typeof(evidence_batch_result)='string';

update public.skill_evidence
set metadata = (metadata #>> '{}')::jsonb
where jsonb_typeof(metadata)='string';

update public.agent_events
set entity_refs = (entity_refs #>> '{}')::jsonb
where jsonb_typeof(entity_refs)='string';

update public.agent_events
set evidence_refs = (evidence_refs #>> '{}')::jsonb
where jsonb_typeof(evidence_refs)='string';

update public.agent_events
set metadata = (metadata #>> '{}')::jsonb
where jsonb_typeof(metadata)='string';

update public.plan_diffs
set trigger_refs = (trigger_refs #>> '{}')::jsonb
where jsonb_typeof(trigger_refs)='string';

update public.plan_diffs
set evidence_refs = (evidence_refs #>> '{}')::jsonb
where jsonb_typeof(evidence_refs)='string';

update public.plan_diffs
set operations = (operations #>> '{}')::jsonb
where jsonb_typeof(operations)='string';

update public.plan_diffs
set weekly_impact = (weekly_impact #>> '{}')::jsonb
where jsonb_typeof(weekly_impact)='string';

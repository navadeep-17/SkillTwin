-- Reviewed catalog expansion: canonical definitions only, no learner evidence or role model promotion.
-- Source names: selected O*NET OnLine 2026 skill labels (US-centric);
-- Definitions: SkillTwin-authored, not third-party certified assessments.
-- Preserve existing skill IDs and version 1 rows; add version 2 entries by stable slug.
begin;
lock table public.skills in share row exclusive mode;

-- Refuse silent semantic drift if a proposed slug already exists with another meaning.
do $taxonomy_preflight$
begin
  if exists (
    select 1 from (values
  ('active-listening', 'Active Listening', 'Communication', 'Attentively interpreting another person''s spoken message, confirming understanding and responding appropriately.', 2, true),
  ('critical-thinking', 'Critical Thinking', 'Reasoning', 'Evaluating claims, assumptions and available evidence to reach a reasoned conclusion.', 2, true),
  ('speaking', 'Speaking', 'Communication', 'Communicating information and ideas orally with clarity and attention to the audience.', 2, true),
  ('reading-comprehension', 'Reading Comprehension', 'Communication', 'Understanding and interpreting written instructions, documents and arguments.', 2, true),
  ('monitoring', 'Monitoring', 'Reasoning', 'Tracking progress or changing conditions against criteria and recognizing when corrective action is needed.', 2, true),
  ('writing', 'Writing', 'Communication', 'Expressing ideas clearly in written form for a defined audience and purpose.', 2, true),
  ('active-learning', 'Active Learning', 'Learning', 'Applying newly acquired information and feedback to solve unfamiliar problems and update one''s approach.', 2, true),
  ('social-perceptiveness', 'Social Perceptiveness', 'Interpersonal', 'Noticing relevant social cues and considering how others may interpret an interaction.', 2, true),
  ('coordination', 'Coordination', 'Interpersonal', 'Adjusting one''s work and timing in relation to other people''s actions to achieve a shared objective.', 2, true),
  ('service-orientation', 'Service Orientation', 'Interpersonal', 'Recognizing a person''s needs and responding in a helpful, appropriate and respectful way.', 2, true),
  ('judgment-decision-making', 'Judgment and Decision Making', 'Reasoning', 'Comparing alternatives, trade-offs and possible consequences before making a decision.', 2, true),
  ('complex-problem-solving', 'Complex Problem Solving', 'Reasoning', 'Defining complex problems, considering constraints and evaluating potential solutions.', 2, true),
  ('learning-strategies', 'Learning Strategies', 'Learning', 'Selecting and adapting methods that make instruction, study or practice more effective.', 2, true),
  ('instructing', 'Instructing', 'Education', 'Explaining and demonstrating concepts or procedures and checking another person''s understanding.', 2, true),
  ('time-management', 'Time Management', 'Self Management', 'Prioritizing work and allocating limited time to meet goals and deadlines.', 2, true),
  ('mathematics', 'Mathematics', 'Quantitative', 'Applying mathematical principles and quantitative reasoning to solve appropriate problems.', 2, true),
  ('persuasion', 'Persuasion', 'Interpersonal', 'Presenting reasons and evidence to influence a decision ethically while respecting the other person''s agency.', 2, true)
    ) as expected(slug,canonical_name,category,description,taxonomy_version,is_active)
    join public.skills current on current.slug=expected.slug
    where current.canonical_name<>expected.canonical_name
       or current.category<>expected.category
       or current.description is distinct from expected.description
       or current.taxonomy_version<>expected.taxonomy_version
       or current.is_active is distinct from true
  ) then
    raise exception 'TAXONOMY_V2_EXISTING_SKILL_CONFLICT';
  end if;
end;
$taxonomy_preflight$;

insert into public.skills(slug,canonical_name,category,description,taxonomy_version,is_active) values
  ('active-listening', 'Active Listening', 'Communication', 'Attentively interpreting another person''s spoken message, confirming understanding and responding appropriately.', 2, true),
  ('critical-thinking', 'Critical Thinking', 'Reasoning', 'Evaluating claims, assumptions and available evidence to reach a reasoned conclusion.', 2, true),
  ('speaking', 'Speaking', 'Communication', 'Communicating information and ideas orally with clarity and attention to the audience.', 2, true),
  ('reading-comprehension', 'Reading Comprehension', 'Communication', 'Understanding and interpreting written instructions, documents and arguments.', 2, true),
  ('monitoring', 'Monitoring', 'Reasoning', 'Tracking progress or changing conditions against criteria and recognizing when corrective action is needed.', 2, true),
  ('writing', 'Writing', 'Communication', 'Expressing ideas clearly in written form for a defined audience and purpose.', 2, true),
  ('active-learning', 'Active Learning', 'Learning', 'Applying newly acquired information and feedback to solve unfamiliar problems and update one''s approach.', 2, true),
  ('social-perceptiveness', 'Social Perceptiveness', 'Interpersonal', 'Noticing relevant social cues and considering how others may interpret an interaction.', 2, true),
  ('coordination', 'Coordination', 'Interpersonal', 'Adjusting one''s work and timing in relation to other people''s actions to achieve a shared objective.', 2, true),
  ('service-orientation', 'Service Orientation', 'Interpersonal', 'Recognizing a person''s needs and responding in a helpful, appropriate and respectful way.', 2, true),
  ('judgment-decision-making', 'Judgment and Decision Making', 'Reasoning', 'Comparing alternatives, trade-offs and possible consequences before making a decision.', 2, true),
  ('complex-problem-solving', 'Complex Problem Solving', 'Reasoning', 'Defining complex problems, considering constraints and evaluating potential solutions.', 2, true),
  ('learning-strategies', 'Learning Strategies', 'Learning', 'Selecting and adapting methods that make instruction, study or practice more effective.', 2, true),
  ('instructing', 'Instructing', 'Education', 'Explaining and demonstrating concepts or procedures and checking another person''s understanding.', 2, true),
  ('time-management', 'Time Management', 'Self Management', 'Prioritizing work and allocating limited time to meet goals and deadlines.', 2, true),
  ('mathematics', 'Mathematics', 'Quantitative', 'Applying mathematical principles and quantitative reasoning to solve appropriate problems.', 2, true),
  ('persuasion', 'Persuasion', 'Interpersonal', 'Presenting reasons and evidence to influence a decision ethically while respecting the other person''s agency.', 2, true)
on conflict(slug) do nothing;

-- Fail closed if every candidate was not installed as defined.
do $taxonomy_verify$
begin
  if exists (
    select 1 from (values
  ('active-listening', 'Active Listening', 'Communication', 'Attentively interpreting another person''s spoken message, confirming understanding and responding appropriately.', 2, true),
  ('critical-thinking', 'Critical Thinking', 'Reasoning', 'Evaluating claims, assumptions and available evidence to reach a reasoned conclusion.', 2, true),
  ('speaking', 'Speaking', 'Communication', 'Communicating information and ideas orally with clarity and attention to the audience.', 2, true),
  ('reading-comprehension', 'Reading Comprehension', 'Communication', 'Understanding and interpreting written instructions, documents and arguments.', 2, true),
  ('monitoring', 'Monitoring', 'Reasoning', 'Tracking progress or changing conditions against criteria and recognizing when corrective action is needed.', 2, true),
  ('writing', 'Writing', 'Communication', 'Expressing ideas clearly in written form for a defined audience and purpose.', 2, true),
  ('active-learning', 'Active Learning', 'Learning', 'Applying newly acquired information and feedback to solve unfamiliar problems and update one''s approach.', 2, true),
  ('social-perceptiveness', 'Social Perceptiveness', 'Interpersonal', 'Noticing relevant social cues and considering how others may interpret an interaction.', 2, true),
  ('coordination', 'Coordination', 'Interpersonal', 'Adjusting one''s work and timing in relation to other people''s actions to achieve a shared objective.', 2, true),
  ('service-orientation', 'Service Orientation', 'Interpersonal', 'Recognizing a person''s needs and responding in a helpful, appropriate and respectful way.', 2, true),
  ('judgment-decision-making', 'Judgment and Decision Making', 'Reasoning', 'Comparing alternatives, trade-offs and possible consequences before making a decision.', 2, true),
  ('complex-problem-solving', 'Complex Problem Solving', 'Reasoning', 'Defining complex problems, considering constraints and evaluating potential solutions.', 2, true),
  ('learning-strategies', 'Learning Strategies', 'Learning', 'Selecting and adapting methods that make instruction, study or practice more effective.', 2, true),
  ('instructing', 'Instructing', 'Education', 'Explaining and demonstrating concepts or procedures and checking another person''s understanding.', 2, true),
  ('time-management', 'Time Management', 'Self Management', 'Prioritizing work and allocating limited time to meet goals and deadlines.', 2, true),
  ('mathematics', 'Mathematics', 'Quantitative', 'Applying mathematical principles and quantitative reasoning to solve appropriate problems.', 2, true),
  ('persuasion', 'Persuasion', 'Interpersonal', 'Presenting reasons and evidence to influence a decision ethically while respecting the other person''s agency.', 2, true)
    ) as expected(slug,canonical_name,category,description,taxonomy_version,is_active)
    left join public.skills current on current.slug=expected.slug
    where current.id is null
       or current.canonical_name is distinct from expected.canonical_name
       or current.category is distinct from expected.category
       or current.description is distinct from expected.description
       or current.taxonomy_version is distinct from expected.taxonomy_version
       or current.is_active is distinct from true
  ) then
    raise exception 'TAXONOMY_V2_POSTCHECK_FAILED';
  end if;
end;
$taxonomy_verify$;

-- Deliberately no skill_aliases, user_skills, skill_evidence,
-- role_skill_requirements, assessments, or plan updates.
commit;

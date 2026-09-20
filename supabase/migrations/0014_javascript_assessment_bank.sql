-- Minimum JavaScript assessment bank so Frontend Engineer has an end-to-end Challenge Me path.
insert into public.assessment_question_bank(
  id,skill_id,concept_id,type,difficulty,prompt,options,answer_key,rubric,tags,source,version,is_active
) values
(
  '40000000-0000-0000-0000-000000000201',
  '10000000-0000-0000-0000-000000000016',
  'equality','MCQ',1,
  'Which operator checks equality without performing type coercion in JavaScript?',
  '[{"id":"a","text":"=="},{"id":"b","text":"==="},{"id":"c","text":"="},{"id":"d","text":"!="}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"=== compares both value and type without coercion.","incorrectFeedback":"Use strict equality when you want to avoid implicit type coercion."}'::jsonb,
  '["javascript","equality","language-fundamentals"]'::jsonb,'SEEDED','javascript-bank-e1',true
),
(
  '40000000-0000-0000-0000-000000000202',
  '10000000-0000-0000-0000-000000000016',
  'scope','MCQ',1,
  'Which declaration creates a block-scoped variable that can be reassigned?',
  '[{"id":"a","text":"var"},{"id":"b","text":"const"},{"id":"c","text":"let"},{"id":"d","text":"function"}]'::jsonb,
  '{"correctOptionId":"c"}'::jsonb,
  '{"correctFeedback":"let is block scoped and allows reassignment.","incorrectFeedback":"Distinguish block scope and reassignment rules for let, const, and var."}'::jsonb,
  '["javascript","scope","let"]'::jsonb,'SEEDED','javascript-bank-e1',true
),
(
  '40000000-0000-0000-0000-000000000203',
  '10000000-0000-0000-0000-000000000016',
  'promises','MCQ',2,
  'What does Promise.all do when one input promise rejects?',
  '[{"id":"a","text":"It ignores the rejection and resolves the others."},{"id":"b","text":"It waits forever."},{"id":"c","text":"The returned promise rejects."},{"id":"d","text":"It converts the rejection to null."}]'::jsonb,
  '{"correctOptionId":"c"}'::jsonb,
  '{"correctFeedback":"Promise.all rejects when an input promise rejects.","incorrectFeedback":"Promise.all combines promises but does not suppress a rejection."}'::jsonb,
  '["javascript","promises","async"]'::jsonb,'SEEDED','javascript-bank-e1',true
),
(
  '40000000-0000-0000-0000-000000000204',
  '10000000-0000-0000-0000-000000000016',
  'array-transform','MCQ',2,
  'Which array method returns a new array by transforming every element?',
  '[{"id":"a","text":"forEach"},{"id":"b","text":"map"},{"id":"c","text":"find"},{"id":"d","text":"some"}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"map returns a new array containing the transformed values.","incorrectFeedback":"Choose the array operation designed to transform each element into a new array."}'::jsonb,
  '["javascript","arrays","map"]'::jsonb,'SEEDED','javascript-bank-e1',true
)
on conflict(id) do update set
  prompt=excluded.prompt,
  options=excluded.options,
  answer_key=excluded.answer_key,
  rubric=excluded.rubric,
  tags=excluded.tags,
  difficulty=excluded.difficulty,
  version=excluded.version,
  is_active=true;

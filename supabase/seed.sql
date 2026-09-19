-- Deterministic SkillTwin catalog + Backend Engineer v1 role seed.

insert into public.skills(id, slug, canonical_name, category, description, taxonomy_version, is_active) values
('10000000-0000-0000-0000-000000000001','python','Python','Programming','General-purpose programming language used in backend systems.',1,true),
('10000000-0000-0000-0000-000000000002','java','Java','Programming','General-purpose language commonly used for production backend systems.',1,true),
('10000000-0000-0000-0000-000000000003','nodejs','Node.js','Programming','JavaScript runtime for server-side application development.',1,true),
('10000000-0000-0000-0000-000000000004','sql','SQL','Databases','Relational querying and data manipulation.',1,true),
('10000000-0000-0000-0000-000000000005','git','Git','Engineering','Distributed version-control workflows.',1,true),
('10000000-0000-0000-0000-000000000006','http','HTTP','Backend Fundamentals','HTTP methods, status codes, headers and semantics.',1,true),
('10000000-0000-0000-0000-000000000007','rest-api','REST APIs','Backend Fundamentals','Resource-oriented REST API design and implementation.',1,true),
('10000000-0000-0000-0000-000000000008','authentication','Authentication','Backend Fundamentals','Authentication and authorization fundamentals.',1,true),
('10000000-0000-0000-0000-000000000009','docker','Docker','Infrastructure','Container images, containers and Docker workflows.',1,true),
('10000000-0000-0000-0000-000000000010','linux','Linux','Infrastructure','Linux command-line and operating-system fundamentals.',1,true),
('10000000-0000-0000-0000-000000000011','testing','Testing','Engineering','Automated testing fundamentals.',1,true),
('10000000-0000-0000-0000-000000000012','system-design','System Design','Engineering','Scalable service design and architecture trade-offs.',1,true),
('10000000-0000-0000-0000-000000000013','cloud','Cloud Fundamentals','Infrastructure','Cloud infrastructure and deployment fundamentals.',1,true)
on conflict (id) do update set slug=excluded.slug,canonical_name=excluded.canonical_name,category=excluded.category,description=excluded.description,is_active=true;

insert into public.skill_aliases(skill_id, alias, normalized_alias) values
('10000000-0000-0000-0000-000000000001','Python','python'),
('10000000-0000-0000-0000-000000000002','Java','java'),
('10000000-0000-0000-0000-000000000003','Node','node'),
('10000000-0000-0000-0000-000000000003','Node.js','node.js'),
('10000000-0000-0000-0000-000000000004','SQL','sql'),
('10000000-0000-0000-0000-000000000005','Git','git'),
('10000000-0000-0000-0000-000000000006','HTTP','http'),
('10000000-0000-0000-0000-000000000007','REST','rest'),
('10000000-0000-0000-0000-000000000007','REST API','rest api'),
('10000000-0000-0000-0000-000000000007','RESTful APIs','restful apis'),
('10000000-0000-0000-0000-000000000008','JWT Authentication','jwt authentication'),
('10000000-0000-0000-0000-000000000009','Docker','docker'),
('10000000-0000-0000-0000-000000000010','Linux','linux'),
('10000000-0000-0000-0000-000000000011','Automated Testing','automated testing'),
('10000000-0000-0000-0000-000000000012','System Design','system design'),
('10000000-0000-0000-0000-000000000013','Cloud','cloud')
on conflict (normalized_alias) do update set alias=excluded.alias,skill_id=excluded.skill_id;

insert into public.target_roles(id,slug,name,family) values
('20000000-0000-0000-0000-000000000001','backend-engineer','Backend Engineer','Software Engineering')
on conflict(id) do update set slug=excluded.slug,name=excluded.name,family=excluded.family;

insert into public.role_versions(id,role_id,version,source,status,schema_version) values
('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'SEEDED','ACTIVE','role-c1')
on conflict(id) do nothing;

insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values
('22000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Backend programming language','ANY_OF',1.00),
('22000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000001','HTTP fundamentals','SINGLE',1.00),
('22000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001','SQL','SINGLE',0.75),
('22000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000001','Git','SINGLE',0.45),
('22000000-0000-0000-0000-000000000005','21000000-0000-0000-0000-000000000001','REST APIs','SINGLE',1.00),
('22000000-0000-0000-0000-000000000006','21000000-0000-0000-0000-000000000001','Authentication','SINGLE',0.75),
('22000000-0000-0000-0000-000000000007','21000000-0000-0000-0000-000000000001','Testing','SINGLE',0.75),
('22000000-0000-0000-0000-000000000008','21000000-0000-0000-0000-000000000001','Linux','SINGLE',0.75),
('22000000-0000-0000-0000-000000000009','21000000-0000-0000-0000-000000000001','Docker','SINGLE',0.75),
('22000000-0000-0000-0000-000000000010','21000000-0000-0000-0000-000000000001','System Design','SINGLE',0.75),
('22000000-0000-0000-0000-000000000011','21000000-0000-0000-0000-000000000001','Cloud Fundamentals','SINGLE',0.45)
on conflict(id) do nothing;

insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values
('23000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',2.0,1.00,'CORE',1,false,'One production backend language is foundational.'),
('23000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',2.0,1.00,'CORE',1,false,'One production backend language is foundational.'),
('23000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003',2.0,1.00,'CORE',1,true,'One production backend language is foundational.'),
('23000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006',2.0,1.00,'CORE',1,true,'HTTP semantics underpin backend APIs.'),
('23000000-0000-0000-0000-000000000005','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',2.0,0.75,'IMPORTANT',1,true,'Backend roles commonly require relational data access.'),
('23000000-0000-0000-0000-000000000006','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005',1.5,0.45,'SUPPORTING',1,true,'Version-control fluency supports engineering work.'),
('23000000-0000-0000-0000-000000000007','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000007',2.0,1.00,'CORE',2,true,'REST API design is central to backend development.'),
('23000000-0000-0000-0000-000000000008','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000008',1.5,0.75,'IMPORTANT',2,true,'Backend services must protect access.'),
('23000000-0000-0000-0000-000000000009','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000011',1.5,0.75,'IMPORTANT',2,true,'Automated tests support reliable changes.'),
('23000000-0000-0000-0000-000000000010','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000010',1.5,0.75,'IMPORTANT',1,true,'Linux fundamentals support development and deployment.'),
('23000000-0000-0000-0000-000000000011','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000009',1.5,0.75,'IMPORTANT',3,true,'Containers make backend services portable.'),
('23000000-0000-0000-0000-000000000012','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000012',1.5,0.75,'IMPORTANT',3,true,'System design builds architectural reasoning.'),
('23000000-0000-0000-0000-000000000013','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000013',1.0,0.45,'SUPPORTING',4,true,'Cloud fundamentals support deployment breadth.')
on conflict(id) do nothing;

insert into public.role_dependency_edges(role_version_id,prerequisite_requirement_id,dependent_requirement_id,edge_type) values
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000004','23000000-0000-0000-0000-000000000007','HARD'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000003','23000000-0000-0000-0000-000000000007','SOFT'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000007','23000000-0000-0000-0000-000000000008','HARD'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000007','23000000-0000-0000-0000-000000000009','SOFT'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000010','23000000-0000-0000-0000-000000000011','HARD'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000007','23000000-0000-0000-0000-000000000012','HARD'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000005','23000000-0000-0000-0000-000000000012','HARD'),
('21000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000011','23000000-0000-0000-0000-000000000013','SOFT')
on conflict(role_version_id,prerequisite_requirement_id,dependent_requirement_id) do update set edge_type=excluded.edge_type;


-- Verified learning-resource catalog for deterministic planner output.
insert into public.learning_resources(
  id,title,provider,url,tags,levels,format,duration_minutes,quality,is_verified,status,catalog_version,last_verified_at
) values
(
  '30000000-0000-0000-0000-000000000001',
  'HTTP request methods',
  'MDN Web Docs',
  'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods',
  '["http","methods","idempotency","safe-methods"]'::jsonb,
  '["BEGINNER","INTERMEDIATE"]'::jsonb,
  'DOCS',35,0.98,true,'ACTIVE','resource-catalog-d2',now()
),
(
  '30000000-0000-0000-0000-000000000002',
  'HTTP response status codes',
  'MDN Web Docs',
  'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status',
  '["http","status-codes","responses"]'::jsonb,
  '["BEGINNER","INTERMEDIATE"]'::jsonb,
  'DOCS',30,0.98,true,'ACTIVE','resource-catalog-d2',now()
),
(
  '30000000-0000-0000-0000-000000000003',
  'REST',
  'MDN Web Docs',
  'https://developer.mozilla.org/en-US/docs/Glossary/REST',
  '["rest-api","resource-design","http"]'::jsonb,
  '["BEGINNER","INTERMEDIATE"]'::jsonb,
  'DOCS',25,0.95,true,'ACTIVE','resource-catalog-d2',now()
),
(
  '30000000-0000-0000-0000-000000000004',
  'Get started with Docker',
  'Docker Docs',
  'https://docs.docker.com/get-started/',
  '["docker","containers","images"]'::jsonb,
  '["BEGINNER","INTERMEDIATE"]'::jsonb,
  'DOCS',45,0.98,true,'ACTIVE','resource-catalog-d2',now()
)
on conflict(url) do update set
  title=excluded.title,
  provider=excluded.provider,
  tags=excluded.tags,
  levels=excluded.levels,
  format=excluded.format,
  duration_minutes=excluded.duration_minutes,
  quality=excluded.quality,
  is_verified=true,
  status='ACTIVE',
  catalog_version=excluded.catalog_version,
  last_verified_at=now();


insert into public.assessment_question_bank(
  id,skill_id,concept_id,type,difficulty,prompt,options,answer_key,rubric,tags,source,version,is_active
) values
(
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  'http-method-semantics','MCQ',1,
  'Which HTTP method is conventionally used to retrieve a resource without changing server state?',
  '[{"id":"a","text":"POST"},{"id":"b","text":"GET"},{"id":"c","text":"PATCH"},{"id":"d","text":"DELETE"}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"GET is the conventional safe retrieval method.","incorrectFeedback":"Review HTTP method semantics: retrieval should use a safe read method."}'::jsonb,
  '["rest-api","http","methods"]'::jsonb,'SEEDED','adaptive-bank-e2',true
),
(
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000007',
  'status-codes','MCQ',2,
  'A REST API successfully creates a new resource. Which response status is the most specific conventional choice?',
  '[{"id":"a","text":"200 OK"},{"id":"b","text":"201 Created"},{"id":"c","text":"204 No Content"},{"id":"d","text":"304 Not Modified"}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"201 Created explicitly represents successful resource creation.","incorrectFeedback":"For a successful create operation, prefer the status that explicitly communicates creation."}'::jsonb,
  '["rest-api","http","status-codes"]'::jsonb,'SEEDED','adaptive-bank-e2',true
),
(
  '40000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000007',
  'resource-design','MCQ',2,
  'Which endpoint shape best follows resource-oriented REST conventions for retrieving order 42?',
  '[{"id":"a","text":"/getOrder?id=42"},{"id":"b","text":"/orders/42"},{"id":"c","text":"/orders/get/42"},{"id":"d","text":"/fetch-order/42"}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"Resource-oriented URLs usually identify the noun and resource identifier directly.","incorrectFeedback":"Prefer noun-based resource paths rather than action verbs in the URL."}'::jsonb,
  '["rest-api","resource-design"]'::jsonb,'SEEDED','adaptive-bank-e2',true
),
(
  '40000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000007',
  'put-vs-patch','MCQ',3,
  'A client wants to change only a user''s displayName while leaving unspecified fields untouched. Which method best communicates that intent?',
  '[{"id":"a","text":"PUT"},{"id":"b","text":"PATCH"},{"id":"c","text":"GET"},{"id":"d","text":"HEAD"}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"PATCH is conventionally used for partial modification.","incorrectFeedback":"Distinguish complete replacement semantics from a partial update."}'::jsonb,
  '["rest-api","http","put-patch"]'::jsonb,'SEEDED','adaptive-bank-e2',true
),
(
  '40000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000007',
  'idempotency','MCQ',3,
  'Which statement best describes an idempotent HTTP operation?',
  '[{"id":"a","text":"It must always return the same response body."},{"id":"b","text":"Repeating the same request has the same intended server-side effect as making it once."},{"id":"c","text":"It never changes server state."},{"id":"d","text":"It can only be called once per client."}]'::jsonb,
  '{"correctOptionId":"b"}'::jsonb,
  '{"correctFeedback":"Idempotency concerns the intended server-side effect of repeated identical requests.","incorrectFeedback":"Idempotency does not mean read-only and does not require an identical response body."}'::jsonb,
  '["rest-api","http","idempotency"]'::jsonb,'SEEDED','adaptive-bank-e2',true
),
(
  '40000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007',
  'error-semantics','MCQ',2,
  'An authenticated user requests a resource that exists but they are not allowed to access. Which status usually communicates this most directly?',
  '[{"id":"a","text":"400 Bad Request"},{"id":"b","text":"401 Unauthorized"},{"id":"c","text":"403 Forbidden"},{"id":"d","text":"404 Not Found"}]'::jsonb,
  '{"correctOptionId":"c"}'::jsonb,
  '{"correctFeedback":"403 Forbidden means the server understood the request but refuses authorization.","incorrectFeedback":"Differentiate authentication failure from an authenticated caller lacking permission."}'::jsonb,
  '["rest-api","http","authorization","status-codes"]'::jsonb,'SEEDED','adaptive-bank-e2',true
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


-- Release metadata is idempotently refreshed when seed.sql is replayed.
insert into public.system_metadata(key,value) values
('seed_version','seed-2026-09-19-v2'),
('resource_catalog_version','resource-catalog-d2'),
('demo_fixture_version','demo-backend-v1')
on conflict(key) do update set value=excluded.value,updated_at=now();

-- Deterministic global catalog seed for the hackathon path.
insert into public.skills(id, slug, canonical_name, category, description)
values
  ('10000000-0000-0000-0000-000000000001','http','HTTP','Backend Fundamentals','HTTP methods, semantics, status codes and request/response behavior'),
  ('10000000-0000-0000-0000-000000000002','rest-api','REST APIs','Backend Fundamentals','Resource-oriented HTTP API design'),
  ('10000000-0000-0000-0000-000000000003','authentication','Authentication','Backend Fundamentals','Identity, sessions, tokens and authorization boundaries'),
  ('10000000-0000-0000-0000-000000000004','sql','SQL','Databases','Relational querying and data manipulation'),
  ('10000000-0000-0000-0000-000000000005','git','Git','Engineering','Version control workflows'),
  ('10000000-0000-0000-0000-000000000006','linux','Linux','Infrastructure','Linux shell and operating environment fundamentals'),
  ('10000000-0000-0000-0000-000000000007','docker','Docker','Infrastructure','Containers, images and Docker workflows'),
  ('10000000-0000-0000-0000-000000000008','system-design','System Design','Engineering','Scalable system design fundamentals')
on conflict (id) do update
set canonical_name = excluded.canonical_name,
    category = excluded.category,
    description = excluded.description,
    is_active = true;

insert into public.skill_aliases(skill_id, alias, normalized_alias)
values
  ('10000000-0000-0000-0000-000000000001','HTTP','http'),
  ('10000000-0000-0000-0000-000000000002','REST','rest'),
  ('10000000-0000-0000-0000-000000000002','REST API','rest api'),
  ('10000000-0000-0000-0000-000000000002','RESTful APIs','restful apis'),
  ('10000000-0000-0000-0000-000000000003','JWT Authentication','jwt authentication'),
  ('10000000-0000-0000-0000-000000000004','Structured Query Language','structured query language'),
  ('10000000-0000-0000-0000-000000000007','Containers','containers'),
  ('10000000-0000-0000-0000-000000000008','System Design','system design')
on conflict (normalized_alias) do nothing;

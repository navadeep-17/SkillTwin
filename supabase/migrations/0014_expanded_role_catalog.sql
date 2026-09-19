-- Expanded canonical taxonomy and seeded role catalog from Component C.

insert into public.skills(id,slug,canonical_name,category,description,taxonomy_version,is_active) values
('10000000-0000-0000-0000-000000000014','html','HTML','Frontend','Semantic HTML structure and document fundamentals.',1,true),
('10000000-0000-0000-0000-000000000015','css','CSS','Frontend','Responsive layout, styling, and modern CSS fundamentals.',1,true),
('10000000-0000-0000-0000-000000000016','javascript','JavaScript','Programming','Browser and general JavaScript language fundamentals.',1,true),
('10000000-0000-0000-0000-000000000017','typescript','TypeScript','Programming','Typed JavaScript for maintainable applications.',1,true),
('10000000-0000-0000-0000-000000000018','react','React','Frontend','Component-based frontend application development.',1,true),
('10000000-0000-0000-0000-000000000019','accessibility','Web Accessibility','Frontend','Accessible interaction, semantics, keyboard and ARIA fundamentals.',1,true),
('10000000-0000-0000-0000-000000000020','web-performance','Web Performance','Frontend','Core browser performance, loading and rendering optimization.',1,true),
('10000000-0000-0000-0000-000000000021','excel','Excel / Spreadsheets','Analytics','Spreadsheet analysis, formulas, pivots and data preparation.',1,true),
('10000000-0000-0000-0000-000000000022','statistics','Statistics','Analytics','Descriptive statistics, inference and uncertainty fundamentals.',1,true),
('10000000-0000-0000-0000-000000000023','data-visualization','Data Visualization','Analytics','Choosing and constructing clear analytical visualizations.',1,true),
('10000000-0000-0000-0000-000000000024','power-bi','Power BI','Analytics','Business intelligence modeling and dashboarding.',1,true),
('10000000-0000-0000-0000-000000000025','pandas','Pandas','Data','Tabular data transformation and analysis in Python.',1,true),
('10000000-0000-0000-0000-000000000026','numpy','NumPy','Data','Numerical computing arrays and vectorized operations.',1,true),
('10000000-0000-0000-0000-000000000027','machine-learning','Machine Learning','ML','Supervised/unsupervised learning concepts and workflow.',1,true),
('10000000-0000-0000-0000-000000000028','scikit-learn','scikit-learn','ML','Classical ML model building with scikit-learn.',1,true),
('10000000-0000-0000-0000-000000000029','model-evaluation','Model Evaluation','ML','Validation, metrics, leakage and generalization assessment.',1,true),
('10000000-0000-0000-0000-000000000030','feature-engineering','Feature Engineering','ML','Feature preparation, encoding and transformation.',1,true),
('10000000-0000-0000-0000-000000000031','product-strategy','Product Strategy','Product','Product goals, value proposition and strategic framing.',1,true),
('10000000-0000-0000-0000-000000000032','user-research','User Research','Product','Problem discovery, interviews and qualitative research synthesis.',1,true),
('10000000-0000-0000-0000-000000000033','product-analytics','Product Analytics','Product','Metrics, funnels, cohorts and product decision analysis.',1,true),
('10000000-0000-0000-0000-000000000034','prioritization','Prioritization','Product','Structured product prioritization and trade-off reasoning.',1,true),
('10000000-0000-0000-0000-000000000035','roadmapping','Product Roadmapping','Product','Outcome-oriented roadmap planning and sequencing.',1,true),
('10000000-0000-0000-0000-000000000036','stakeholder-management','Stakeholder Management','Product','Alignment, communication and decision management across stakeholders.',1,true)
on conflict(id) do update set
 slug=excluded.slug,canonical_name=excluded.canonical_name,category=excluded.category,description=excluded.description,is_active=true;

insert into public.skill_aliases(skill_id,alias,normalized_alias) values
('10000000-0000-0000-0000-000000000014','HTML','html'),
('10000000-0000-0000-0000-000000000015','CSS','css'),
('10000000-0000-0000-0000-000000000016','JavaScript','javascript'),
('10000000-0000-0000-0000-000000000016','JS','js'),
('10000000-0000-0000-0000-000000000017','TypeScript','typescript'),
('10000000-0000-0000-0000-000000000017','TS','ts'),
('10000000-0000-0000-0000-000000000018','React','react'),
('10000000-0000-0000-0000-000000000019','Accessibility','accessibility'),
('10000000-0000-0000-0000-000000000019','A11y','a11y'),
('10000000-0000-0000-0000-000000000020','Web Performance','web performance'),
('10000000-0000-0000-0000-000000000021','Excel','excel'),
('10000000-0000-0000-0000-000000000021','Spreadsheets','spreadsheets'),
('10000000-0000-0000-0000-000000000022','Statistics','statistics'),
('10000000-0000-0000-0000-000000000023','Data Visualization','data visualization'),
('10000000-0000-0000-0000-000000000024','Power BI','power bi'),
('10000000-0000-0000-0000-000000000025','Pandas','pandas'),
('10000000-0000-0000-0000-000000000026','NumPy','numpy'),
('10000000-0000-0000-0000-000000000027','Machine Learning','machine learning'),
('10000000-0000-0000-0000-000000000027','ML','ml'),
('10000000-0000-0000-0000-000000000028','scikit-learn','scikit-learn'),
('10000000-0000-0000-0000-000000000028','sklearn','sklearn'),
('10000000-0000-0000-0000-000000000029','Model Evaluation','model evaluation'),
('10000000-0000-0000-0000-000000000030','Feature Engineering','feature engineering'),
('10000000-0000-0000-0000-000000000031','Product Strategy','product strategy'),
('10000000-0000-0000-0000-000000000032','User Research','user research'),
('10000000-0000-0000-0000-000000000033','Product Analytics','product analytics'),
('10000000-0000-0000-0000-000000000034','Prioritization','prioritization'),
('10000000-0000-0000-0000-000000000035','Roadmapping','roadmapping'),
('10000000-0000-0000-0000-000000000036','Stakeholder Management','stakeholder management')
on conflict(normalized_alias) do update set alias=excluded.alias,skill_id=excluded.skill_id;

insert into public.target_roles(id,slug,name,family) values
('20000000-0000-0000-0000-000000000002','frontend-engineer','Frontend Engineer','Software Engineering'),
('20000000-0000-0000-0000-000000000003','data-analyst','Data Analyst','Data & Analytics'),
('20000000-0000-0000-0000-000000000004','ml-engineer','ML Engineer','Machine Learning'),
('20000000-0000-0000-0000-000000000005','product-manager','Product Manager','Product')
on conflict(id) do update set slug=excluded.slug,name=excluded.name,family=excluded.family;

insert into public.role_versions(id,role_id,version,source,status,schema_version) values
('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'SEEDED','ACTIVE','role-c1'),
('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',1,'SEEDED','ACTIVE','role-c1'),
('21000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004',1,'SEEDED','ACTIVE','role-c1'),
('21000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000005',1,'SEEDED','ACTIVE','role-c1')
on conflict(id) do nothing;

-- Frontend Engineer
insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values
('22000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000002','Web foundations','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000002','Typed application language','ANY_OF',1.00),
('22000000-0000-0000-0000-000000000103','21000000-0000-0000-0000-000000000002','Frontend framework','SINGLE',1.00),
('22000000-0000-0000-0000-000000000104','21000000-0000-0000-0000-000000000002','Quality and delivery','ALL_OF',0.75)
on conflict(id) do nothing;

insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values
('23000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000014',2.0,0.9,'CORE',1,true,'Semantic HTML is foundational.'),
('23000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000015',2.0,0.9,'CORE',1,true,'Responsive CSS is foundational.'),
('23000000-0000-0000-0000-000000000103','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000016',2.2,1.0,'CORE',1,true,'Modern frontend work requires JavaScript fluency.'),
('23000000-0000-0000-0000-000000000104','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000017',2.0,1.0,'CORE',1,false,'TypeScript is a common production alternative.'),
('23000000-0000-0000-0000-000000000105','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000103','10000000-0000-0000-0000-000000000018',2.0,1.0,'CORE',2,true,'React demonstrates component application development.'),
('23000000-0000-0000-0000-000000000106','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000104','10000000-0000-0000-0000-000000000019',1.5,0.7,'IMPORTANT',2,true,'Accessible interactions are production requirements.'),
('23000000-0000-0000-0000-000000000107','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000104','10000000-0000-0000-0000-000000000020',1.5,0.65,'IMPORTANT',3,true,'Performance affects production UX.'),
('23000000-0000-0000-0000-000000000108','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000104','10000000-0000-0000-0000-000000000005',1.5,0.55,'SUPPORTING',1,true,'Git supports team delivery.'),
('23000000-0000-0000-0000-000000000109','21000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000104','10000000-0000-0000-0000-000000000011',1.5,0.65,'IMPORTANT',2,true,'Testing protects frontend changes.')
on conflict(id) do nothing;

insert into public.role_dependency_edges(role_version_id,prerequisite_requirement_id,dependent_requirement_id,edge_type) values
('21000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000103','23000000-0000-0000-0000-000000000105','HARD'),
('21000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000101','23000000-0000-0000-0000-000000000106','SOFT')
on conflict(role_version_id,prerequisite_requirement_id,dependent_requirement_id) do update set edge_type=excluded.edge_type;

-- Data Analyst
insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values
('22000000-0000-0000-0000-000000000201','21000000-0000-0000-0000-000000000003','Querying and wrangling','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000202','21000000-0000-0000-0000-000000000003','Analytical reasoning','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000203','21000000-0000-0000-0000-000000000003','BI tooling','ANY_OF',0.75)
on conflict(id) do nothing;

insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values
('23000000-0000-0000-0000-000000000201','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000201','10000000-0000-0000-0000-000000000004',2.2,1.0,'CORE',1,true,'SQL is a primary analysis skill.'),
('23000000-0000-0000-0000-000000000202','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000201','10000000-0000-0000-0000-000000000021',2.0,0.85,'CORE',1,true,'Spreadsheets remain common analytical tools.'),
('23000000-0000-0000-0000-000000000203','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000202','10000000-0000-0000-0000-000000000022',2.0,0.9,'CORE',1,true,'Statistics supports reliable interpretation.'),
('23000000-0000-0000-0000-000000000204','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000202','10000000-0000-0000-0000-000000000023',2.0,0.9,'CORE',2,true,'Analysts must communicate findings visually.'),
('23000000-0000-0000-0000-000000000205','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000203','10000000-0000-0000-0000-000000000024',1.8,0.75,'IMPORTANT',2,true,'Power BI is a common dashboarding tool.'),
('23000000-0000-0000-0000-000000000206','21000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000203','10000000-0000-0000-0000-000000000025',1.8,0.75,'IMPORTANT',2,false,'Pandas is a useful programmatic analysis alternative.')
on conflict(id) do nothing;

-- ML Engineer
insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values
('22000000-0000-0000-0000-000000000301','21000000-0000-0000-0000-000000000004','Programming and data','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000302','21000000-0000-0000-0000-000000000004','ML workflow','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000303','21000000-0000-0000-0000-000000000004','Delivery','ALL_OF',0.75)
on conflict(id) do nothing;

insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values
('23000000-0000-0000-0000-000000000301','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000301','10000000-0000-0000-0000-000000000001',2.2,1.0,'CORE',1,true,'Python is foundational for this seeded ML role.'),
('23000000-0000-0000-0000-000000000302','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000301','10000000-0000-0000-0000-000000000026',1.8,0.8,'IMPORTANT',1,true,'NumPy supports numerical workflows.'),
('23000000-0000-0000-0000-000000000303','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000301','10000000-0000-0000-0000-000000000025',2.0,0.85,'CORE',1,true,'Pandas supports tabular ML preparation.'),
('23000000-0000-0000-0000-000000000304','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000302','10000000-0000-0000-0000-000000000027',2.0,1.0,'CORE',2,true,'Core ML concepts drive model selection and reasoning.'),
('23000000-0000-0000-0000-000000000305','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000302','10000000-0000-0000-0000-000000000028',1.8,0.85,'IMPORTANT',2,true,'scikit-learn is a practical classical ML toolkit.'),
('23000000-0000-0000-0000-000000000306','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000302','10000000-0000-0000-0000-000000000029',2.0,0.95,'CORE',2,true,'Evaluation prevents misleading models.'),
('23000000-0000-0000-0000-000000000307','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000302','10000000-0000-0000-0000-000000000030',1.7,0.75,'IMPORTANT',2,true,'Feature engineering improves applied workflows.'),
('23000000-0000-0000-0000-000000000308','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000303','10000000-0000-0000-0000-000000000009',1.4,0.65,'IMPORTANT',3,true,'Containers support reproducible model services.'),
('23000000-0000-0000-0000-000000000309','21000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000303','10000000-0000-0000-0000-000000000013',1.3,0.6,'SUPPORTING',3,true,'Cloud fundamentals support deployment.')
on conflict(id) do nothing;

-- Product Manager
insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values
('22000000-0000-0000-0000-000000000401','21000000-0000-0000-0000-000000000005','Discovery','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000402','21000000-0000-0000-0000-000000000005','Decision making','ALL_OF',1.00),
('22000000-0000-0000-0000-000000000403','21000000-0000-0000-0000-000000000005','Execution and alignment','ALL_OF',0.90)
on conflict(id) do nothing;

insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values
('23000000-0000-0000-0000-000000000401','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000401','10000000-0000-0000-0000-000000000032',2.0,1.0,'CORE',1,true,'Discovery starts from user problems.'),
('23000000-0000-0000-0000-000000000402','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000401','10000000-0000-0000-0000-000000000031',2.0,0.95,'CORE',1,true,'Strategy connects problems to outcomes.'),
('23000000-0000-0000-0000-000000000403','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000402','10000000-0000-0000-0000-000000000033',1.8,0.9,'CORE',1,true,'Analytics supports product decisions.'),
('23000000-0000-0000-0000-000000000404','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000402','10000000-0000-0000-0000-000000000034',2.0,0.95,'CORE',2,true,'Prioritization makes trade-offs explicit.'),
('23000000-0000-0000-0000-000000000405','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000403','10000000-0000-0000-0000-000000000035',1.8,0.85,'IMPORTANT',2,true,'Roadmapping sequences outcomes and learning.'),
('23000000-0000-0000-0000-000000000406','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000403','10000000-0000-0000-0000-000000000036',2.0,0.9,'CORE',2,true,'Stakeholder alignment is central to execution.'),
('23000000-0000-0000-0000-000000000407','21000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000403','10000000-0000-0000-0000-000000000004',1.2,0.45,'SUPPORTING',3,true,'Basic SQL can support self-serve product analysis.')
on conflict(id) do nothing;

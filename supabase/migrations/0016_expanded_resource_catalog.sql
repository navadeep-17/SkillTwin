-- Expanded verified resource catalog. URLs are manually curated stable/official documentation.
update public.learning_resources
set catalog_version='resource-catalog-d2'
where catalog_version='resource-catalog-d1';

insert into public.learning_resources(
  id,title,provider,url,tags,levels,format,duration_minutes,quality,is_verified,status,catalog_version,last_verified_at
) values
('30000000-0000-0000-0000-000000000101','React Learn','React Docs','https://react.dev/learn',
 '["react","javascript","components","state"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',60,0.99,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000102','TypeScript Handbook','TypeScript Docs','https://www.typescriptlang.org/docs/handbook/intro',
 '["typescript","javascript","types"]'::jsonb,'["BEGINNER","INTERMEDIATE","ADVANCED"]'::jsonb,'DOCS',75,0.99,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000103','JavaScript Guide','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
 '["javascript","programming"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',75,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000104','HTML: Structuring the Web','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content',
 '["html","semantic-html"]'::jsonb,'["BEGINNER"]'::jsonb,'DOCS',50,0.97,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000105','CSS Styling Basics','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics',
 '["css","responsive-design"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',55,0.97,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000106','Web Accessibility','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Web/Accessibility',
 '["accessibility","a11y","html"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',45,0.97,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000107','Web Performance','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Web/Performance',
 '["web-performance","performance","frontend"]'::jsonb,'["INTERMEDIATE","ADVANCED"]'::jsonb,'DOCS',55,0.96,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000108','Python Tutorial','Python Docs','https://docs.python.org/3/tutorial/index.html',
 '["python","programming"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',75,0.99,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000109','PostgreSQL Tutorial','PostgreSQL Docs','https://www.postgresql.org/docs/17/tutorial.html',
 '["sql","databases","joins","aggregation"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',70,0.99,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000110','Pro Git','Git','https://git-scm.com/book/en/v2',
 '["git","version-control"]'::jsonb,'["BEGINNER","INTERMEDIATE","ADVANCED"]'::jsonb,'DOCS',60,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000111','pandas Getting Started','pandas Docs','https://pandas.pydata.org/docs/getting_started/',
 '["pandas","data-analysis","python"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',55,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000112','NumPy Quickstart','NumPy Docs','https://numpy.org/doc/stable/user/quickstart.html',
 '["numpy","python","numerical-computing"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',45,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000113','scikit-learn Getting Started','scikit-learn Docs','https://scikit-learn.org/stable/getting_started.html',
 '["scikit-learn","machine-learning","model-evaluation"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',60,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000114','Power BI Learning','Microsoft Learn','https://learn.microsoft.com/en-us/training/powerplatform/power-bi/',
 '["power-bi","data-visualization","analytics"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',60,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000115','Linux Command Line Basics','Ubuntu Documentation','https://documentation.ubuntu.com/server/tutorial/basic-installation/',
 '["linux","command-line"]'::jsonb,'["BEGINNER"]'::jsonb,'DOCS',40,0.92,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000116','Docker Networking','Docker Docs','https://docs.docker.com/engine/network/',
 '["docker","networking","containers"]'::jsonb,'["INTERMEDIATE","ADVANCED"]'::jsonb,'DOCS',45,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000117','HTTP Caching','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
 '["http","caching","headers"]'::jsonb,'["INTERMEDIATE"]'::jsonb,'DOCS',35,0.98,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000118','Authentication overview','MDN Web Docs','https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication',
 '["authentication","http","security"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'DOCS',35,0.96,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000119','Product Management','Atlassian','https://www.atlassian.com/agile/product-management',
 '["product-strategy","prioritization","roadmapping"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'ARTICLE',45,0.90,true,'ACTIVE','resource-catalog-d2',now()),
('30000000-0000-0000-0000-000000000120','User Interviews','Nielsen Norman Group','https://www.nngroup.com/articles/user-interviews/',
 '["user-research","interviews","product"]'::jsonb,'["BEGINNER","INTERMEDIATE"]'::jsonb,'ARTICLE',35,0.94,true,'ACTIVE','resource-catalog-d2',now())
on conflict(url) do update set
 title=excluded.title,provider=excluded.provider,tags=excluded.tags,levels=excluded.levels,format=excluded.format,
 duration_minutes=excluded.duration_minutes,quality=excluded.quality,is_verified=true,status='ACTIVE',
 catalog_version=excluded.catalog_version,last_verified_at=now();

-- SkillTwin Arena: real-user 1v1 practice only; no assessment/proficiency writes.
-- Executed by database owner after code review. Safe to re-run no learner reset.
begin;

create table if not exists public.arena_questions (
  topic text not null check (topic in ('python','sql','javascript')),
  question_no smallint not null check (question_no between 1 and 5),
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_option smallint not null check (correct_option between 0 and 3),
  primary key (topic,question_no)
);
create table if not exists public.arena_matches (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('python','sql','javascript')),
  player_a uuid not null references auth.users(id) on delete cascade,
  player_b uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default clock_timestamp(),
  constraint arena_distinct_players check (player_a <> player_b)
);
create index if not exists arena_matches_player_a_idx on public.arena_matches(player_a,started_at desc);
create index if not exists arena_matches_player_b_idx on public.arena_matches(player_b,started_at desc);

create table if not exists public.arena_lobby (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topic text not null check (topic in ('python','sql','javascript')),
  status text not null check(status in ('WAITING','PLAYING')),
  match_id uuid references public.arena_matches(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint arena_lobby_match_state check(
    (status='WAITING' and match_id is null) or
    (status='PLAYING' and match_id is not null)
  )
);
create index if not exists arena_lobby_waiting_idx on public.arena_lobby(topic,updated_at)
 where status='WAITING';
create table if not exists public.arena_answers (
  match_id uuid not null references public.arena_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_no smallint not null check(question_no between 1 and 5),
  option_index smallint not null check(option_index between 0 and 3),
  submitted_at timestamptz not null default clock_timestamp(),
  primary key(match_id,user_id,question_no)
);

-- Public learning questions: separate from high-trust evidence assessment bank.
-- All answers and keys are server-only, never exposed via table SELECT.
insert into public.arena_questions(topic,question_no,prompt,options,correct_option) values
('python',1,'Which Python collection automatically stores only unique elements?','["list","tuple","set","dict"]',2),
('python',2,'What is the result of len([2, 4, 6])?','["2","3","4","6"]',1),
('python',3,'Which Python keyword handles an exception after try?','["catch","except","finally","error"]',1),
('python',4,'What does range(3) produce when converted to a list?','["[1, 2, 3]","[0, 1, 2]","[0, 1, 2, 3]","[3]"]',1),
('python',5,'Which Python operator checks whether two values are equal?','["=","==","is not","!="]',1),
('sql',1,'Which SQL clause filters rows before grouping?','["HAVING","ORDER BY","WHERE","LIMIT"]',2),
('sql',2,'What does COUNT(*) return for an empty table?','["NULL","1","0","An error"]',2),
('sql',3,'Which SQL join returns only matching rows from both tables?','["LEFT JOIN","FULL JOIN","CROSS JOIN","INNER JOIN"]',3),
('sql',4,'Which SQL keyword removes duplicate rows from a SELECT result?','["UNIQUE","DISTINCT","DELETE","GROUP"]',1),
('sql',5,'Which SQL clause sorts result rows?','["HAVING","ORDER BY","WHERE","JOIN"]',1),
('javascript',1,'Which JavaScript array method adds an item at the end?','["push","shift","pop","slice"]',0),
('javascript',2,'What does Array.isArray([]) return?','["false","undefined","true","null"]',2),
('javascript',3,'Which JavaScript declaration prevents reassignment of a variable binding?','["var","let","const","function"]',2),
('javascript',4,'What is the result of typeof "hello"?','["object","char","text","string"]',3),
('javascript',5,'Which JavaScript operator compares values without coercing their types?','["==","===","=","!="]',1)
on conflict (topic,question_no) do nothing;

-- Table-level privacy: authenticated users never read question keys or write scores.
alter table public.arena_questions enable row level security;
-- SECURITY DEFINER routines run as the table owner; direct client grants are revoked.
alter table public.arena_matches enable row level security;
-- SECURITY DEFINER routines run as the table owner; direct client grants are revoked.
alter table public.arena_lobby enable row level security;
-- SECURITY DEFINER routines run as the table owner; direct client grants are revoked.
alter table public.arena_answers enable row level security;
-- SECURITY DEFINER routines run as the table owner; direct client grants are revoked.

revoke all on public.arena_questions,public.arena_matches,public.arena_lobby,public.arena_answers from public,anon,authenticated;
-- Only the explicitly redacted RPCs below grant browser-facing arena access.
drop policy if exists arena_matches_owner_read on public.arena_matches;
create policy arena_matches_owner_read on public.arena_matches
 for select to authenticated using (player_a=(select auth.uid()) or player_b=(select auth.uid()));

-- Atomic matchmaking uses fixed lock order: own user lock, then topic lock.
-- Queue heartbeats expire in 25 seconds; match slots expire after 150 seconds.
create or replace function public.arena_find_match(p_topic text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_rival uuid;
  v_match uuid;
  v_old_match uuid;
  v_started timestamptz;
  v_old_status text;
begin
  if v_user is null then raise exception 'ARENA_AUTH_REQUIRED'; end if;
  if p_topic not in ('python','sql','javascript') or p_topic is null then
    raise exception 'ARENA_INVALID_TOPIC';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(74351,pg_catalog.hashtext(v_user::text));
  perform pg_catalog.pg_advisory_xact_lock(74352,pg_catalog.hashtext(p_topic));

  select l.status,l.match_id into v_old_status,v_old_match
    from public.arena_lobby l where l.user_id=v_user for update;
  if v_old_status='PLAYING' then
    select started_at into v_started from public.arena_matches where id=v_old_match
      and (player_a=v_user or player_b=v_user);
    if v_started is not null and v_started + interval '150 seconds' > clock_timestamp() then
      return jsonb_build_object('status','PLAYING','matchId',v_old_match);
    end if;
  end if;

  select l.user_id into v_rival from public.arena_lobby l
    where l.status='WAITING' and l.topic=p_topic and l.user_id<>v_user
      and l.updated_at>clock_timestamp()-interval '25 seconds'
    order by l.updated_at asc for update skip locked limit 1;

  if v_rival is null then
    insert into public.arena_lobby(user_id,topic,status,match_id,updated_at)
      values(v_user,p_topic,'WAITING',null,clock_timestamp())
    on conflict (user_id) do update set topic=excluded.topic,status='WAITING',
      match_id=null,updated_at=excluded.updated_at;
    return jsonb_build_object('status','WAITING','topic',p_topic);
  end if;

  insert into public.arena_matches(topic,player_a,player_b)
    values(p_topic,v_rival,v_user) returning id into v_match;
  update public.arena_lobby set status='PLAYING',match_id=v_match,
    updated_at=clock_timestamp() where user_id=v_rival and status='WAITING';
  if not found then
    raise exception 'ARENA_MATCH_RACE'; -- transaction rolls back
  end if;
  insert into public.arena_lobby(user_id,topic,status,match_id,updated_at)
    values(v_user,p_topic,'PLAYING',v_match,clock_timestamp())
  on conflict (user_id) do update set topic=excluded.topic,status='PLAYING',
    match_id=excluded.match_id,updated_at=excluded.updated_at;
  return jsonb_build_object('status','PLAYING','matchId',v_match,'topic',p_topic);
end;
$$;

create or replace function public.arena_cancel_wait()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'ARENA_AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(74351,pg_catalog.hashtext(v_user::text));
  delete from public.arena_lobby where user_id=v_user and status='WAITING';
  if found then return '{"status":"IDLE"}'::jsonb; end if;
  return jsonb_build_object('status','NOT_WAITING');
end;
$$;

create or replace function public.arena_get_state()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_topic text;
  v_match uuid;
  v_started timestamptz;
  v_a uuid;
  v_b uuid;
  v_current integer;
  v_prompt text;
  v_options jsonb;
  v_answered boolean;
  v_opponent boolean;
  v_score integer;
  v_rival_score integer;
  v_seconds integer;
begin
  if v_user is null then raise exception 'ARENA_AUTH_REQUIRED'; end if;
  select status,topic,match_id into v_status,v_topic,v_match
    from public.arena_lobby where user_id=v_user;
  if v_status is null then return '{"status":"IDLE"}'::jsonb; end if;
  if v_status='WAITING' then
    update public.arena_lobby set updated_at=clock_timestamp()
      where user_id=v_user and status='WAITING';
    return jsonb_build_object('status','WAITING','topic',v_topic);
  end if;
  select started_at,player_a,player_b,topic into v_started,v_a,v_b,v_topic
    from public.arena_matches where id=v_match
      and (player_a=v_user or player_b=v_user);
  if v_started is null then return '{"status":"IDLE"}'::jsonb; end if;
  v_current:=pg_catalog.floor(extract(epoch from clock_timestamp()-v_started)/30)::integer+1;
  if v_current>5 then
    select count(*)::integer into v_score
      from public.arena_answers a join public.arena_questions q
        on q.topic=v_topic and q.question_no=a.question_no
      where a.match_id=v_match and a.user_id=v_user and a.option_index=q.correct_option;
    select count(*)::integer into v_rival_score
      from public.arena_answers a join public.arena_questions q
        on q.topic=v_topic and q.question_no=a.question_no
      where a.match_id=v_match and a.user_id<>v_user and a.option_index=q.correct_option;
    return jsonb_build_object('status','FINISHED','matchId',v_match,'topic',v_topic,
      'myScore',v_score,'rivalScore',v_rival_score,'totalQuestions',5,
      'outcome',case when v_score>v_rival_score then 'WIN'
        when v_score<v_rival_score then 'LOSS' else 'TIE' end);
  end if;
  v_current:=greatest(1,v_current);
  select prompt,options into v_prompt,v_options from public.arena_questions
    where topic=v_topic and question_no=v_current;
  select exists(select 1 from public.arena_answers where match_id=v_match
    and user_id=v_user and question_no=v_current) into v_answered;
  select exists(select 1 from public.arena_answers where match_id=v_match
    and user_id<>v_user and question_no=v_current) into v_opponent;
  v_seconds:=greatest(0,pg_catalog.ceil(
    extract(epoch from (v_started + v_current*interval '30 seconds' - clock_timestamp()))
  )::integer);
  return jsonb_build_object('status','PLAYING','matchId',v_match,
    'topic',v_topic,'questionNumber',v_current,'totalQuestions',5,
    'question',v_prompt,'options',v_options,'answered',v_answered,
    'rivalAnswered',v_opponent,'secondsRemaining',v_seconds);
end;
$$;

create or replace function public.arena_submit_answer(
  p_match_id uuid,p_question_no integer,p_option_index integer
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_match public.arena_matches%rowtype;
  v_current integer;
  v_saved integer;
begin
  if v_user is null then raise exception 'ARENA_AUTH_REQUIRED'; end if;
  if p_question_no not between 1 and 5 or p_option_index not between 0 and 3
    or p_match_id is null then raise exception 'ARENA_INVALID_ANSWER'; end if;
  select * into v_match from public.arena_matches
    where id=p_match_id and (player_a=v_user or player_b=v_user);
  if not found then raise exception 'ARENA_MATCH_NOT_FOUND'; end if;
  -- Slot must still be actively reserved for this learner.
  if not exists(select 1 from public.arena_lobby
    where user_id=v_user and status='PLAYING' and match_id=p_match_id) then
    raise exception 'ARENA_MATCH_INACTIVE'; end if;
  v_current:=pg_catalog.floor(extract(epoch from clock_timestamp()-v_match.started_at)/30)::integer+1;
  if v_current<>p_question_no then raise exception 'ARENA_QUESTION_CLOSED'; end if;
  insert into public.arena_answers(match_id,user_id,question_no,option_index)
    values(p_match_id,v_user,p_question_no,p_option_index)
    on conflict do nothing returning 1 into v_saved;
  return jsonb_build_object('accepted',coalesce(v_saved,0)=1,
    'questionNumber',p_question_no);
end;
$$;

revoke all on function public.arena_find_match(text) from public,anon;
revoke all on function public.arena_cancel_wait() from public,anon;
revoke all on function public.arena_get_state() from public,anon;
revoke all on function public.arena_submit_answer(uuid,integer,integer) from public,anon;
grant execute on function public.arena_find_match(text) to authenticated;
grant execute on function public.arena_cancel_wait() to authenticated;
grant execute on function public.arena_get_state() to authenticated;
grant execute on function public.arena_submit_answer(uuid,integer,integer) to authenticated;

commit;

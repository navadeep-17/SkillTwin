-- Bring a clean migration replay to the same user-owned manual-profile
-- schema already present in production. Historical DB was created with
-- an untracked SQL change; this additive migration restores reproducibility.
-- No learner rows are inserted, changed, or deleted here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_manual_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  text_content text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  analysis_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_profile_manual_sources_user_created
  ON public.profile_manual_sources(user_id, created_at DESC);

ALTER TABLE public.profile_manual_sources ENABLE ROW LEVEL SECURITY;

DO $manual_sources_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='profile_manual_sources'
      AND policyname='profile_manual_sources_select_own'
  ) THEN
    CREATE POLICY profile_manual_sources_select_own
      ON public.profile_manual_sources FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='profile_manual_sources'
      AND policyname='profile_manual_sources_insert_own'
  ) THEN
    CREATE POLICY profile_manual_sources_insert_own
      ON public.profile_manual_sources FOR INSERT TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='profile_manual_sources'
      AND policyname='profile_manual_sources_update_own'
  ) THEN
    CREATE POLICY profile_manual_sources_update_own
      ON public.profile_manual_sources FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END;
$manual_sources_policies$;

COMMIT;

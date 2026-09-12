CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name varchar(50),
  password_hash text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code varchar(50) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.family_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  genres varchar(50)[] NOT NULL DEFAULT '{}'::varchar(50)[],
  year integer,
  image_url text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_series_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.family_series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL CHECK (status IN ('watched', 'to-watch')),
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id)
);

CREATE INDEX IF NOT EXISTS families_owner_id_index ON public.families (owner_id);
CREATE INDEX IF NOT EXISTS families_invite_code_index ON public.families (invite_code);
CREATE INDEX IF NOT EXISTS family_members_user_id_index ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS family_members_family_id_index ON public.family_members (family_id);
CREATE INDEX IF NOT EXISTS family_series_family_id_index ON public.family_series (family_id);
CREATE INDEX IF NOT EXISTS family_series_status_user_id_index ON public.family_series_status (user_id);
CREATE INDEX IF NOT EXISTS family_series_status_series_id_index ON public.family_series_status (series_id);

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS family_series_touch_updated_at ON public.family_series;
CREATE TRIGGER family_series_touch_updated_at
  BEFORE UPDATE ON public.family_series
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS family_series_status_touch_updated_at ON public.family_series_status;
CREATE TRIGGER family_series_status_touch_updated_at
  BEFORE UPDATE ON public.family_series_status
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_family_member(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members member
    WHERE member.family_id = target_family_id
      AND member.user_id = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_owner(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.families family
    WHERE family.id = target_family_id
      AND family.owner_id = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.create_profile_session(
  p_email text,
  p_display_name text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name varchar(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (email, display_name)
  VALUES (LOWER(TRIM(p_email)), NULLIF(TRIM(p_display_name), ''))
  ON CONFLICT ON CONSTRAINT profiles_email_key DO UPDATE
  SET display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      updated_at = NOW()
  RETURNING * INTO created_profile;

  DELETE FROM public.app_sessions AS session
  WHERE session.user_id = created_profile.id;

  INSERT INTO public.app_sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, created_profile.id, p_expires_at);

  RETURN QUERY
  SELECT
    created_profile.id AS user_id,
    created_profile.email AS email,
    created_profile.display_name AS display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_profile_account(
  p_email text,
  p_display_name text,
  p_password_hash text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name varchar(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (email, display_name, password_hash)
  VALUES (
    LOWER(TRIM(p_email)),
    NULLIF(TRIM(p_display_name), ''),
    p_password_hash
  )
  ON CONFLICT ON CONSTRAINT profiles_email_key DO UPDATE
  SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    password_hash = CASE
      WHEN public.profiles.password_hash IS NULL THEN EXCLUDED.password_hash
      ELSE public.profiles.password_hash
    END,
    updated_at = NOW()
  RETURNING * INTO created_profile;

  IF created_profile.password_hash IS DISTINCT FROM p_password_hash
     AND created_profile.password_hash IS NOT NULL THEN
    RAISE EXCEPTION 'ACCOUNT_ALREADY_EXISTS';
  END IF;

  INSERT INTO public.app_sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, created_profile.id, p_expires_at);

  RETURN QUERY
  SELECT
    created_profile.id AS user_id,
    created_profile.email AS email,
    created_profile.display_name AS display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_auth_by_email(p_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name varchar(50),
  password_hash text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    profile.id AS user_id,
    profile.email AS email,
    profile.display_name AS display_name,
    profile.password_hash AS password_hash
  FROM public.profiles AS profile
  WHERE profile.email = LOWER(TRIM(p_email))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_session_for_profile(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name varchar(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile public.profiles;
BEGIN
  SELECT *
  INTO target_profile
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id
  LIMIT 1;

  DELETE FROM public.app_sessions AS session
  WHERE session.user_id = p_user_id;

  INSERT INTO public.app_sessions (token_hash, user_id, expires_at)
  VALUES (p_token_hash, p_user_id, p_expires_at);

  RETURN QUERY
  SELECT
    target_profile.id AS user_id,
    target_profile.email AS email,
    target_profile.display_name AS display_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_family_by_invite_code(p_invite_code text)
RETURNS TABLE (
  family_id uuid,
  name varchar(255),
  invite_code varchar(50)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    family.id AS family_id,
    family.name AS name,
    family.invite_code AS invite_code
  FROM public.families AS family
  WHERE family.invite_code = UPPER(TRIM(p_invite_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_session_user(p_token_hash text)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  email text,
  display_name varchar(50),
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    session.id AS session_id,
    profile.id AS user_id,
    profile.email AS email,
    profile.display_name AS display_name,
    session.expires_at AS expires_at
  FROM public.app_sessions session
  JOIN public.profiles profile ON profile.id = session.user_id
  WHERE session.token_hash = p_token_hash
    AND session.expires_at > NOW()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.delete_session_by_token(p_token_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.app_sessions WHERE token_hash = p_token_hash;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_series FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_status FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self
  ON public.profiles
  FOR SELECT
  USING (id = public.current_user_id());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  USING (id = public.current_user_id())
  WITH CHECK (id = public.current_user_id());

DROP POLICY IF EXISTS app_sessions_owner_only ON public.app_sessions;
CREATE POLICY app_sessions_owner_only
  ON public.app_sessions
  FOR ALL
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS families_select_member ON public.families;
CREATE POLICY families_select_member
  ON public.families
  FOR SELECT
  USING (owner_id = public.current_user_id() OR public.is_family_member(id));

DROP POLICY IF EXISTS families_insert_owner ON public.families;
CREATE POLICY families_insert_owner
  ON public.families
  FOR INSERT
  WITH CHECK (owner_id = public.current_user_id());

DROP POLICY IF EXISTS families_update_owner ON public.families;
CREATE POLICY families_update_owner
  ON public.families
  FOR UPDATE
  USING (owner_id = public.current_user_id())
  WITH CHECK (owner_id = public.current_user_id());

DROP POLICY IF EXISTS families_delete_owner ON public.families;
CREATE POLICY families_delete_owner
  ON public.families
  FOR DELETE
  USING (owner_id = public.current_user_id());

DROP POLICY IF EXISTS family_members_select_related ON public.family_members;
CREATE POLICY family_members_select_related
  ON public.family_members
  FOR SELECT
  USING (
    user_id = public.current_user_id()
    OR public.is_family_owner(family_id)
    OR public.is_family_member(family_id)
  );

DROP POLICY IF EXISTS family_members_insert_self ON public.family_members;
CREATE POLICY family_members_insert_self
  ON public.family_members
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND (
      role = 'member'
      OR (
        role = 'owner'
        AND EXISTS (
          SELECT 1
          FROM public.families family
          WHERE family.id = family_members.family_id
          AND family.owner_id = public.current_user_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS family_members_delete_self_or_owner ON public.family_members;
CREATE POLICY family_members_delete_self_or_owner
  ON public.family_members
  FOR DELETE
  USING (user_id = public.current_user_id() OR public.is_family_owner(family_id));

DROP POLICY IF EXISTS family_series_select_member ON public.family_series;
CREATE POLICY family_series_select_member
  ON public.family_series
  FOR SELECT
  USING (public.is_family_member(family_id));

DROP POLICY IF EXISTS family_series_insert_member ON public.family_series;
CREATE POLICY family_series_insert_member
  ON public.family_series
  FOR INSERT
  WITH CHECK (
    public.is_family_member(family_id)
    AND created_by = public.current_user_id()
  );

DROP POLICY IF EXISTS family_series_update_member ON public.family_series;
CREATE POLICY family_series_update_member
  ON public.family_series
  FOR UPDATE
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

DROP POLICY IF EXISTS family_series_delete_member ON public.family_series;
CREATE POLICY family_series_delete_member
  ON public.family_series
  FOR DELETE
  USING (public.is_family_member(family_id));

DROP POLICY IF EXISTS family_series_status_select_owner ON public.family_series_status;
CREATE POLICY family_series_status_select_owner
  ON public.family_series_status
  FOR SELECT
  USING (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.family_series series
      WHERE series.id = family_series_status.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_status_insert_owner ON public.family_series_status;
CREATE POLICY family_series_status_insert_owner
  ON public.family_series_status
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.family_series series
      WHERE series.id = family_series_status.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_status_update_owner ON public.family_series_status;
CREATE POLICY family_series_status_update_owner
  ON public.family_series_status
  FOR UPDATE
  USING (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.family_series series
      WHERE series.id = family_series_status.series_id
        AND public.is_family_member(series.family_id)
    )
  )
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.family_series series
      WHERE series.id = family_series_status.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_status_delete_owner ON public.family_series_status;
CREATE POLICY family_series_status_delete_owner
  ON public.family_series_status
  FOR DELETE
  USING (user_id = public.current_user_id());

-- =========================================================================
-- 002: fix family member list only ever showing the current user
--
-- getFamilyMembers() joins family_members to profiles to display email /
-- display_name for every member. profiles_select_self only allowed a user
-- to read their own profile row, so the join silently dropped every other
-- family member. This adds a second permissive SELECT policy (Postgres
-- combines multiple permissive policies with OR) that also allows reading
-- the profile of anyone who shares a family with the caller.
-- =========================================================================

DROP POLICY IF EXISTS profiles_select_family_members ON public.profiles;
CREATE POLICY profiles_select_family_members
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_members mine
      JOIN public.family_members theirs
        ON theirs.family_id = mine.family_id
      WHERE mine.user_id = public.current_user_id()
        AND theirs.user_id = profiles.id
    )
  );

-- =========================================================================
-- 003: series comments + reactions
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.family_series_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.family_series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (
    char_length(btrim(body)) > 0 AND char_length(body) <= 2000
  ),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_series_comments_series_id_index
  ON public.family_series_comments (series_id);

DROP TRIGGER IF EXISTS family_series_comments_touch_updated_at ON public.family_series_comments;
CREATE TRIGGER family_series_comments_touch_updated_at
  BEFORE UPDATE ON public.family_series_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.family_series_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.family_series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji varchar(8) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS family_series_reactions_series_id_index
  ON public.family_series_reactions (series_id);

ALTER TABLE public.family_series_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_reactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_series_comments_select_member ON public.family_series_comments;
CREATE POLICY family_series_comments_select_member
  ON public.family_series_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_comments.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_comments_insert_member ON public.family_series_comments;
CREATE POLICY family_series_comments_insert_member
  ON public.family_series_comments
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_comments.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_comments_update_author ON public.family_series_comments;
CREATE POLICY family_series_comments_update_author
  ON public.family_series_comments
  FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS family_series_comments_delete_author_or_owner ON public.family_series_comments;
CREATE POLICY family_series_comments_delete_author_or_owner
  ON public.family_series_comments
  FOR DELETE
  USING (
    user_id = public.current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_comments.series_id
        AND public.is_family_owner(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_reactions_select_member ON public.family_series_reactions;
CREATE POLICY family_series_reactions_select_member
  ON public.family_series_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_reactions.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_reactions_insert_member ON public.family_series_reactions;
CREATE POLICY family_series_reactions_insert_member
  ON public.family_series_reactions
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_reactions.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_reactions_delete_own ON public.family_series_reactions;
CREATE POLICY family_series_reactions_delete_own
  ON public.family_series_reactions
  FOR DELETE
  USING (user_id = public.current_user_id());

-- =========================================================================
-- 004: episode-level progress + watched_at timestamp for statistics
-- =========================================================================

ALTER TABLE public.family_series
  ADD COLUMN IF NOT EXISTS total_seasons integer CHECK (total_seasons IS NULL OR total_seasons > 0),
  ADD COLUMN IF NOT EXISTS total_episodes integer CHECK (total_episodes IS NULL OR total_episodes > 0),
  ADD COLUMN IF NOT EXISTS episode_runtime_minutes integer CHECK (episode_runtime_minutes IS NULL OR episode_runtime_minutes > 0);

ALTER TABLE public.family_series_status
  ADD COLUMN IF NOT EXISTS watched_at timestamptz;

CREATE TABLE IF NOT EXISTS public.family_series_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.family_series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_season integer NOT NULL DEFAULT 1 CHECK (current_season > 0),
  current_episode integer NOT NULL DEFAULT 0 CHECK (current_episode >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, user_id)
);

DROP TRIGGER IF EXISTS family_series_progress_touch_updated_at ON public.family_series_progress;
CREATE TRIGGER family_series_progress_touch_updated_at
  BEFORE UPDATE ON public.family_series_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.family_series_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_series_progress FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_series_progress_select_member ON public.family_series_progress;
CREATE POLICY family_series_progress_select_member
  ON public.family_series_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_progress.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_progress_upsert_own ON public.family_series_progress;
CREATE POLICY family_series_progress_upsert_own
  ON public.family_series_progress
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_progress.series_id
        AND public.is_family_member(series.family_id)
    )
  );

DROP POLICY IF EXISTS family_series_progress_update_own ON public.family_series_progress;
CREATE POLICY family_series_progress_update_own
  ON public.family_series_progress
  FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS family_series_progress_delete_own ON public.family_series_progress;
CREATE POLICY family_series_progress_delete_own
  ON public.family_series_progress
  FOR DELETE
  USING (user_id = public.current_user_id());

-- =========================================================================
-- 005: "what are we watching tonight" polls with single-choice voting
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.family_watch_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL DEFAULT 'Что смотрим сегодня?',
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.family_watch_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.family_watch_polls(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.family_series(id) ON DELETE CASCADE,
  UNIQUE (poll_id, series_id)
);

CREATE TABLE IF NOT EXISTS public.family_watch_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.family_watch_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.family_watch_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS family_watch_polls_family_id_index
  ON public.family_watch_polls (family_id);
CREATE INDEX IF NOT EXISTS family_watch_poll_options_poll_id_index
  ON public.family_watch_poll_options (poll_id);
CREATE INDEX IF NOT EXISTS family_watch_poll_votes_option_id_index
  ON public.family_watch_poll_votes (option_id);

ALTER TABLE public.family_watch_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_watch_polls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_watch_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_watch_poll_options FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_watch_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_watch_poll_votes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_watch_polls_select_member ON public.family_watch_polls;
CREATE POLICY family_watch_polls_select_member
  ON public.family_watch_polls
  FOR SELECT
  USING (public.is_family_member(family_id));

DROP POLICY IF EXISTS family_watch_polls_insert_member ON public.family_watch_polls;
CREATE POLICY family_watch_polls_insert_member
  ON public.family_watch_polls
  FOR INSERT
  WITH CHECK (
    public.is_family_member(family_id)
    AND created_by = public.current_user_id()
  );

DROP POLICY IF EXISTS family_watch_polls_update_member ON public.family_watch_polls;
CREATE POLICY family_watch_polls_update_member
  ON public.family_watch_polls
  FOR UPDATE
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

DROP POLICY IF EXISTS family_watch_polls_delete_creator_or_owner ON public.family_watch_polls;
CREATE POLICY family_watch_polls_delete_creator_or_owner
  ON public.family_watch_polls
  FOR DELETE
  USING (
    created_by = public.current_user_id()
    OR public.is_family_owner(family_id)
  );

DROP POLICY IF EXISTS family_watch_poll_options_select_member ON public.family_watch_poll_options;
CREATE POLICY family_watch_poll_options_select_member
  ON public.family_watch_poll_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_watch_polls poll
      WHERE poll.id = family_watch_poll_options.poll_id
        AND public.is_family_member(poll.family_id)
    )
  );

DROP POLICY IF EXISTS family_watch_poll_options_insert_member ON public.family_watch_poll_options;
CREATE POLICY family_watch_poll_options_insert_member
  ON public.family_watch_poll_options
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_watch_polls poll
      WHERE poll.id = family_watch_poll_options.poll_id
        AND public.is_family_member(poll.family_id)
    )
  );

DROP POLICY IF EXISTS family_watch_poll_options_delete_member ON public.family_watch_poll_options;
CREATE POLICY family_watch_poll_options_delete_member
  ON public.family_watch_poll_options
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.family_watch_polls poll
      WHERE poll.id = family_watch_poll_options.poll_id
        AND public.is_family_member(poll.family_id)
    )
  );

DROP POLICY IF EXISTS family_watch_poll_votes_select_member ON public.family_watch_poll_votes;
CREATE POLICY family_watch_poll_votes_select_member
  ON public.family_watch_poll_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_watch_polls poll
      WHERE poll.id = family_watch_poll_votes.poll_id
        AND public.is_family_member(poll.family_id)
    )
  );

DROP POLICY IF EXISTS family_watch_poll_votes_upsert_own ON public.family_watch_poll_votes;
CREATE POLICY family_watch_poll_votes_upsert_own
  ON public.family_watch_poll_votes
  FOR INSERT
  WITH CHECK (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.family_watch_polls poll
      WHERE poll.id = family_watch_poll_votes.poll_id
        AND public.is_family_member(poll.family_id)
    )
  );

DROP POLICY IF EXISTS family_watch_poll_votes_update_own ON public.family_watch_poll_votes;
CREATE POLICY family_watch_poll_votes_update_own
  ON public.family_watch_poll_votes
  FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS family_watch_poll_votes_delete_own ON public.family_watch_poll_votes;
CREATE POLICY family_watch_poll_votes_delete_own
  ON public.family_watch_poll_votes
  FOR DELETE
  USING (user_id = public.current_user_id());

-- =========================================================================
-- 006: admin role + ownership transfer
-- =========================================================================

ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

CREATE OR REPLACE FUNCTION public.transfer_family_ownership(
  target_family_id uuid,
  new_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller uuid := public.current_user_id();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.families family
    WHERE family.id = target_family_id
      AND family.owner_id = caller
  ) THEN
    RAISE EXCEPTION 'Только текущий владелец может передать семью';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members member
    WHERE member.family_id = target_family_id
      AND member.user_id = new_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Новый владелец должен быть участником семьи';
  END IF;

  UPDATE public.families
  SET owner_id = new_owner_user_id
  WHERE id = target_family_id;

  UPDATE public.family_members
  SET role = 'member'
  WHERE family_id = target_family_id
    AND user_id = caller;

  UPDATE public.family_members
  SET role = 'owner'
  WHERE family_id = target_family_id
    AND user_id = new_owner_user_id;
END;
$$;

-- =========================================================================
-- 007: web push subscriptions
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_index
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_owner_only ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_only
  ON public.push_subscriptions
  FOR ALL
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

-- SECURITY DEFINER: notifying a family requires reading the OTHER members'
-- subscriptions, which push_subscriptions_owner_only intentionally forbids
-- for a normal RLS-scoped connection. Access is still gated by
-- is_family_member(), which checks the CALLER (current_user_id()) is
-- themself a member of target_family_id before returning anything.
CREATE OR REPLACE FUNCTION public.get_family_push_subscriptions(
  target_family_id uuid,
  exclude_user_id uuid
)
RETURNS TABLE (endpoint text, p256dh text, auth text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sub.endpoint, sub.p256dh, sub.auth
  FROM public.push_subscriptions sub
  JOIN public.family_members member ON member.user_id = sub.user_id
  WHERE member.family_id = target_family_id
    AND sub.user_id != exclude_user_id
    AND public.is_family_member(target_family_id);
$$;

-- =========================================================================
-- 008: fix family stats / recommendations / history only ever seeing your
-- own watched rows.
--
-- family_series_status_select_owner restricts SELECT to `user_id =
-- current_user_id()`, which was correct for the original 1:1 "your status
-- on a shared series" use case, but it silently made getFamilyStats(),
-- getRecommendations() and the new watch-history query aggregate only the
-- CALLING user's own rows and label the result "family" stats. This adds a
-- second permissive SELECT policy (combined with OR, same pattern as the
-- profiles fix above) so any family member can read the whole family's
-- watch status/rating/comment/watched_at for aggregate features.
-- =========================================================================

DROP POLICY IF EXISTS family_series_status_select_family ON public.family_series_status;
CREATE POLICY family_series_status_select_family
  ON public.family_series_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_series series
      WHERE series.id = family_series_status.series_id
        AND public.is_family_member(series.family_id)
    )
  );

-- =========================================================================
-- 009: distinguish series vs. movies
--
-- Movies don't have seasons/episodes, so total_seasons/total_episodes stay
-- meaningless for them; the app hides the episode-progress UI for movies
-- based on this column instead of inferring it from those fields.
-- =========================================================================

ALTER TABLE public.family_series
  ADD COLUMN IF NOT EXISTS media_type varchar(10) NOT NULL DEFAULT 'series'
    CHECK (media_type IN ('series', 'movie'));

-- =========================================================================
-- 010: track new-season releases for series imported from an external
-- catalog (Kinopoisk/OMDb).
--
-- The scheduled check runs without a logged-in user, so the ordinary RLS
-- path (current_user_id() driven) can't see or touch any family's rows.
-- These three functions are SECURITY DEFINER with no caller check — they
-- are only ever meant to be called from the trusted /api/cron route, which
-- is itself gated by a server-side secret before it touches the database.
-- They must never be exposed to arbitrary client-supplied family ids.
-- =========================================================================

ALTER TABLE public.family_series
  ADD COLUMN IF NOT EXISTS external_source varchar(20),
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE OR REPLACE FUNCTION public.get_series_with_external_ids()
RETURNS TABLE (
  id uuid,
  family_id uuid,
  title text,
  external_source varchar(20),
  external_id text,
  total_seasons integer,
  total_episodes integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, family_id, title, external_source, external_id, total_seasons, total_episodes
  FROM public.family_series
  WHERE external_id IS NOT NULL
    AND external_source IS NOT NULL
    AND media_type = 'series';
$$;

CREATE OR REPLACE FUNCTION public.update_series_season_tracking(
  target_series_id uuid,
  new_total_seasons integer,
  new_total_episodes integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.family_series
  SET total_seasons = new_total_seasons,
      total_episodes = COALESCE(new_total_episodes, total_episodes)
  WHERE id = target_series_id;
$$;

CREATE OR REPLACE FUNCTION public.get_family_push_subscriptions_system(
  target_family_id uuid
)
RETURNS TABLE (endpoint text, p256dh text, auth text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sub.endpoint, sub.p256dh, sub.auth
  FROM public.push_subscriptions sub
  JOIN public.family_members member ON member.user_id = sub.user_id
  WHERE member.family_id = target_family_id;
$$;

CREATE OR REPLACE FUNCTION public.get_family_member_emails_system(
  target_family_id uuid
)
RETURNS TABLE (email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT profile.email
  FROM public.family_members member
  JOIN public.profiles profile ON profile.id = member.user_id
  WHERE member.family_id = target_family_id;
$$;

-- =========================================================================
-- 011: "you haven't continued X in a while" nudges
--
-- Same story as the season-tracking cron: this runs with no logged-in
-- user, so it needs its own narrowly-scoped SECURITY DEFINER functions.
-- last_reminded_at throttles repeat nudges for the same series/user pair
-- to once a week, regardless of how often the cron job itself runs.
-- =========================================================================

ALTER TABLE public.family_series_progress
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_stale_progress(days_threshold integer)
RETURNS TABLE (
  series_id uuid,
  user_id uuid,
  title text,
  current_season integer,
  current_episode integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    progress.series_id,
    progress.user_id,
    series.title,
    progress.current_season,
    progress.current_episode
  FROM public.family_series_progress progress
  JOIN public.family_series series ON series.id = progress.series_id
  JOIN public.family_series_status status
    ON status.series_id = progress.series_id
   AND status.user_id = progress.user_id
  WHERE status.status = 'to-watch'
    AND progress.current_episode > 0
    AND progress.updated_at < NOW() - (days_threshold || ' days')::interval
    AND (
      progress.last_reminded_at IS NULL
      OR progress.last_reminded_at < NOW() - INTERVAL '7 days'
    );
$$;

CREATE OR REPLACE FUNCTION public.mark_progress_reminded(
  target_series_id uuid,
  target_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.family_series_progress
  SET last_reminded_at = NOW()
  WHERE series_id = target_series_id
    AND user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_push_subscriptions_system(
  target_user_id uuid
)
RETURNS TABLE (endpoint text, p256dh text, auth text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT endpoint, p256dh, auth
  FROM public.push_subscriptions
  WHERE user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_email_system(target_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM public.profiles WHERE id = target_user_id;
$$;

-- =========================================================================
-- 012: self-service account deletion
--
-- No RLS policy grants DELETE on profiles (a user closing their own
-- account is the one case that needs it), so this needs a narrowly-scoped
-- SECURITY DEFINER function rather than a policy that would let a user
-- delete arbitrary rows. Every family_*/push_subscriptions/app_sessions
-- row referencing this profile cascades away with it; if the account owns
-- a family that still has other members, the app is expected to block the
-- deletion before calling this (the family's own ON DELETE CASCADE would
-- otherwise take the whole family, and everyone else's data, down with it).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.delete_own_profile(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $
  DELETE FROM public.profiles WHERE id = p_user_id;
$;

-- =========================================================================
-- 013: trailer link
-- =========================================================================

ALTER TABLE public.family_series
  ADD COLUMN IF NOT EXISTS trailer_url text;

-- =========================================================================
-- 013: TOTP-based two-factor authentication
--
-- get_profile_auth_by_email now also returns totp_enabled so login can
-- decide whether to finish immediately or ask for a code first (its
-- RETURNS TABLE column list changed, hence the DROP FUNCTION below —
-- CREATE OR REPLACE alone can't do that). get_totp_secret_for_login is the
-- pre-session counterpart used once a password has already checked out but
-- before a session exists, so it deliberately isn't scoped to
-- current_user_id().
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS totp_secret text,
  ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;

-- Postgres won't let CREATE OR REPLACE change a RETURNS TABLE column list
-- (even by only appending), so the old 4-column signature has to go first.
DROP FUNCTION IF EXISTS public.get_profile_auth_by_email(text);

CREATE OR REPLACE FUNCTION public.get_profile_auth_by_email(p_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name varchar(50),
  password_hash text,
  totp_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    profile.id AS user_id,
    profile.email AS email,
    profile.display_name AS display_name,
    profile.password_hash AS password_hash,
    profile.totp_enabled AS totp_enabled
  FROM public.profiles AS profile
  WHERE profile.email = LOWER(TRIM(p_email))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_totp_secret_for_login(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT totp_secret
  FROM public.profiles
  WHERE id = p_user_id
    AND totp_enabled = true;
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO app_user;

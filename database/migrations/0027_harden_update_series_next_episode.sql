-- =========================================================================
-- 027: harden update_series_next_episode against a future untrusted caller
--
-- NOTE ON MIGRATION NUMBERING: written as 0027 against origin/main at a
-- point where another not-yet-merged branch already used 0026
-- (family_members_update_policy) -- no ordering dependency between the two.
--
-- update_series_next_episode is SECURITY DEFINER with no assertion that the
-- calling session actually belongs to the series' family. It's currently
-- reachable only from checkNextEpisodeAction, which first SELECTs the
-- series under RLS and throws if it's invisible (an RLS SELECT policy on
-- family_series already restricts that to family members) -- so this is
-- not exploitable today, but the write itself has no such guard, same
-- shape as the delete_own_profile issue fixed in
-- 0025_harden_delete_own_profile.sql. A future refactor that skips or
-- reorders that lookup (e.g. once the client already has external_id)
-- would turn this into a cross-tenant write primitive with nothing left to
-- catch it.
--
-- Scoping the UPDATE to `AND public.is_family_member(family_id)` costs
-- nothing for the legitimate case and makes the function safe by
-- construction regardless of what caller invokes it.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_series_next_episode(
  target_series_id uuid,
  new_air_date date,
  new_label text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.family_series
  SET next_episode_air_date = new_air_date,
      next_episode_label = new_label
  WHERE id = target_series_id
    AND public.is_family_member(family_id);
$$;

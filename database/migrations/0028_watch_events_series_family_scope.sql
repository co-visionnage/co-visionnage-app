-- =========================================================================
-- 028: a watch event's optional series_id could belong to another family
--
-- family_watch_events_insert_member only checked that family_id belonged to
-- a family the creator is a member of, and that created_by matched the
-- caller -- it never checked that the optional series_id (when supplied)
-- actually belonged to that same family_id. The FK on series_id only
-- requires the row to exist somewhere, not that it's in the right family,
-- the same gap createWatchPollAction and family_watch_poll_options already
-- guard against explicitly.
--
-- Impact is limited (an insert succeeding vs. failing acts as an existence
-- oracle for series UUIDs across families, plus a semantically-dangling
-- event->series link -- reads of the joined series stay RLS-filtered, so
-- no series data itself leaks), but the fix is cheap and keeps this table
-- consistent with the rest of the schema's family-scoping discipline.
-- =========================================================================

DROP POLICY IF EXISTS family_watch_events_insert_member ON public.family_watch_events;
CREATE POLICY family_watch_events_insert_member
  ON public.family_watch_events
  FOR INSERT
  WITH CHECK (
    public.is_family_member(family_id)
    AND created_by = public.current_user_id()
    AND (
      series_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.family_series series
        WHERE series.id = family_watch_events.series_id
          AND series.family_id = family_watch_events.family_id
      )
    )
  );

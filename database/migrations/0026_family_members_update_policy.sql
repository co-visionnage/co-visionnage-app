-- =========================================================================
-- 026: setMemberRoleAction was a silent no-op -- family_members had no
-- UPDATE policy at all
--
-- family_members has ENABLE + FORCE ROW LEVEL SECURITY (0001) with SELECT,
-- INSERT and DELETE policies, but no migration ever added an UPDATE policy.
-- app_user has no BYPASSRLS, so setMemberRoleAction's
-- `UPDATE public.family_members SET role = $3 WHERE ...` matched zero rows
-- every time -- it returned {success:true} (UPDATE 0 rows is not an error),
-- wrote a "role_changed" activity-log entry, and the UI showed the new role
-- after refetch, but the actual row never changed. Any later logic reading
-- `role` (including the owner-only check in this very same action) saw the
-- stale value.
--
-- This mirrors exactly what setMemberRoleAction already checks in
-- application code before running its UPDATE: only the family owner may
-- change a role, and the owner's own role can't be changed this way
-- (ownership moves only through transfer_family_ownership).
-- =========================================================================

DROP POLICY IF EXISTS family_members_update_owner ON public.family_members;
CREATE POLICY family_members_update_owner
  ON public.family_members
  FOR UPDATE
  USING (public.is_family_owner(family_id) AND role != 'owner')
  WITH CHECK (public.is_family_owner(family_id) AND role != 'owner');

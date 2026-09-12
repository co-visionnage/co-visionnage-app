import type { PoolClient } from 'pg';

export type FamilyActivityAction =
  | 'series_added'
  | 'series_removed'
  | 'member_joined'
  | 'role_changed'
  | 'ownership_transferred';

/**
 * Appends one row to family_activity_log using the caller's own RLS-scoped
 * client (see database/init.sql, migration 014) — must run inside the same
 * withUserContext(actorId, ...) transaction as the action it's logging, so
 * failures roll back together with it instead of leaving an orphaned entry.
 */
export async function logFamilyActivity(
  client: PoolClient,
  params: {
    familyId: string;
    actorId: string;
    actorLabel: string;
    action: FamilyActivityAction;
    targetLabel?: string;
    detail?: string;
  },
) {
  await client.query(
    `
      INSERT INTO public.family_activity_log (
        family_id, actor_user_id, actor_label, action, target_label, detail
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      params.familyId,
      params.actorId,
      params.actorLabel,
      params.action,
      params.targetLabel,
      params.detail,
    ],
  );
}

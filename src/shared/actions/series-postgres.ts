'use server';

import { getFamilyMemberEmailsWithClient } from '@/shared/api/postgres/queries';
import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { logFamilyActivity } from '@/shared/lib/activityLog';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { matchBulkImportedRowsToItems } from '@/shared/lib/importSeries/matchBulkRows';
import {
  getFamilyPushSubscriptions,
  sendPushNotifications,
} from '@/shared/lib/push/notifyFamily';
import { SeriesData } from '@/shared/types';

async function notifyFamilyOfEvent(
  userId: string,
  familyId: string,
  title: string,
  body: string,
) {
  try {
    const { emails, subscriptions } = await withUserContext(
      userId,
      async (client) => ({
        emails: await getFamilyMemberEmailsWithClient(client, familyId, userId),
        subscriptions: await getFamilyPushSubscriptions(
          client,
          familyId,
          userId,
        ),
      }),
    );

    // Sent outside the transaction: both notifyFamilyByEmail (Resend) and
    // sendPushNotifications (web-push) are external HTTP calls, and holding
    // a pool connection (BEGIN/COMMIT) open for their duration would let a
    // slow/down provider exhaust the pool.
    await Promise.all([
      notifyFamilyByEmail(emails, title, body),
      sendPushNotifications(subscriptions, { title, body, url: '/' }),
    ]);
  } catch (error) {
    // best-effort — notification failures must never break the underlying
    // action, but a silent failure here is invisible without this log
    console.error(
      `notifyFamilyOfEvent: failed to notify family ${familyId} ("${title}")`,
      error,
    );
  }
}

export interface SeriesActionState {
  error?: string;
  success?: boolean;
}

export async function addSeriesAction(
  familyId: string,
  data: SeriesData,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      const newSeries = await client.query<{ id: string }>(
        `
          INSERT INTO public.family_series (
            family_id,
            title,
            genres,
            year,
            image_url,
            created_by,
            total_seasons,
            total_episodes,
            episode_runtime_minutes,
            trailer_url,
            media_type,
            external_source,
            external_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `,
        [
          familyId,
          data.title,
          data.genres,
          data.year,
          data.image_url ?? undefined,
          user.id,
          data.totalSeasons ?? undefined,
          data.totalEpisodes ?? undefined,
          data.episodeRuntimeMinutes ?? undefined,
          data.trailerUrl ?? undefined,
          data.mediaType,
          data.externalSource ?? undefined,
          data.externalId ?? undefined,
        ],
      );

      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment,
            watched_at
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          newSeries.rows[0].id,
          user.id,
          data.status,
          data.status === 'watched' ? (data.rating ?? undefined) : undefined,
          data.status === 'watched' ? (data.comment ?? undefined) : undefined,
          data.status === 'watched' ? new Date() : undefined,
        ],
      );

      await logFamilyActivity(client, {
        familyId,
        actorId: user.id,
        actorLabel: user.displayName ?? user.email,
        action: 'series_added',
        detail: data.title,
      });
    });

    await notifyFamilyOfEvent(
      user.id,
      familyId,
      'Новый сериал в списке',
      `${user.displayName ?? user.email} добавил(а) «${data.title}»`,
    );

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Ошибка добавления сериала',
    };
  }
}

export interface SeriesBulkActionState {
  error?: string;
  addedCount?: number;
}

// No caller trims a watchlist/CSV import before calling this -- an
// unbounded items.length here means an unbounded jsonb payload sent to
// Postgres and an unbounded number of rows inserted (plus one notification
// email per family member) from a single request.
const MAX_BULK_IMPORT_ITEMS = 500;

// Used by bulk import (Trakt watchlist / IMDb CSV export): one multi-row
// insert + one activity-log entry + one notification instead of looping
// addSeriesAction per title, which for a 100-item watchlist meant 100
// sequential round trips, 100 full-list refetches, and up to 300 emails
// (one per family member per title) for a single button click.
export async function addSeriesBulkAction(
  familyId: string,
  items: SeriesData[],
): Promise<SeriesBulkActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  if (items.length === 0) {
    return { addedCount: 0 };
  }

  if (items.length > MAX_BULK_IMPORT_ITEMS) {
    return {
      error: `Слишком много сериалов за один раз (максимум ${MAX_BULK_IMPORT_ITEMS})`,
    };
  }

  const payload = JSON.stringify(
    items.map((item) => ({
      title: item.title,
      genres: item.genres,
      year: item.year,
      image_url: item.image_url ?? undefined,
      status: item.status,
      rating:
        item.status === 'watched' ? (item.rating ?? undefined) : undefined,
      comment:
        item.status === 'watched' ? (item.comment ?? undefined) : undefined,
      total_seasons: item.totalSeasons ?? undefined,
      total_episodes: item.totalEpisodes ?? undefined,
      episode_runtime_minutes: item.episodeRuntimeMinutes ?? undefined,
      trailer_url: item.trailerUrl ?? undefined,
      media_type: item.mediaType,
      external_source: item.externalSource ?? undefined,
      external_id: item.externalId ?? undefined,
    })),
  );

  const recordShape = `(
      title text, genres jsonb, year int, image_url text,
      status text, rating int, comment text,
      total_seasons int, total_episodes int, episode_runtime_minutes int,
      trailer_url text, media_type text, external_source text, external_id text
    )`;

  let addedCount = 0;

  try {
    await withUserContext(user.id, async (client) => {
      // Two separate statements, not one combined WITH ... INSERT ...
      // INSERT: Postgres does not guarantee that an RLS policy's own
      // subquery (family_series_status_insert_owner re-scans
      // family_series to check membership) sees rows a *sibling*
      // writable CTE inserted earlier in the very same command — each
      // sub-statement in a WITH shares one snapshot/command id, so the
      // policy check can spuriously fail with "new row violates
      // row-level security policy" even though the row objectively
      // exists (reproduced against a real Postgres instance while
      // building this). A second, separate client.query() call is a new
      // command in the same transaction and sees the first insert fine.
      const seriesResult = await client.query<{
        id: string;
        external_source: string | null;
        external_id: string | null;
      }>(
        `
          INSERT INTO public.family_series (
            family_id, title, genres, year, image_url, created_by,
            total_seasons, total_episodes, episode_runtime_minutes, trailer_url,
            media_type, external_source, external_id
          )
          SELECT
            $2,
            t.title,
            ARRAY(SELECT jsonb_array_elements_text(t.genres)),
            t.year,
            t.image_url,
            $3,
            t.total_seasons,
            t.total_episodes,
            t.episode_runtime_minutes,
            t.trailer_url,
            t.media_type,
            t.external_source,
            t.external_id
          FROM jsonb_to_recordset($1::jsonb) AS t${recordShape}
          RETURNING id, external_source, external_id
        `,
        [payload, familyId, user.id],
      );

      const statusRows = matchBulkImportedRowsToItems(seriesResult.rows, items);

      const result = await client.query<{ series_id: string }>(
        `
          INSERT INTO public.family_series_status (
            series_id, user_id, status, rating, comment, watched_at
          )
          SELECT
            t.series_id,
            $2,
            t.status,
            t.rating,
            t.comment,
            CASE WHEN t.status = 'watched' THEN NOW() END
          FROM jsonb_to_recordset($1::jsonb) AS t(
            series_id uuid, status text, rating int, comment text
          )
          RETURNING series_id
        `,
        [JSON.stringify(statusRows), user.id],
      );

      addedCount = result.rowCount ?? 0;

      await logFamilyActivity(client, {
        familyId,
        actorId: user.id,
        actorLabel: user.displayName ?? user.email,
        action: 'series_added',
        detail:
          items.length === 1
            ? items[0].title
            : `${items.length} сериалов (импорт списком)`,
      });
    });

    await notifyFamilyOfEvent(
      user.id,
      familyId,
      'Новые сериалы в списке',
      `${user.displayName ?? user.email} добавил(а) ${addedCount} ${addedCount === 1 ? 'сериал' : 'сериалов'}`,
    );

    return { addedCount };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Ошибка добавления сериалов',
    };
  }
}

export async function deleteAction(id: string): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      const seriesResult = await client.query<{
        family_id: string;
        title: string;
      }>('SELECT family_id, title FROM public.family_series WHERE id = $1', [
        id,
      ]);
      const series = seriesResult.rows[0];

      await client.query('DELETE FROM public.family_series WHERE id = $1', [
        id,
      ]);

      if (series) {
        await logFamilyActivity(client, {
          familyId: series.family_id,
          actorId: user.id,
          actorLabel: user.displayName ?? user.email,
          action: 'series_removed',
          detail: series.title,
        });
      }
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка удаления',
    };
  }
}

export async function markWatchedAction(
  id: string,
  rating: number,
  comment: string,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    let familyId: string | undefined;
    let seriesTitle = '';

    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          INSERT INTO public.family_series_status (
            series_id,
            user_id,
            status,
            rating,
            comment,
            watched_at
          )
          VALUES ($1, $2, 'watched', $3, $4, NOW())
          ON CONFLICT (series_id, user_id) DO UPDATE
          SET status = EXCLUDED.status,
              rating = EXCLUDED.rating,
              comment = EXCLUDED.comment,
              watched_at = COALESCE(family_series_status.watched_at, NOW())
        `,
        [id, user.id, rating, comment || undefined],
      );

      const seriesResult = await client.query<{
        family_id: string;
        title: string;
      }>('SELECT family_id, title FROM public.family_series WHERE id = $1', [
        id,
      ]);
      familyId = seriesResult.rows[0]?.family_id;
      seriesTitle = seriesResult.rows[0]?.title ?? '';
    });

    if (familyId) {
      await notifyFamilyOfEvent(
        user.id,
        familyId,
        'Отметили сериал',
        `${user.displayName ?? user.email} посмотрел(а) «${seriesTitle}»`,
      );
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка отметки',
    };
  }
}

export async function moveToWatchListAction(
  id: string,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      await client.query(
        `
          UPDATE public.family_series_status
          SET status = 'to-watch',
              rating = NULL,
              comment = NULL,
              watched_at = NULL
          WHERE series_id = $1
            AND user_id = $2
        `,
        [id, user.id],
      );
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка перемещения',
    };
  }
}

export async function editAction(
  id: string,
  updates: Partial<SeriesData>,
): Promise<SeriesActionState> {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return { error: 'Не авторизован' };
  }

  try {
    await withUserContext(user.id, async (client) => {
      if (
        updates.title !== undefined ||
        updates.genres !== undefined ||
        updates.year !== undefined ||
        updates.image_url !== undefined ||
        updates.totalSeasons !== undefined ||
        updates.totalEpisodes !== undefined ||
        updates.episodeRuntimeMinutes !== undefined ||
        updates.trailerUrl !== undefined
      ) {
        await client.query(
          `
            UPDATE public.family_series
            SET title = COALESCE($2, title),
                genres = COALESCE($3, genres),
                year = COALESCE($4, year),
                image_url = CASE
                  WHEN $5::text IS NULL THEN image_url
                  ELSE $5
                END,
                total_seasons = COALESCE($6, total_seasons),
                total_episodes = COALESCE($7, total_episodes),
                episode_runtime_minutes = COALESCE($8, episode_runtime_minutes),
                trailer_url = COALESCE($9, trailer_url)
            WHERE id = $1
          `,
          [
            id,
            updates.title ?? undefined,
            updates.genres ?? undefined,
            updates.year ?? undefined,
            updates.image_url === undefined ? undefined : updates.image_url,
            updates.totalSeasons ?? undefined,
            updates.totalEpisodes ?? undefined,
            updates.episodeRuntimeMinutes ?? undefined,
            updates.trailerUrl ?? undefined,
          ],
        );
      }

      if (updates.rating !== undefined || updates.comment !== undefined) {
        await client.query(
          `
            UPDATE public.family_series_status
            SET rating = COALESCE($3, rating),
                comment = COALESCE($4, comment)
            WHERE series_id = $1
              AND user_id = $2
          `,
          [
            id,
            user.id,
            updates.rating ?? undefined,
            updates.comment ?? undefined,
          ],
        );
      }
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ошибка редактирования',
    };
  }
}

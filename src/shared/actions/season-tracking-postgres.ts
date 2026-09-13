'use server';

import { getFamilyMemberEmailsWithClient } from '@/shared/api/postgres/queries';
import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { fetchCurrentSeasonInfo } from '@/shared/lib/importSeries/checkUpdates';
import { findNextEpisode } from '@/shared/lib/nextEpisode/tmdb';
import { notifyFamily } from '@/shared/lib/push/notifyFamily';

export type CheckUpdatesState = {
  error?: string;
  updated?: boolean;
  newTotalSeasons?: number;
};

export async function checkSeriesUpdatesAction(
  seriesId: string,
): Promise<CheckUpdatesState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const series = await withUserContext(user.id, async (client) => {
      const seriesResult = await client.query<{
        family_id: string;
        title: string;
        external_source: string | null;
        external_id: string | null;
        total_seasons: number | null;
      }>(
        `
          SELECT family_id, title, external_source, external_id, total_seasons
          FROM public.family_series
          WHERE id = $1
        `,
        [seriesId],
      );

      const row = seriesResult.rows[0];
      if (!row) throw new Error('Сериал не найден');

      if (!row.external_source || !row.external_id) {
        throw new Error(
          'Сериал не привязан к внешнему источнику — добавлен вручную, а не через импорт',
        );
      }

      return row;
    });

    // Outside the transaction: fetchCurrentSeasonInfo is an external HTTP
    // call to OMDb/Kinopoisk, and holding a pool connection (BEGIN/COMMIT)
    // open for its duration -- reachable on demand by any logged-in user
    // clicking "check for updates" -- could pin all 20 pool connections if
    // the provider hangs, same bug class as the notification-in-transaction
    // issue fixed elsewhere.
    const fresh = await fetchCurrentSeasonInfo(
      series.external_source!,
      series.external_id!,
    );

    if (!fresh?.totalSeasons) {
      throw new Error('Не удалось получить актуальные данные');
    }

    let updated = false;
    let newTotalSeasons: number | undefined;

    if (!series.total_seasons || fresh.totalSeasons > series.total_seasons) {
      // Re-opens a fresh transaction rather than reusing the one above --
      // a second concurrent check could race this write, but it's an
      // idempotent upsert of the same externally-fetched value either way,
      // not a correctness issue like a double side-effecting insert would
      // be.
      await withUserContext(user.id, async (client) => {
        await client.query(
          `
            UPDATE public.family_series
            SET total_seasons = $2,
                total_episodes = COALESCE($3, total_episodes)
            WHERE id = $1
          `,
          [seriesId, fresh.totalSeasons, fresh.totalEpisodes ?? undefined],
        );
      });
      updated = true;
      newTotalSeasons = fresh.totalSeasons;
    }

    if (updated) {
      const notificationTitle = 'Вышел новый сезон!';
      const notificationBody = `У «${series.title}» теперь ${newTotalSeasons} сезон(ов)`;

      const emails = await withUserContext(user.id, async (client) => {
        await notifyFamily(client, series.family_id, user.id, {
          title: notificationTitle,
          body: notificationBody,
          url: '/',
        });

        return getFamilyMemberEmailsWithClient(
          client,
          series.family_id,
          user.id,
        );
      });

      // Sent outside the transaction: notifyFamilyByEmail is an external HTTP
      // call to Resend, and holding a pool connection (BEGIN/COMMIT) open for
      // its duration would let a slow/down email provider exhaust the pool.
      await notifyFamilyByEmail(emails, notificationTitle, notificationBody);
    }

    return { updated, newTotalSeasons };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Ошибка проверки обновлений',
    };
  }
}

export type CheckNextEpisodeState = {
  error?: string;
  airDate?: string;
  label?: string;
};

export async function checkNextEpisodeAction(
  seriesId: string,
): Promise<CheckNextEpisodeState> {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) return { error: 'Не авторизован' };

  try {
    const series = await withUserContext(user.id, async (client) => {
      const seriesResult = await client.query<{
        external_source: string | null;
        external_id: string | null;
      }>(
        'SELECT external_source, external_id FROM public.family_series WHERE id = $1',
        [seriesId],
      );

      const row = seriesResult.rows[0];
      if (
        !row?.external_id ||
        !['omdb', 'imdb-csv'].includes(row.external_source ?? '')
      ) {
        throw new Error(
          'Дата выхода доступна только для сериалов, импортированных с IMDb-идентификатором (OMDb или IMDb CSV)',
        );
      }

      return row;
    });

    // Outside the transaction: findNextEpisode is an external HTTP call to
    // TMDB -- see the comment in checkSeriesUpdatesAction above.
    const next = await findNextEpisode(series.external_id!);
    if (!next) {
      throw new Error('Не удалось найти дату следующего эпизода');
    }

    await withUserContext(user.id, async (client) => {
      await client.query(
        'SELECT public.update_series_next_episode($1, $2, $3)',
        [seriesId, next.airDate, next.label],
      );
    });

    return { airDate: next.airDate, label: next.label };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Ошибка проверки даты выхода',
    };
  }
}

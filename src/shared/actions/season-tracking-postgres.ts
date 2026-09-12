'use server';

import { getFamilyMemberEmailsWithClient } from '@/shared/api/postgres/queries';
import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { fetchCurrentSeasonInfo } from '@/shared/lib/importSeries/checkUpdates';
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
    let familyId: string | undefined;
    let title = '';
    let updated = false;
    let newTotalSeasons: number | undefined;

    await withUserContext(user.id, async (client) => {
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

      const series = seriesResult.rows[0];
      if (!series) throw new Error('Сериал не найден');

      familyId = series.family_id;
      title = series.title;

      if (!series.external_source || !series.external_id) {
        throw new Error(
          'Сериал не привязан к внешнему источнику — добавлен вручную, а не через импорт',
        );
      }

      const fresh = await fetchCurrentSeasonInfo(
        series.external_source,
        series.external_id,
      );

      if (!fresh?.totalSeasons) {
        throw new Error('Не удалось получить актуальные данные');
      }

      if (
        fresh.totalSeasons &&
        (!series.total_seasons || fresh.totalSeasons > series.total_seasons)
      ) {
        await client.query(
          `
            UPDATE public.family_series
            SET total_seasons = $2,
                total_episodes = COALESCE($3, total_episodes)
            WHERE id = $1
          `,
          [seriesId, fresh.totalSeasons, fresh.totalEpisodes ?? undefined],
        );
        updated = true;
        newTotalSeasons = fresh.totalSeasons;
      }
    });

    if (updated && familyId) {
      const notificationTitle = 'Вышел новый сезон!';
      const notificationBody = `У «${title}» теперь ${newTotalSeasons} сезон(ов)`;

      await withUserContext(user.id, async (client) => {
        await notifyFamily(client, familyId!, user.id, {
          title: notificationTitle,
          body: notificationBody,
          url: '/',
        });

        const emails = await getFamilyMemberEmailsWithClient(
          client,
          familyId!,
          user.id,
        );
        await notifyFamilyByEmail(emails, notificationTitle, notificationBody);
      });
    }

    return { updated, newTotalSeasons };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка проверки обновлений',
    };
  }
}

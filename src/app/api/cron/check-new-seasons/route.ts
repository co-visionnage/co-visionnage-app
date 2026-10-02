import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/shared/api/postgres/database';
import { mapWithConcurrency } from '@/shared/lib/concurrency';
import { isAuthorizedCronRequest } from '@/shared/lib/cron/isAuthorizedCronRequest';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { fetchCurrentSeasonInfo } from '@/shared/lib/importSeries/checkUpdates';
import { notifyFamilySystem } from '@/shared/lib/push/notifyFamily';

const CONCURRENCY = 5;

type TrackedSeries = {
  id: string;
  family_id: string;
  title: string;
  external_source: string;
  external_id: string;
  total_seasons: number | null;
  total_episodes: number | null;
};

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tracked = await query<TrackedSeries>(
    'SELECT * FROM public.get_series_with_external_ids()',
  );

  const updates = await mapWithConcurrency(
    tracked.rows,
    CONCURRENCY,
    async (series) => {
      const fresh = await fetchCurrentSeasonInfo(
        series.external_source,
        series.external_id,
      ).catch((error: unknown) => {
        console.error(
          `check-new-seasons: lookup failed for "${series.title}" (${series.external_source}:${series.external_id})`,
          error,
        );
      });

      if (!fresh?.totalSeasons) return;
      if (series.total_seasons && fresh.totalSeasons <= series.total_seasons) {
        return;
      }

      const totalSeasons = fresh.totalSeasons;
      const totalEpisodes = fresh.totalEpisodes;
      return { series, totalSeasons, totalEpisodes };
    },
  );

  const results: { title: string; newTotalSeasons: number }[] = [];

  for (const update of updates) {
    if (!update) continue;
    const { series, totalSeasons, totalEpisodes } = update;

    const title = 'Вышел новый сезон!';
    const body = `У «${series.title}» теперь ${totalSeasons} сезон(ов)`;

    try {
      // Notify before persisting: update_series_season_tracking bumping
      // total_seasons is what makes the comparison above see this series as
      // "already current" on the next run. Persisting it before a
      // successful notification means a failure here (or a crash between
      // the two calls) permanently loses that notification -- the DB
      // already reflects the new season, so it's never detected as
      // "changed" again. Persisting only after a successful notify risks a
      // duplicate notification if just the persist step fails, which is a
      // far smaller problem than losing it silently forever.
      await notifyFamilySystem({ query }, series.family_id, {
        title,
        body,
        url: '/',
      });

      const emails = await query<{ email: string }>(
        'SELECT * FROM public.get_family_member_emails_system($1)',
        [series.family_id],
      );
      await notifyFamilyByEmail(
        emails.rows.map((row) => row.email),
        title,
        body,
      );

      await query('SELECT public.update_series_season_tracking($1, $2, $3)', [
        series.id,
        totalSeasons,
        totalEpisodes ?? undefined,
      ]);

      results.push({ title: series.title, newTotalSeasons: totalSeasons });
    } catch (error) {
      // The row is left untouched, so the next cron run re-detects and
      // retries it instead of the failure aborting every remaining series
      // in this batch.
      console.error(
        `check-new-seasons: failed to notify family ${series.family_id} about "${series.title}"`,
        error,
      );
    }
  }

  return NextResponse.json({ checked: tracked.rows.length, updated: results });
}

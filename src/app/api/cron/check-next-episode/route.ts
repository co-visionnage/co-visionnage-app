import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/shared/api/postgres/database';
import { ENV } from '@/shared/config/environment';
import { mapWithConcurrency } from '@/shared/lib/concurrency';
import { findNextEpisode } from '@/shared/lib/nextEpisode/tmdb';

const CONCURRENCY = 5;

type TrackedSeries = {
  id: string;
  family_id: string;
  title: string;
  external_source: string;
  external_id: string;
};

function isAuthorized(request: NextRequest) {
  if (!ENV.CRON_SECRET) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${ENV.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tracked = await query<TrackedSeries>(
    'SELECT * FROM public.get_series_for_episode_check()',
  );

  const updates = await mapWithConcurrency(
    tracked.rows,
    CONCURRENCY,
    async (series) => {
      const next = await findNextEpisode(series.external_id).catch(
        (error: unknown) => {
          console.error(
            `check-next-episode: lookup failed for "${series.title}" (${series.external_id})`,
            error,
          );
        },
      );
      return next ? { series, next } : undefined;
    },
  );

  const results: { title: string; airDate: string; label: string }[] = [];

  for (const update of updates) {
    if (!update) continue;
    const { series, next } = update;

    await query('SELECT public.update_series_next_episode($1, $2, $3)', [
      series.id,
      next.airDate,
      next.label,
    ]);

    results.push({
      title: series.title,
      airDate: next.airDate,
      label: next.label,
    });
  }

  return NextResponse.json({ checked: tracked.rows.length, updated: results });
}

import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/shared/api/postgres/database';
import { ENV } from '@/shared/config/environment';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { fetchCurrentSeasonInfo } from '@/shared/lib/importSeries/checkUpdates';
import { notifyFamilySystem } from '@/shared/lib/push/notifyFamily';

type TrackedSeries = {
  id: string;
  family_id: string;
  title: string;
  external_source: string;
  external_id: string;
  total_seasons: number | null;
  total_episodes: number | null;
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
    'SELECT * FROM public.get_series_with_external_ids()',
  );

  const results: { title: string; newTotalSeasons: number }[] = [];

  for (const series of tracked.rows) {
    const fresh = await fetchCurrentSeasonInfo(
      series.external_source,
      series.external_id,
    ).catch(() => {});

    if (!fresh?.totalSeasons) continue;
    if (series.total_seasons && fresh.totalSeasons <= series.total_seasons) {
      continue;
    }

    await query('SELECT public.update_series_season_tracking($1, $2, $3)', [
      series.id,
      fresh.totalSeasons,
      fresh.totalEpisodes ?? undefined,
    ]);

    const title = 'Вышел новый сезон!';
    const body = `У «${series.title}» теперь ${fresh.totalSeasons} сезон(ов)`;

    await notifyFamilySystem(
      { query },
      series.family_id,
      { title, body, url: '/' },
    ).catch(() => {});

    const emails = await query<{ email: string }>(
      'SELECT * FROM public.get_family_member_emails_system($1)',
      [series.family_id],
    );
    await notifyFamilyByEmail(
      emails.rows.map((row) => row.email),
      title,
      body,
    ).catch(() => {});

    results.push({ title: series.title, newTotalSeasons: fresh.totalSeasons });
  }

  return NextResponse.json({ checked: tracked.rows.length, updated: results });
}

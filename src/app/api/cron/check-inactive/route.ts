import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/shared/api/postgres/database';
import { ENV } from '@/shared/config/environment';
import { notifyFamilyByEmail } from '@/shared/lib/email/notifyFamilyByEmail';
import { notifyUserSystem } from '@/shared/lib/push/notifyFamily';

type StaleProgress = {
  series_id: string;
  user_id: string;
  title: string;
  current_season: number;
  current_episode: number;
};

const DEFAULT_DAYS_THRESHOLD = 14;

function isAuthorized(request: NextRequest) {
  if (!ENV.CRON_SECRET) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${ENV.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const daysParameter = request.nextUrl.searchParams.get('days');
  const daysThreshold = daysParameter
    ? Number.parseInt(daysParameter, 10)
    : DEFAULT_DAYS_THRESHOLD;

  const stale = await query<StaleProgress>(
    'SELECT * FROM public.get_stale_progress($1)',
    [daysThreshold],
  );

  const notified: { title: string; userId: string }[] = [];

  for (const entry of stale.rows) {
    const title = 'Давно не продолжали!';
    const body = `Вы остановились на сезоне ${entry.current_season}, серии ${entry.current_episode} — «${entry.title}» ждёт продолжения`;

    await notifyUserSystem({ query }, entry.user_id, {
      title,
      body,
      url: `/series/${entry.series_id}`,
    }).catch(() => {});

    const email = await query<{ get_user_email_system: string | null }>(
      'SELECT public.get_user_email_system($1)',
      [entry.user_id],
    );
    const userEmail = email.rows[0]?.get_user_email_system;
    if (userEmail) {
      await notifyFamilyByEmail([userEmail], title, body).catch(() => {});
    }

    await query('SELECT public.mark_progress_reminded($1, $2)', [
      entry.series_id,
      entry.user_id,
    ]);

    notified.push({ title: entry.title, userId: entry.user_id });
  }

  return NextResponse.json({ checked: stale.rows.length, notified });
}

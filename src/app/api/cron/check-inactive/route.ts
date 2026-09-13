import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/shared/api/postgres/database';
import { isAuthorizedCronRequest } from '@/shared/lib/cron/isAuthorizedCronRequest';
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

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
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
    // Claim the row first, atomically: mark_progress_reminded re-checks the
    // same staleness condition as get_stale_progress and only updates (and
    // returns true) if it still holds. This makes overlapping/retried cron
    // invocations mutually exclusive per row, so at most one of them sends
    // the notification below.
    const claim = await query<{ mark_progress_reminded: boolean | null }>(
      'SELECT public.mark_progress_reminded($1, $2)',
      [entry.series_id, entry.user_id],
    );
    if (!claim.rows[0]?.mark_progress_reminded) continue;

    const title = 'Давно не продолжали!';
    const body = `Вы остановились на сезоне ${entry.current_season}, серии ${entry.current_episode} — «${entry.title}» ждёт продолжения`;

    try {
      await notifyUserSystem({ query }, entry.user_id, {
        title,
        body,
        url: `/series/${entry.series_id}`,
      });

      const email = await query<{ get_user_email_system: string | null }>(
        'SELECT public.get_user_email_system($1)',
        [entry.user_id],
      );
      const userEmail = email.rows[0]?.get_user_email_system;
      if (userEmail) {
        await notifyFamilyByEmail([userEmail], title, body);
      }

      notified.push({ title: entry.title, userId: entry.user_id });
    } catch (error) {
      // The row is already claimed above, so a delivery failure here must
      // not abort the loop -- the remaining users still need their nudges.
      console.error(
        `check-inactive: failed to notify user ${entry.user_id} about "${entry.title}"`,
        error,
      );
    }
  }

  return NextResponse.json({ checked: stale.rows.length, notified });
}

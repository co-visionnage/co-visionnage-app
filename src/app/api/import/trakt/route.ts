import { NextRequest, NextResponse } from 'next/server';

import { ENV } from '@/shared/config/environment';
import { importTraktWatchlist } from '@/shared/lib/importSeries/trakt';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const RATE_LIMIT_MAX_ATTEMPTS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  const isWithinLimit = await checkRateLimit(
    `import:ip:${getClientIp(request)}`,
    RATE_LIMIT_MAX_ATTEMPTS,
    RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinLimit) {
    return NextResponse.json(
      { error: 'Слишком много запросов на импорт. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const username = request.nextUrl.searchParams.get('username')?.trim();

  if (!username) {
    return NextResponse.json(
      { error: 'username is required' },
      { status: 400 },
    );
  }

  if (!ENV.TRAKT_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Импорт из Trakt не настроен: нет TRAKT_CLIENT_ID' },
      { status: 501 },
    );
  }

  try {
    const results = await importTraktWatchlist(username);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить список Trakt',
      },
      { status: 500 },
    );
  }
}

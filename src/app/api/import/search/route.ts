import { NextRequest, NextResponse } from 'next/server';

import { ENV } from '@/shared/config/environment';
import { searchKinopoisk } from '@/shared/lib/importSeries/kinopoisk';
import { searchOmdb } from '@/shared/lib/importSeries/omdb';
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

  const query = request.nextUrl.searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  if (!ENV.KINOPOISK_API_KEY && !ENV.OMDB_API_KEY) {
    return NextResponse.json(
      { error: 'Импорт не настроен: нет KINOPOISK_API_KEY или OMDB_API_KEY' },
      { status: 501 },
    );
  }

  try {
    const [kinopoiskResults, omdbResults] = await Promise.all([
      searchKinopoisk(query),
      searchOmdb(query),
    ]);

    return NextResponse.json({
      results: [...kinopoiskResults, ...omdbResults],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось выполнить поиск',
      },
      { status: 500 },
    );
  }
}

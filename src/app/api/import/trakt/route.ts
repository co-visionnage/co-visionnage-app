import { NextRequest, NextResponse } from 'next/server';

import { ENV } from '@/shared/config/environment';
import { importTraktWatchlist } from '@/shared/lib/importSeries/trakt';

export async function GET(request: NextRequest) {
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

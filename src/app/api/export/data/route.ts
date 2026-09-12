import { NextRequest, NextResponse } from 'next/server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

type ExportSeriesRow = {
  title: string;
  year: number | null;
  genres: string[] | null;
  media_type: string;
  status: string | null;
  rating: number | null;
  comment: string | null;
  watched_at: string | null;
  current_season: number | null;
  current_episode: number | null;
};

async function collectExportData(userId: string) {
  return withUserContext(userId, async (client) => {
    const profileResult = await client.query<{
      email: string;
      display_name: string | null;
      created_at: string;
    }>('SELECT email, display_name, created_at FROM public.profiles WHERE id = $1', [
      userId,
    ]);

    const familyResult = await client.query<{
      family_name: string;
      role: string;
      joined_at: string;
    }>(
      `
        SELECT family.name AS family_name, member.role, member.joined_at
        FROM public.family_members member
        JOIN public.families family ON family.id = member.family_id
        WHERE member.user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    const seriesResult = await client.query<ExportSeriesRow>(
      `
        SELECT
          series.title,
          series.year,
          series.genres,
          series.media_type,
          status.status,
          status.rating,
          status.comment,
          status.watched_at,
          progress.current_season,
          progress.current_episode
        FROM public.family_series_status status
        JOIN public.family_series series ON series.id = status.series_id
        LEFT JOIN public.family_series_progress progress
          ON progress.series_id = series.id
         AND progress.user_id = status.user_id
        WHERE status.user_id = $1
        ORDER BY series.title ASC
      `,
      [userId],
    );

    return {
      profile: profileResult.rows[0],
      family: familyResult.rows[0],
      series: seriesResult.rows,
    };
  });
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(series: ExportSeriesRow[]): string {
  const header = [
    'title',
    'year',
    'genres',
    'media_type',
    'status',
    'rating',
    'comment',
    'watched_at',
    'current_season',
    'current_episode',
  ];

  const rows = series.map((row) =>
    [
      row.title,
      row.year,
      (row.genres ?? []).join('; '),
      row.media_type,
      row.status,
      row.rating,
      row.comment,
      row.watched_at,
      row.current_season,
      row.current_episode,
    ]
      .map((value) => escapeCsvCell(value))
      .join(','),
  );

  return [header.join(','), ...rows].join('\n');
}

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') === 'csv'
    ? 'csv'
    : 'json';

  try {
    const data = await collectExportData(user.id);

    if (format === 'csv') {
      return new NextResponse(toCsv(data.series), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="my-data.csv"',
        },
      });
    }

    return new NextResponse(JSON.stringify(data, undefined, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="my-data.json"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось выгрузить данные',
      },
      { status: 500 },
    );
  }
}

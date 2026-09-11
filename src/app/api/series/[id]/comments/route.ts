import { NextRequest, NextResponse } from 'next/server';

import { getSeriesComments } from '@/shared/api/postgres/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const comments = await getSeriesComments(id);
    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить комментарии',
      },
      { status: 500 },
    );
  }
}

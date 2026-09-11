import { NextRequest, NextResponse } from 'next/server';

import { getSeriesProgress } from '@/shared/api/postgres/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const progress = await getSeriesProgress(id);
    return NextResponse.json({ progress });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить прогресс',
      },
      { status: 500 },
    );
  }
}

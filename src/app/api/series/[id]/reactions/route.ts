import { NextRequest, NextResponse } from 'next/server';

import { getSeriesReactions } from '@/shared/api/postgres/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const reactions = await getSeriesReactions(id);
    return NextResponse.json({ reactions });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить реакции',
      },
      { status: 500 },
    );
  }
}

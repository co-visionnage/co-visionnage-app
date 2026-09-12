import { NextRequest, NextResponse } from 'next/server';

import { getFamilyActivityLog } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');
  const offset = Number.parseInt(
    request.nextUrl.searchParams.get('offset') ?? '0',
    10,
  );

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const { entries, hasMore } = await getFamilyActivityLog(
      familyId,
      Number.isFinite(offset) && offset > 0 ? offset : 0,
    );
    return NextResponse.json({ activity: entries, hasMore });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить журнал действий',
      },
      { status: 500 },
    );
  }
}

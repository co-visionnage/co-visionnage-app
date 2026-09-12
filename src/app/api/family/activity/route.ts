import { NextRequest, NextResponse } from 'next/server';

import { getFamilyActivityLog } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const activity = await getFamilyActivityLog(familyId);
    return NextResponse.json({ activity });
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

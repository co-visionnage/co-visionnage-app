import { NextRequest, NextResponse } from 'next/server';

import { getFamilyProgress } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const progress = await getFamilyProgress(familyId);
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

import { NextRequest, NextResponse } from 'next/server';

import { getFamilyStats } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const stats = await getFamilyStats(familyId);
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить статистику',
      },
      { status: 500 },
    );
  }
}

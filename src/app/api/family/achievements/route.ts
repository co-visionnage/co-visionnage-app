import { NextRequest, NextResponse } from 'next/server';

import { getFamilyAchievements } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const achievements = await getFamilyAchievements(familyId);
    return NextResponse.json({ achievements });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить достижения',
      },
      { status: 500 },
    );
  }
}

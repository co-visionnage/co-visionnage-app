import { NextRequest, NextResponse } from 'next/server';

import { getYearWrapped } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');
  const yearParameter = request.nextUrl.searchParams.get('year');
  const year = yearParameter
    ? Number.parseInt(yearParameter, 10)
    : new Date().getFullYear();

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const wrapped = await getYearWrapped(familyId, year);
    return NextResponse.json({ wrapped });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось собрать итоги года',
      },
      { status: 500 },
    );
  }
}

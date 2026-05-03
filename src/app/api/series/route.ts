import { NextRequest, NextResponse } from 'next/server';

import { getFamilySeries } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const series = await getFamilySeries(familyId);
    return NextResponse.json({ series });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load series',
      },
      { status: 500 },
    );
  }
}

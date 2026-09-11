import { NextRequest, NextResponse } from 'next/server';

import { getFamilyWatchPolls } from '@/shared/api/postgres/queries';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const polls = await getFamilyWatchPolls(familyId);
    return NextResponse.json({ polls });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить голосования',
      },
      { status: 500 },
    );
  }
}

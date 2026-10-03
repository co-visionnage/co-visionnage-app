import { NextRequest, NextResponse } from 'next/server';

import { getFamilyMembers } from '@/shared/api/go/queries';
import { ApiError, apiJson } from '@/shared/api/go/server';

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get('familyId');

  if (!familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  try {
    const members = await getFamilyMembers(familyId);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить участников семьи',
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => {})) as {
    familyId?: string;
    memberUserId?: string;
  } | null;

  const familyId = body?.familyId?.trim();
  const memberUserId = body?.memberUserId?.trim();

  if (!familyId || !memberUserId) {
    return NextResponse.json(
      { error: 'familyId and memberUserId are required' },
      { status: 400 },
    );
  }

  try {
    await apiJson(
      `/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberUserId)}`,
      { method: 'DELETE' },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось удалить участника семьи',
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}

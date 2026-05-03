import { NextRequest, NextResponse } from 'next/server';

import { getFamilyMembers } from '@/shared/api/postgres/queries';
import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

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
      { status: 500 },
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
    const user = await requireCurrentUser();

    await withUserContext(user.id, async (client) => {
      const membershipResult = await client.query<{ role: 'owner' | 'member' }>(
        `
          SELECT role
          FROM public.family_members
          WHERE family_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [familyId, user.id],
      );

      const membership = membershipResult.rows[0];

      if (!membership || membership.role !== 'owner') {
        throw new Error('Только владелец семьи может удалять участников');
      }

      const targetResult = await client.query<{ role: 'owner' | 'member' }>(
        `
          SELECT role
          FROM public.family_members
          WHERE family_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [familyId, memberUserId],
      );

      const targetMembership = targetResult.rows[0];

      if (!targetMembership) {
        throw new Error('Участник не найден');
      }

      if (targetMembership.role === 'owner') {
        throw new Error('Нельзя удалить владельца семьи');
      }

      await client.query(
        `
          DELETE FROM public.family_members
          WHERE family_id = $1
            AND user_id = $2
        `,
        [familyId, memberUserId],
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось удалить участника семьи',
      },
      { status: 500 },
    );
  }
}

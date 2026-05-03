import { NextRequest, NextResponse } from 'next/server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < 6; index++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BRTL-${result}`;
}

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser().catch(() => {});
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { familyName } = await request.json();

  try {
    await withUserContext(user.id, async (client) => {
      const familyResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.families (name, invite_code, owner_id)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [familyName, generateInviteCode(), user.id],
      );

      await client.query(
        `
          INSERT INTO public.family_members (family_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
        [familyResult.rows[0].id, user.id],
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating family:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании семьи' },
      { status: 500 },
    );
  }
}

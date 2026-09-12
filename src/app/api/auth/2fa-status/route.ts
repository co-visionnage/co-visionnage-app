import { NextResponse } from 'next/server';

import {
  requireCurrentUser,
  withUserContext,
} from '@/shared/api/postgres/server';

export async function GET() {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const enabled = await withUserContext(user.id, async (client) => {
    const result = await client.query<{ totp_enabled: boolean }>(
      'SELECT totp_enabled FROM public.profiles WHERE id = $1',
      [user.id],
    );

    return result.rows[0]?.totp_enabled ?? false;
  });

  return NextResponse.json({ enabled });
}

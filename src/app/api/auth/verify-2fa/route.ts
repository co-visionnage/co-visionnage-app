import { NextResponse } from 'next/server';

import { verifyTwoFactorAndCreateSession } from '@/shared/api/postgres/auth';

type RequestBody = {
  userId?: string;
  code?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as RequestBody | null;

  const userId = body?.userId?.trim();
  const code = body?.code?.trim();

  if (!userId || !code) {
    return NextResponse.json(
      { error: 'userId и code обязательны' },
      { status: 400 },
    );
  }

  try {
    await verifyTwoFactorAndCreateSession(userId, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Не удалось подтвердить код',
      },
      { status: 400 },
    );
  }
}

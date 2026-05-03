import { NextResponse } from 'next/server';

import { clearUserSession } from '@/shared/api/postgres/auth';

export async function POST() {
  await clearUserSession();
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';

import { setActiveFamilyIdCookie } from '@/shared/lib/activeFamily';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => {})) as {
    familyId?: string;
  } | null;

  if (!body?.familyId) {
    return NextResponse.json(
      { error: 'familyId is required' },
      { status: 400 },
    );
  }

  // The cookie is advisory only — getHomePageData() falls back to the
  // user's first membership if this id isn't one of their own, so there's
  // no need to verify membership here.
  await setActiveFamilyIdCookie(body.familyId);

  return NextResponse.json({ success: true });
}

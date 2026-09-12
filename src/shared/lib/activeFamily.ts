import { cookies } from 'next/headers';

const ACTIVE_FAMILY_COOKIE_NAME = 'co_visionnage_active_family';

export async function getActiveFamilyIdCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_FAMILY_COOKIE_NAME)?.value;
}

export async function setActiveFamilyIdCookie(familyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_FAMILY_COOKIE_NAME, familyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

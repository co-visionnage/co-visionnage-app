import { type NextRequest } from 'next/server';

import { updateSession } from '@/shared/api/postgres/middleware';

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // eslint-disable-next-line unicorn/prefer-string-raw
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

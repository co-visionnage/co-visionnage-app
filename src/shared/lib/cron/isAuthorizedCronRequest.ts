import { createHash, timingSafeEqual } from 'node:crypto';

import { ENV } from '@/shared/config/environment';

// A plain `===` comparison short-circuits on the first differing byte, so
// its timing leaks how many leading characters of a guess were correct --
// enough samples over the network can recover CRON_SECRET one byte at a
// time. Hashing both sides first makes the two buffers compared by
// timingSafeEqual a fixed 32 bytes regardless of the input length (so
// timingSafeEqual's own equal-length requirement is never violated), and
// timingSafeEqual itself compares in constant time.
function constantTimeEquals(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function isAuthorizedCronRequest(request: Request): boolean {
  if (!ENV.CRON_SECRET) return false;

  const header = request.headers.get('authorization');
  if (!header) return false;

  return constantTimeEquals(header, `Bearer ${ENV.CRON_SECRET}`);
}

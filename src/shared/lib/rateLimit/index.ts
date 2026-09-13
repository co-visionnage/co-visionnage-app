import { query } from '@/shared/api/postgres/database';

/**
 * Fixed-window rate limiter backed by public.check_rate_limit (see
 * database/init.sql, migration 014). Increments the bucket and returns
 * whether the caller is still within the allowed attempt count for the
 * current window — call it before doing the actual work, not after.
 */
export async function checkRateLimit(
  bucketKey: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    'SELECT public.check_rate_limit($1, $2, $3) AS allowed',
    [bucketKey, maxAttempts, windowSeconds],
  );

  return result.rows[0]?.allowed ?? true;
}

export function getClientIp(request: Request): string {
  // X-Real-IP should be set by the reverse proxy with
  // `proxy_set_header X-Real-IP $remote_addr` (nginx), which REPLACES any
  // value the client sent rather than appending to it, so it can't be
  // spoofed by a request header -- prefer it when present.
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // X-Forwarded-For is normally built by each hop APPENDING its own
  // observed address (nginx: `X-Forwarded-For $proxy_add_x_forwarded_for`),
  // so with a single reverse proxy in front of this app the LAST entry is
  // the address the proxy itself saw. The FIRST entry is whatever the
  // client chose to put there and must never be trusted for rate limiting.
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim());
    return hops[hops.length - 1];
  }

  return 'unknown';
}

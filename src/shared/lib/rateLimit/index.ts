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
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

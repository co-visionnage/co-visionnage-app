import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn().mockResolvedValue({ rows: [] });

vi.mock('@/shared/api/postgres/database', () => ({
  query: (...arguments_: unknown[]) => queryMock(...arguments_),
}));

function requestWithDays(days?: string): NextRequest {
  const url = new URL('http://localhost/api/cron/check-inactive');
  if (days !== undefined) url.searchParams.set('days', days);
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('POST /api/cron/check-inactive days threshold', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  it('uses the default threshold when ?days is absent', async () => {
    const { POST } = await import('./route');
    await POST(requestWithDays());

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [14]);
  });

  it('uses the provided threshold when valid', async () => {
    const { POST } = await import('./route');
    await POST(requestWithDays('30'));

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [30]);
  });

  it('falls back to the default for a non-numeric ?days', async () => {
    const { POST } = await import('./route');
    await POST(requestWithDays('abc'));

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [14]);
  });

  it('falls back to the default for ?days=0 instead of nudging everyone', async () => {
    const { POST } = await import('./route');
    await POST(requestWithDays('0'));

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [14]);
  });

  it('falls back to the default for a negative ?days', async () => {
    const { POST } = await import('./route');
    await POST(requestWithDays('-5'));

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [14]);
  });
});

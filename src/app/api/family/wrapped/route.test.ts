import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getYearWrapped } from '@/shared/api/postgres/queries';
import { GET } from './route';

vi.mock('@/shared/api/postgres/queries', () => ({
  getYearWrapped: vi.fn().mockResolvedValue({}),
}));

function requestWithParameters(
  parameters: Record<string, string>,
): NextRequest {
  const url = new URL('http://localhost/api/family/wrapped');
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/family/wrapped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the current year when ?year is absent', async () => {
    await GET(requestWithParameters({ familyId: 'family-1' }));

    expect(getYearWrapped).toHaveBeenCalledWith(
      'family-1',
      new Date().getFullYear(),
    );
  });

  it('uses the provided year when valid', async () => {
    await GET(requestWithParameters({ familyId: 'family-1', year: '2021' }));

    expect(getYearWrapped).toHaveBeenCalledWith('family-1', 2021);
  });

  it('falls back to the current year for a non-numeric ?year instead of passing NaN through', async () => {
    await GET(requestWithParameters({ familyId: 'family-1', year: 'abc' }));

    expect(getYearWrapped).toHaveBeenCalledWith(
      'family-1',
      new Date().getFullYear(),
    );
  });

  it('returns 400 when familyId is missing', async () => {
    const response = await GET(requestWithParameters({ year: '2021' }));

    expect(response.status).toBe(400);
    expect(getYearWrapped).not.toHaveBeenCalled();
  });
});

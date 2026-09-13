import { describe, expect, it } from 'vitest';

import { getClientIp } from './index';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers });
}

describe('getClientIp', () => {
  it('uses the first address in x-forwarded-for', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2',
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('trims whitespace around the first address', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '  203.0.113.5  , 10.0.0.1',
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const request = requestWithHeaders({ 'x-real-ip': '198.51.100.9' });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5',
      'x-real-ip': '198.51.100.9',
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('returns "unknown" when neither header is present', () => {
    const request = requestWithHeaders({});

    expect(getClientIp(request)).toBe('unknown');
  });
});

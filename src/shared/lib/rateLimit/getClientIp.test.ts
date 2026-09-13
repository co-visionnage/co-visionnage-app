import { describe, expect, it } from 'vitest';

import { getClientIp } from './index';

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers });
}

describe('getClientIp', () => {
  it('uses the last address in x-forwarded-for (the hop closest to this app)', () => {
    // A client-controlled first hop, followed by whatever the reverse
    // proxy actually saw appended last -- only the last entry is trustworthy.
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5, 10.0.0.1, 198.51.100.9',
    });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('trims whitespace around the last address', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5,   198.51.100.9  ',
    });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('does not trust a spoofed single-hop x-forwarded-for as the client address', () => {
    // With no reverse proxy in the chain, a client can set x-forwarded-for
    // to anything -- a single value is indistinguishable from a spoofed one,
    // so it still gets used as "the last hop" (this app is not meant to be
    // reachable without its reverse proxy in front).
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5',
    });

    expect(getClientIp(request)).toBe('203.0.113.5');
  });

  it('falls back to x-forwarded-for when x-real-ip is absent', () => {
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5, 198.51.100.9',
    });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('prefers x-real-ip over x-forwarded-for when both are present', () => {
    // x-real-ip is set with proxy_set_header (replaces, never appends), so
    // it is trusted over x-forwarded-for's last hop.
    const request = requestWithHeaders({
      'x-forwarded-for': '203.0.113.5, 198.51.100.9',
      'x-real-ip': '198.51.100.9',
    });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('trims whitespace around x-real-ip', () => {
    const request = requestWithHeaders({ 'x-real-ip': '  198.51.100.9  ' });

    expect(getClientIp(request)).toBe('198.51.100.9');
  });

  it('returns "unknown" when neither header is present', () => {
    const request = requestWithHeaders({});

    expect(getClientIp(request)).toBe('unknown');
  });
});

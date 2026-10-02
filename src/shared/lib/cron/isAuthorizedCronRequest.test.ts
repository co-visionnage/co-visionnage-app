import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('isAuthorizedCronRequest', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function requestWithAuth(header?: string): Request {
    return new Request('http://localhost/', {
      headers: header ? { authorization: header } : {},
    });
  }

  it('rejects when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(isAuthorizedCronRequest(requestWithAuth('Bearer anything'))).toBe(
      false,
    );
  });

  it('accepts the correct bearer secret', async () => {
    vi.stubEnv('CRON_SECRET', 'top-secret');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(isAuthorizedCronRequest(requestWithAuth('Bearer top-secret'))).toBe(
      true,
    );
  });

  it('rejects a missing authorization header', async () => {
    vi.stubEnv('CRON_SECRET', 'top-secret');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(isAuthorizedCronRequest(requestWithAuth())).toBe(false);
  });

  it('rejects a wrong secret', async () => {
    vi.stubEnv('CRON_SECRET', 'top-secret');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(
      isAuthorizedCronRequest(requestWithAuth('Bearer wrong-secret')),
    ).toBe(false);
  });

  it('rejects a secret that only differs in length', async () => {
    vi.stubEnv('CRON_SECRET', 'top-secret');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(
      isAuthorizedCronRequest(requestWithAuth('Bearer top-secret-extra')),
    ).toBe(false);
  });

  it('is case-sensitive', async () => {
    vi.stubEnv('CRON_SECRET', 'top-secret');
    const { isAuthorizedCronRequest } =
      await import('./isAuthorizedCronRequest');

    expect(isAuthorizedCronRequest(requestWithAuth('bearer top-secret'))).toBe(
      false,
    );
  });
});

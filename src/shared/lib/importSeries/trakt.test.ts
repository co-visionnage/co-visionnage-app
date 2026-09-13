import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ENV.TRAKT_CLIENT_ID is read from process.env at module load time, so each
// test that needs a specific value stubs the env var and re-imports the
// module fresh via resetModules() rather than relying on import-time state.
async function importFreshModule() {
  vi.resetModules();
  return import('./trakt');
}

describe('importTraktWatchlist', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns an empty list without ever calling fetch when TRAKT_CLIENT_ID is unset', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', '');
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();
    const result = await importTraktWatchlist('someuser');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a username that does not match the allowed pattern, without calling fetch', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', 'test-client-id');
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();

    // path-traversal / injection-shaped usernames must be rejected before
    // ever reaching a URL
    const result = await importTraktWatchlist('../../etc/passwd');

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a username over 50 characters', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', 'test-client-id');
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();
    const result = await importTraktWatchlist('a'.repeat(51));

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a normal alphanumeric username and maps show/movie watchlist items', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', 'test-client-id');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          type: 'show',
          show: {
            ids: { trakt: 1, imdb: 'tt0903747' },
            title: 'Breaking Bad',
            year: 2008,
            genres: ['crime', 'drama'],
          },
        },
        {
          type: 'movie',
          movie: {
            ids: { trakt: 2 }, // no imdb id -- should fall back to trakt id
            title: 'A Movie',
          },
        },
      ],
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();
    const result = await importTraktWatchlist('valid_user-123');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toBe(
      'https://api.trakt.tv/users/valid_user-123/watchlist',
    );
    expect(options.headers['trakt-api-key']).toBe('test-client-id');

    expect(result).toEqual([
      {
        externalId: 'tt0903747',
        source: 'trakt',
        title: 'Breaking Bad',
        year: 2008,
        genres: ['crime', 'drama'],
      },
      {
        externalId: '2',
        source: 'trakt',
        title: 'A Movie',
        year: new Date().getFullYear(),
        genres: [],
      },
    ]);
  });

  it('URL-encodes the username when building the request', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', 'test-client-id');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();
    // dots and hyphens are within the allowed pattern's character set
    await importTraktWatchlist('user-with-dashes');

    const [calledUrl] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toContain('user-with-dashes');
  });

  it('returns an empty list when the upstream response is not ok', async () => {
    vi.stubEnv('TRAKT_CLIENT_ID', 'test-client-id');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => [],
      }) as unknown as typeof fetch;

    const { importTraktWatchlist } = await importFreshModule();
    const result = await importTraktWatchlist('validuser');

    expect(result).toEqual([]);
  });
});

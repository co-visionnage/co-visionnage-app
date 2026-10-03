import { afterEach, describe, expect, it, vi } from 'vitest';

import { postJson } from './postJson';

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('postJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the body as JSON and reports success', async () => {
    const fetchMock = mockFetch(Response.json({ success: true }));

    const result = await postJson('/api/x', { a: 1 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it('sends no body and no content type when there is nothing to send', async () => {
    const fetchMock = mockFetch(Response.json({ success: true }));

    await postJson('/api/x');

    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: undefined,
      body: undefined,
    });
  });

  it("returns the route's own error message on a failed response", async () => {
    mockFetch(Response.json({ error: 'Слишком давно' }, { status: 400 }));

    expect(await postJson('/api/x', {})).toEqual({
      ok: false,
      error: 'Слишком давно',
    });
  });

  it('falls back to a generic message when the failure has no JSON body', async () => {
    mockFetch(new Response('boom', { status: 500 }));

    const result = await postJson('/api/x', {});

    expect(result).toEqual({
      ok: false,
      error: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    });
  });

  it('reports a network failure instead of throwing', async () => {
    mockFetch(new TypeError('Failed to fetch'));

    const result = await postJson('/api/x', {});

    expect(result).toEqual({
      ok: false,
      error: 'Нет соединения с сервером. Попробуйте ещё раз.',
    });
  });
});

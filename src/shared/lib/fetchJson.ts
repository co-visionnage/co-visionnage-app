export type FetchJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const FALLBACK_ERROR = 'Не удалось выполнить запрос. Попробуйте ещё раз.';
const NETWORK_ERROR = 'Нет соединения с сервером. Попробуйте ещё раз.';

/**
 * Browser request to our own origin (the Go API is proxied under /api/v1).
 * Returns the parsed JSON on success, or a user-facing message: the API's own
 * `error` text when it sent one, a generic one otherwise.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<FetchJsonResult<T>> {
  const { body, headers, ...rest } = init;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...rest,
      headers:
        body === undefined
          ? headers
          : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : undefined;

    if (response.ok) {
      return { ok: true, data: payload as T };
    }

    return {
      ok: false,
      status: response.status,
      error:
        (payload as { error?: string } | undefined)?.error ?? FALLBACK_ERROR,
    };
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

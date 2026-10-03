import { cookies, headers } from 'next/headers';

const DEFAULT_API_URL = 'http://localhost:8080';

export function apiBaseUrl() {
  return (process.env.API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown };

// Calls the Go API from the server on behalf of the current request: the
// session cookie is forwarded as-is (the API owns the session), and the
// original Host/proto are passed on so OAuth redirects and per-IP rate
// limits see the browser's view, not this server's.
export async function apiFetch(
  path: string,
  { body, headers: extraHeaders, ...init }: ApiInit = {},
): Promise<Response> {
  const [cookieStore, incoming] = await Promise.all([cookies(), headers()]);

  const requestHeaders = new Headers(extraHeaders);
  const cookie = cookieStore.toString();
  if (cookie) requestHeaders.set('Cookie', cookie);

  const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
  if (host) requestHeaders.set('X-Forwarded-Host', host);
  const proto = incoming.get('x-forwarded-proto');
  if (proto) requestHeaders.set('X-Forwarded-Proto', proto);
  const forwardedFor = incoming.get('x-forwarded-for');
  if (forwardedFor) requestHeaders.set('X-Forwarded-For', forwardedFor);

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  return fetch(`${apiBaseUrl()}/api/v1${path}`, {
    cache: 'no-store',
    ...init,
    headers: requestHeaders,
    body: payload,
  });
}

async function errorMessage(response: Response) {
  const payload = (await response.json().catch(() => {})) as
    | { error?: string }
    | undefined;
  return payload?.error ?? `Request failed (${response.status})`;
}

// JSON request that throws ApiError for any non-2xx status.
export async function apiJson<T>(path: string, init?: ApiInit): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Like apiJson, but 404 resolves to undefined (a missing entity is a normal
// outcome for page loaders, not an error).
export async function apiJsonOrUndefined<T>(
  path: string,
  init?: ApiInit,
): Promise<T | undefined> {
  try {
    return await apiJson<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

// Message for a failed server action: the API's own (already user-facing)
// message for API errors, the fallback for anything unexpected.
export function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

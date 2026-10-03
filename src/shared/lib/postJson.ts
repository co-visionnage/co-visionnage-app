export type PostJsonResult = { ok: true } | { ok: false; error: string };

const FALLBACK_ERROR = 'Не удалось выполнить запрос. Попробуйте ещё раз.';
const NETWORK_ERROR = 'Нет соединения с сервером. Попробуйте ещё раз.';

/**
 * POST к нашему же роуту. Возвращает либо успех, либо понятный текст ошибки:
 * `error` из JSON-ответа роута, а при сетевом сбое -- общее сообщение.
 */
export async function postJson(
  url: string,
  body?: unknown,
): Promise<PostJsonResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.ok) {
      return { ok: true };
    }

    const data = (await response.json().catch(() => {})) as {
      error?: string;
    } | null;

    return { ok: false, error: data?.error ?? FALLBACK_ERROR };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

const MAIL_URL = `http://localhost:${process.env.FAKE_RESEND_PORT ?? 18_025}`;

export type Letter = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
};

async function fetchMailbox(to: string): Promise<Letter[]> {
  const response = await fetch(
    `${MAIL_URL}/_mailbox?to=${encodeURIComponent(to)}`,
  );
  return (await response.json()) as Letter[];
}

/**
 * Waits for a letter to `to` (optionally with `subject` containing a
 * fragment) -- the worker sends mail asynchronously, a moment after the
 * action that caused it. `skip` ignores that many matching letters, to wait
 * for a second letter of the same kind (for example after "resend").
 */
export async function waitForLetter(
  to: string,
  { subject, skip = 0, timeoutMs = 20_000 } = {} as {
    subject?: string;
    skip?: number;
    timeoutMs?: number;
  },
): Promise<Letter> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mailbox = await fetchMailbox(to);
    const matching = mailbox.filter(
      (letter) => !subject || letter.subject.includes(subject),
    );
    if (matching.length > skip) return matching[skip];

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `no letter to ${to}${subject ? ` with "${subject}"` : ''} within ${timeoutMs} ms`,
  );
}

/**
 * First link in the letter whose path starts with `path` (for example
 * "/verify-email"), returned as path + query so it can be opened with
 * page.goto() against the test server whatever host the letter names.
 */
export function linkTo(letter: Letter, path: string): string {
  const body = `${letter.html ?? ''}\n${letter.text ?? ''}`.replaceAll(
    '&amp;',
    '&',
  );
  const pattern = new RegExp(
    String.raw`https?://[^\s"'<>]+?(${path.replaceAll('/', String.raw`\/`)}[^\s"'<>]*)`,
  );
  const match = pattern.exec(body);

  if (!match) {
    throw new Error(`no link to ${path} in the letter "${letter.subject}"`);
  }

  return match[1];
}

export async function clearMailbox() {
  await fetch(`${MAIL_URL}/_mailbox`, { method: 'DELETE' });
}

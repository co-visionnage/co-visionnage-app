import { Resend } from 'resend';

import { ENV } from '@/shared/config/environment';

let client: Resend | undefined;

function getClient() {
  if (!ENV.RESEND_API_KEY || !ENV.RESEND_FROM_EMAIL) return undefined;
  client ??= new Resend(ENV.RESEND_API_KEY);
  return client;
}

export async function notifyFamilyByEmail(
  recipients: string[],
  subject: string,
  text: string,
): Promise<void> {
  const resend = getClient();
  if (!resend || recipients.length === 0) return;

  try {
    await resend.emails.send({
      from: ENV.RESEND_FROM_EMAIL!,
      to: recipients,
      subject,
      text,
    });
  } catch {
    // best-effort — email delivery must never block the underlying series action
  }
}

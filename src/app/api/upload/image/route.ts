import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/shared/api/postgres/server';
import { sniffImageType, uploadImageToStorage } from '@/shared/api/storage/s3';
import { checkRateLimit, getClientIp } from '@/shared/lib/rateLimit';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Per-user: caps how much storage/bandwidth one compromised or malicious
// account can burn. Per-IP: a looser backstop against one IP spinning up
// many accounts to get around the per-user cap.
const USER_RATE_LIMIT_MAX_ATTEMPTS = 20;
const USER_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const IP_RATE_LIMIT_MAX_ATTEMPTS = 60;
const IP_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

export async function POST(request: Request) {
  const user = await requireCurrentUser().catch(() => {});

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const isWithinIpLimit = await checkRateLimit(
    `upload:ip:${getClientIp(request)}`,
    IP_RATE_LIMIT_MAX_ATTEMPTS,
    IP_RATE_LIMIT_WINDOW_SECONDS,
  );
  const isWithinUserLimit = await checkRateLimit(
    `upload:user:${user.id}`,
    USER_RATE_LIMIT_MAX_ATTEMPTS,
    USER_RATE_LIMIT_WINDOW_SECONDS,
  );

  if (!isWithinIpLimit || !isWithinUserLimit) {
    return NextResponse.json(
      { error: 'Слишком много загрузок. Попробуйте позже.' },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: 'Изображение должно быть не больше 5 МБ' },
      { status: 400 },
    );
  }

  // The client-supplied Content-Type and filename are both fully
  // attacker-controlled -- validate the actual bytes instead. This also
  // rejects image/svg+xml, which can carry an embedded <script> and would
  // otherwise be served back publicly with that content-type.
  const payload = Buffer.from(await file.arrayBuffer());
  const image = sniffImageType(payload);

  if (!image) {
    return NextResponse.json(
      { error: 'Можно загружать только изображения (PNG, JPEG, GIF, WebP)' },
      { status: 400 },
    );
  }

  try {
    const url = await uploadImageToStorage(payload, image);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: 'Не удалось загрузить изображение' },
      { status: 500 },
    );
  }
}

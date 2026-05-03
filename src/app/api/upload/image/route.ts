import { NextResponse } from 'next/server';

import { requireCurrentUser } from '@/shared/api/postgres/server';
import { uploadImageToStorage } from '@/shared/api/storage/s3';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  await requireCurrentUser();

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Можно загружать только изображения' },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: 'Изображение должно быть не больше 5 МБ' },
      { status: 400 },
    );
  }

  try {
    const url = await uploadImageToStorage(file);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить изображение',
      },
      { status: 500 },
    );
  }
}

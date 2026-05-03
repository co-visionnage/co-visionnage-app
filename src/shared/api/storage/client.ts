async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => {})) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? 'Upload failed');
  }

  return response.json() as Promise<T>;
}

export async function uploadSeriesImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload/image', {
    method: 'POST',
    body: formData,
  });

  const payload = await readJson<{ url: string }>(response);
  return payload.url;
}

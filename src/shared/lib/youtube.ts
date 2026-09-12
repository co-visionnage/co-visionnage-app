const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
];

export function extractYoutubeId(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

export function toYoutubeEmbedUrl(url: string): string | undefined {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : undefined;
}

import { describe, expect, it } from 'vitest';

import { extractYoutubeId, toYoutubeEmbedUrl } from './youtube';

describe('extractYoutubeId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(
      extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a shortened youtu.be URL', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts the id from an embed URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts the id from a Shorts URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts the id when the watch URL has extra query params', () => {
    expect(
      extractYoutubeId(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s',
      ),
    ).toBe('dQw4w9WgXcQ');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(extractYoutubeId('  https://youtu.be/dQw4w9WgXcQ  ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('returns undefined for an empty string', () => {
    expect(extractYoutubeId('')).toBeUndefined();
    expect(extractYoutubeId('   ')).toBeUndefined();
  });

  it('returns undefined for a non-YouTube URL', () => {
    expect(extractYoutubeId('https://vimeo.com/12345678')).toBeUndefined();
  });

  it('returns undefined for a malformed YouTube URL', () => {
    expect(
      extractYoutubeId('https://www.youtube.com/watch?v=short'),
    ).toBeUndefined();
  });
});

describe('toYoutubeEmbedUrl', () => {
  it('builds a canonical embed URL from a watch URL', () => {
    expect(
      toYoutubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('builds a canonical embed URL from a youtu.be URL', () => {
    expect(toYoutubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('returns undefined when no id can be extracted', () => {
    expect(toYoutubeEmbedUrl('not a url')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { backupCodesFileContent } from './backupCodesFile';

describe('backupCodesFileContent', () => {
  const codes = ['aaaa-1111', 'bbbb-2222', 'cccc-3333'];
  const text = backupCodesFileContent(codes, new Date(2026, 9, 15));

  it('lists every code on its own numbered line', () => {
    for (const [index, code] of codes.entries()) {
      expect(text).toContain(`\n${index + 1}. ${code}\n`);
    }
  });

  it('says what the codes are and when they were issued', () => {
    expect(text).toContain('резервные коды двухфакторной аутентификации');
    expect(text).toContain('15 октября 2026');
    expect(text).toContain('подходит один раз');
  });

  it('ends with a newline so the file is a well-formed text file', () => {
    expect(text.endsWith('\n')).toBe(true);
  });
});

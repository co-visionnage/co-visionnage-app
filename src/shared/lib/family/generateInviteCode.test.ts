import { describe, expect, it } from 'vitest';

import { generateInviteCode } from './generateInviteCode';

describe('generateInviteCode', () => {
  it('has the BRTL- prefix followed by 6 characters from the expected alphabet', () => {
    const code = generateInviteCode();

    expect(code).toMatch(/^BRTL-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('excludes visually ambiguous characters (0, O, 1, I)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it('produces different codes across calls', () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => generateInviteCode()),
    );

    // Collisions are possible in principle (32^6 space) but 50 draws all
    // matching would indicate the generator is broken, not bad luck.
    expect(codes.size).toBeGreaterThan(1);
  });
});

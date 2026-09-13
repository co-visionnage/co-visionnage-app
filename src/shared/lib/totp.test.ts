import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';

import { generateTotpQrCode, generateTotpSecret, verifyTotpCode } from './totp';

describe('generateTotpSecret', () => {
  it('generates a non-empty base32-looking secret', () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('generates a different secret on each call', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe('verifyTotpCode', () => {
  it('accepts a code freshly generated for the same secret', async () => {
    const secret = generateTotpSecret();
    const token = await generate({ secret });

    await expect(verifyTotpCode(token, secret)).resolves.toBe(true);
  });

  it('rejects an all-zero code', async () => {
    const secret = generateTotpSecret();

    await expect(verifyTotpCode('000000', secret)).resolves.toBe(false);
  });

  it('rejects a code generated for a different secret', async () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const token = await generate({ secret: secretB });

    await expect(verifyTotpCode(token, secretA)).resolves.toBe(false);
  });

  it('tolerates surrounding whitespace in the submitted code', async () => {
    const secret = generateTotpSecret();
    const token = await generate({ secret });

    await expect(verifyTotpCode(`  ${token}  `, secret)).resolves.toBe(true);
  });

  it('returns false instead of throwing for a malformed secret', async () => {
    await expect(verifyTotpCode('123456', 'not-valid-base32!!')).resolves.toBe(
      false,
    );
  });
});

describe('generateTotpQrCode', () => {
  it('returns a PNG data URL', async () => {
    const secret = generateTotpSecret();
    const dataUrl = await generateTotpQrCode('tester@example.com', secret);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function verifyTotpCode(
  code: string,
  secret: string,
): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code.trim() });
    return result.valid;
  } catch {
    return false;
  }
}

export async function generateTotpQrCode(
  email: string,
  secret: string,
): Promise<string> {
  const otpauthUrl = generateURI({
    issuer: 'notre-cinema',
    label: email,
    secret,
  });
  return QRCode.toDataURL(otpauthUrl);
}

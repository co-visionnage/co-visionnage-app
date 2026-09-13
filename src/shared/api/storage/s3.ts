import { createHash, createHmac, randomUUID } from 'node:crypto';

import { ENV } from '@/shared/config/environment';

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';

function requiredStorageConfig() {
  if (
    !ENV.STORAGE_ENDPOINT ||
    !ENV.STORAGE_REGION ||
    !ENV.STORAGE_ACCESS_KEY ||
    !ENV.STORAGE_SECRET_KEY ||
    !ENV.STORAGE_BUCKET
  ) {
    throw new Error('Storage environment variables are not configured');
  }

  return {
    endpoint: ENV.STORAGE_ENDPOINT.replace(/\/$/, ''),
    region: ENV.STORAGE_REGION,
    accessKey: ENV.STORAGE_ACCESS_KEY,
    secretKey: ENV.STORAGE_SECRET_KEY,
    bucket: ENV.STORAGE_BUCKET,
    publicUrl:
      ENV.STORAGE_PUBLIC_URL?.replace(/\/$/, '') ??
      `${ENV.STORAGE_ENDPOINT.replace(/\/$/, '')}/${ENV.STORAGE_BUCKET}`,
  };
}

function hashSha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

type SniffedImage = { extension: string; mimeType: string };

// Magic-byte signatures for the image types this app actually renders as
// <img>/next/image sources -- deliberately does NOT include image/svg+xml,
// which can carry an embedded <script> and would be served back with
// X-Amz-Acl: public-read. Checked against the file's real bytes, never the
// client-supplied Content-Type or filename extension (both fully
// attacker-controlled): trusting either would let a malicious upload choose
// its own served content-type and object-key extension.
const IMAGE_SIGNATURES: {
  extension: string;
  matches: (buffer: Buffer) => boolean;
  mimeType: string;
}[] = [
  {
    extension: 'png',
    mimeType: 'image/png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    extension: 'gif',
    mimeType: 'image/gif',
    matches: (buffer) =>
      buffer.length >= 6 &&
      ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('latin1')),
  },
  {
    extension: 'webp',
    mimeType: 'image/webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function sniffImageType(buffer: Buffer): SniffedImage | undefined {
  const signature = IMAGE_SIGNATURES.find((entry) => entry.matches(buffer));
  return (
    signature && {
      extension: signature.extension,
      mimeType: signature.mimeType,
    }
  );
}

function createSignedHeaders({
  bucket,
  endpoint,
  key,
  mimeType,
  payload,
}: {
  bucket: string;
  endpoint: string;
  key: string;
  mimeType: string;
  payload: Buffer;
}) {
  const { accessKey, region, secretKey } = requiredStorageConfig();
  const requestDate = new Date().toISOString().replaceAll(/[:-]|\.\d{3}/g, '');
  const dateStamp = requestDate.slice(0, 8);
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const host = url.host;
  const canonicalUri = `/${bucket}/${key}`;
  const payloadHash = hashSha256(payload);
  const signedHeaders =
    'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `content-type:${mimeType}\n` +
    `host:${host}\n` +
    'x-amz-acl:public-read\n' +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${requestDate}\n`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    requestDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), SERVICE),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  return {
    url: url.toString(),
    headers: {
      Authorization:
        `${ALGORITHM} Credential=${accessKey}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': mimeType,
      'X-Amz-Acl': 'public-read',
      'X-Amz-Content-Sha256': payloadHash,
      'X-Amz-Date': requestDate,
    },
  };
}

export async function uploadImageToStorage(
  payload: Buffer<ArrayBuffer>,
  image: SniffedImage,
) {
  const { endpoint, bucket, publicUrl } = requiredStorageConfig();
  const objectKey = `series-images/${Date.now()}-${randomUUID()}.${image.extension}`;
  const { url, headers } = createSignedHeaders({
    bucket,
    endpoint,
    key: objectKey,
    mimeType: image.mimeType,
    payload,
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: payload,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    // Logged, not returned to the caller: this can include bucket names and
    // raw S3 error XML, which shouldn't reach the client.
    console.error(
      `uploadImageToStorage: PUT failed (${response.status}): ${details || response.statusText}`,
    );
    throw new Error('Storage upload failed');
  }

  return `${publicUrl}/${objectKey}`;
}

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

function guessExtension(fileName: string, mimeType: string) {
  const rawExtension = fileName.split('.').pop()?.toLowerCase();
  if (rawExtension && /^[a-z0-9]+$/.test(rawExtension)) {
    return rawExtension;
  }

  switch (mimeType) {
    case 'image/jpeg': {
      return 'jpg';
    }
    case 'image/png': {
      return 'png';
    }
    case 'image/webp': {
      return 'webp';
    }
    case 'image/gif': {
      return 'gif';
    }
    default: {
      return 'bin';
    }
  }
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

export async function uploadImageToStorage(file: File) {
  const { endpoint, bucket, publicUrl } = requiredStorageConfig();
  const mimeType = file.type || 'application/octet-stream';
  const extension = guessExtension(file.name, mimeType);
  const objectKey = `series-images/${Date.now()}-${randomUUID()}.${extension}`;
  const payload = Buffer.from(await file.arrayBuffer());
  const { url, headers } = createSignedHeaders({
    bucket,
    endpoint,
    key: objectKey,
    mimeType,
    payload,
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: payload,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Storage upload failed: ${details || response.statusText}`);
  }

  return `${publicUrl}/${objectKey}`;
}

import { ServiceUnavailableException } from '@nestjs/common';
import { MediaKind, MediaProvider } from '@cabin/api-contract';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue(
      'https://account.r2.cloudflarestorage.com/bucket/inventory/key?X-Amz-Signature=abc',
    ),
}));

jest.mock('@aws-sdk/client-s3', () => {
  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class S3Client {
    constructor(public readonly config: unknown) {}
  }
  return { PutObjectCommand, S3Client };
});

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudflareR2MediaStorageAdapter } from './cloudflare-r2.adapter.js';

describe('CloudflareR2MediaStorageAdapter', () => {
  const adapter = new CloudflareR2MediaStorageAdapter();
  const prev = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET,
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL,
  };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct123';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'akid';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret';
    process.env.CLOUDFLARE_R2_BUCKET = 'cabin-media';
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.example.com';
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://account.r2.cloudflarestorage.com/bucket/inventory/key?X-Amz-Signature=abc',
    );
  });

  afterEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = prev.accountId;
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = prev.accessKeyId;
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = prev.secretAccessKey;
    process.env.CLOUDFLARE_R2_BUCKET = prev.bucket;
    process.env.MEDIA_PUBLIC_BASE_URL = prev.publicBaseUrl;
  });

  it('returns R2-shaped intent with presigned PUT and public delivery URL', async () => {
    const intent = await adapter.createUploadIntent({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      kind: MediaKind.IMAGE,
      mimeType: 'image/webp',
      byteSize: 4096,
    });

    expect(intent.provider).toBe(MediaProvider.CLOUDFLARE_R2);
    if (intent.provider !== MediaProvider.CLOUDFLARE_R2) {
      throw new Error('expected cloudflare_r2 intent');
    }
    expect(intent.upload.method).toBe('PUT');
    expect(intent.upload.headers['Content-Type']).toBe('image/webp');
    expect(intent.upload.url).toContain('X-Amz-Signature');
    expect(intent.delivery.publicUrl).toMatch(
      /^https:\/\/media\.example\.com\/inventory\/\d{4}\/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb$/,
    );
    expect(getSignedUrl).toHaveBeenCalled();
  });

  it('uses public base URL for videos', async () => {
    const intent = await adapter.createUploadIntent({
      id: 'vid-1',
      kind: MediaKind.VIDEO,
      mimeType: 'video/webm',
      byteSize: 100,
    });

    expect(intent.provider).toBe(MediaProvider.CLOUDFLARE_R2);
    if (intent.provider !== MediaProvider.CLOUDFLARE_R2) {
      throw new Error('expected cloudflare_r2 intent');
    }
    expect(intent.delivery.publicUrl).toMatch(
      /^https:\/\/media\.example\.com\/inventory\/\d{4}\/vid-1$/,
    );
  });

  it('throws when R2 env is missing', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;

    await expect(
      adapter.createUploadIntent({
        id: 'x',
        kind: MediaKind.IMAGE,
        mimeType: 'image/jpeg',
        byteSize: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

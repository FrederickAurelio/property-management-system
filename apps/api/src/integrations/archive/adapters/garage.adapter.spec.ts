import { ServiceUnavailableException } from '@nestjs/common';
import { ArchiveKind, ArchiveProvider } from '@cabin/api-contract';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue(
      'http://127.0.0.1:3900/cabin-archive/archive/key?X-Amz-Signature=abc',
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
import { GarageArchiveStorageAdapter } from './garage.adapter.js';

describe('GarageArchiveStorageAdapter', () => {
  const adapter = new GarageArchiveStorageAdapter();
  const prev = {
    endpoint: process.env.ARCHIVE_S3_ENDPOINT,
    region: process.env.ARCHIVE_S3_REGION,
    accessKeyId: process.env.ARCHIVE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.ARCHIVE_S3_SECRET_ACCESS_KEY,
    bucket: process.env.ARCHIVE_S3_BUCKET,
    forcePathStyle: process.env.ARCHIVE_S3_FORCE_PATH_STYLE,
    publicBaseUrl: process.env.ARCHIVE_PUBLIC_BASE_URL,
  };

  beforeEach(() => {
    process.env.ARCHIVE_S3_ENDPOINT = 'http://127.0.0.1:3900';
    process.env.ARCHIVE_S3_REGION = 'garage';
    process.env.ARCHIVE_S3_ACCESS_KEY_ID = 'GKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    process.env.ARCHIVE_S3_SECRET_ACCESS_KEY =
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    process.env.ARCHIVE_S3_BUCKET = 'cabin-archive';
    process.env.ARCHIVE_S3_FORCE_PATH_STYLE = 'true';
    process.env.ARCHIVE_PUBLIC_BASE_URL = 'http://127.0.0.1:3910';
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'http://127.0.0.1:3900/cabin-archive/archive/key?X-Amz-Signature=abc',
    );
  });

  afterEach(() => {
    process.env.ARCHIVE_S3_ENDPOINT = prev.endpoint;
    process.env.ARCHIVE_S3_REGION = prev.region;
    process.env.ARCHIVE_S3_ACCESS_KEY_ID = prev.accessKeyId;
    process.env.ARCHIVE_S3_SECRET_ACCESS_KEY = prev.secretAccessKey;
    process.env.ARCHIVE_S3_BUCKET = prev.bucket;
    process.env.ARCHIVE_S3_FORCE_PATH_STYLE = prev.forcePathStyle;
    process.env.ARCHIVE_PUBLIC_BASE_URL = prev.publicBaseUrl;
  });

  it('returns Garage-shaped intent with presigned PUT and public delivery URL', async () => {
    const intent = await adapter.createUploadIntent({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      kind: ArchiveKind.IMAGE,
      mimeType: 'image/webp',
      byteSize: 4096,
    });

    expect(intent.provider).toBe(ArchiveProvider.GARAGE);
    expect(intent.upload.method).toBe('PUT');
    expect(intent.upload.headers['Content-Type']).toBe('image/webp');
    expect(intent.upload.url).toContain('X-Amz-Signature');
    expect(intent.delivery.publicUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:3910\/archive\/\d{4}\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa$/,
    );
    expect(getSignedUrl).toHaveBeenCalled();
  });

  it('throws when Garage env is missing', async () => {
    delete process.env.ARCHIVE_S3_ENDPOINT;

    await expect(
      adapter.createUploadIntent({
        id: 'x',
        kind: ArchiveKind.IMAGE,
        mimeType: 'image/jpeg',
        byteSize: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

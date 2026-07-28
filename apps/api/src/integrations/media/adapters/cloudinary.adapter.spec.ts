import { ServiceUnavailableException } from '@nestjs/common';
import { MediaKind, MediaProvider } from '@cabin/api-contract';
import { CloudinaryMediaStorageAdapter } from './cloudinary.adapter.js';

describe('CloudinaryMediaStorageAdapter', () => {
  const adapter = new CloudinaryMediaStorageAdapter();
  const prev = {
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
  };

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = prev.name;
    process.env.CLOUDINARY_API_KEY = prev.key;
    process.env.CLOUDINARY_API_SECRET = prev.secret;
  });

  it('returns cloudinary-shaped intent with signed fields', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'secret456';

    const intent = await adapter.createUploadIntent({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      kind: MediaKind.IMAGE,
      mimeType: 'image/jpeg',
      byteSize: 2048,
    });

    expect(intent.provider).toBe(MediaProvider.CLOUDINARY);
    if (intent.provider !== MediaProvider.CLOUDINARY) {
      throw new Error('expected cloudinary intent');
    }
    expect(intent.upload.method).toBe('POST');
    expect(intent.upload.url).toContain(
      'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
    );
    expect(intent.upload.fields.api_key).toBe('key123');
    expect(intent.upload.fields.signature).toEqual(expect.any(String));
    expect(intent.upload.fields.folder).toMatch(/^inventory\/\d{4}$/);
    expect(intent.upload.fields.public_id).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(intent.upload.fields.transformation).toBe('c_limit,w_1920');
    expect(intent.delivery).toEqual({
      cloudName: 'demo-cloud',
      resourceType: 'image',
      publicId: expect.stringMatching(
        /^inventory\/\d{4}\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee$/,
      ) as string,
    });
  });

  it('omits transformation for video', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'secret456';

    const intent = await adapter.createUploadIntent({
      id: 'vid-1',
      kind: MediaKind.VIDEO,
      mimeType: 'video/mp4',
      byteSize: 1024,
    });

    expect(intent.upload.url).toContain('/video/upload');
    if (intent.provider !== MediaProvider.CLOUDINARY) {
      throw new Error('expected cloudinary intent');
    }
    expect(intent.upload.fields.transformation).toBeUndefined();
    expect(intent.delivery.resourceType).toBe('video');
  });

  it('throws when Cloudinary env is missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(
      adapter.createUploadIntent({
        id: 'x',
        kind: MediaKind.IMAGE,
        mimeType: 'image/png',
        byteSize: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

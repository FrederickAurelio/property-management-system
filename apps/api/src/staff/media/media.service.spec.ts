import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaKind, MediaProvider } from '@cabin/api-contract';
import {
  MEDIA_STORAGE,
  type MediaStoragePort,
} from '../../integrations/media/media-storage.port.js';
import { MediaService } from './media.service.js';

describe('MediaService', () => {
  let service: MediaService;
  let mediaStorage: { createUploadIntent: jest.Mock };

  beforeEach(async () => {
    mediaStorage = {
      createUploadIntent: jest.fn().mockResolvedValue({
        id: 'media-1',
        provider: MediaProvider.CLOUDINARY,
        upload: {
          url: 'https://api.cloudinary.com/v1_1/demo/image/upload',
          method: 'POST',
          fields: { api_key: 'k', timestamp: '1', signature: 's' },
        },
        delivery: {
          cloudName: 'demo',
          resourceType: 'image',
          publicId: 'inventory/2026/media-1',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: MEDIA_STORAGE,
          useValue: mediaStorage satisfies MediaStoragePort,
        },
      ],
    }).compile();

    service = module.get(MediaService);
  });

  it('delegates to media storage port after validation', async () => {
    const result = await service.createUploadIntent({
      kind: MediaKind.IMAGE,
      mimeType: 'image/jpeg',
      byteSize: 1024,
    });

    expect(mediaStorage.createUploadIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: MediaKind.IMAGE,
        mimeType: 'image/jpeg',
        byteSize: 1024,
        id: expect.any(String) as string,
      }),
    );
    expect(result.provider).toBe(MediaProvider.CLOUDINARY);
  });

  it('rejects unsupported image mime', async () => {
    await expect(
      service.createUploadIntent({
        kind: MediaKind.IMAGE,
        mimeType: 'image/gif',
        byteSize: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaStorage.createUploadIntent).not.toHaveBeenCalled();
  });

  it('rejects oversized video', async () => {
    await expect(
      service.createUploadIntent({
        kind: MediaKind.VIDEO,
        mimeType: 'video/mp4',
        byteSize: 40 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mediaStorage.createUploadIntent).not.toHaveBeenCalled();
  });

  it('returns active media provider from env', () => {
    const prev = process.env.MEDIA_PROVIDER;
    process.env.MEDIA_PROVIDER = 'cloudflare_r2';
    try {
      expect(service.getConfig()).toEqual({
        provider: MediaProvider.CLOUDFLARE_R2,
      });
    } finally {
      process.env.MEDIA_PROVIDER = prev;
    }
  });
});

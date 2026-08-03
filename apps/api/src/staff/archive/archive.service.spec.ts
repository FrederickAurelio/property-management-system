import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveKind, ArchiveProvider } from '@cabin/api-contract';
import {
  ARCHIVE_STORAGE,
  type ArchiveStoragePort,
} from '../../integrations/archive/archive-storage.port.js';
import { ArchiveService } from './archive.service.js';

describe('ArchiveService', () => {
  let service: ArchiveService;
  let archiveStorage: { createUploadIntent: jest.Mock };

  beforeEach(async () => {
    archiveStorage = {
      createUploadIntent: jest.fn().mockResolvedValue({
        id: 'archive-1',
        provider: ArchiveProvider.GARAGE,
        upload: {
          url: 'http://127.0.0.1:3900/cabin-archive/key?X-Amz-Signature=abc',
          method: 'PUT',
          headers: { 'Content-Type': 'image/webp' },
        },
        delivery: {
          publicUrl: 'http://127.0.0.1:3910/archive/2026/archive-1',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
        {
          provide: ARCHIVE_STORAGE,
          useValue: archiveStorage satisfies ArchiveStoragePort,
        },
      ],
    }).compile();

    service = module.get(ArchiveService);
  });

  it('delegates to archive storage port after validation', async () => {
    const result = await service.createUploadIntent({
      kind: ArchiveKind.IMAGE,
      mimeType: 'image/jpeg',
      byteSize: 1024,
    });

    expect(archiveStorage.createUploadIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: ArchiveKind.IMAGE,
        mimeType: 'image/jpeg',
        byteSize: 1024,
        id: expect.any(String) as string,
      }),
    );
    expect(result.provider).toBe(ArchiveProvider.GARAGE);
  });

  it('rejects unsupported image mime', async () => {
    await expect(
      service.createUploadIntent({
        kind: ArchiveKind.IMAGE,
        mimeType: 'image/gif',
        byteSize: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(archiveStorage.createUploadIntent).not.toHaveBeenCalled();
  });

  it('rejects oversized image', async () => {
    await expect(
      service.createUploadIntent({
        kind: ArchiveKind.IMAGE,
        mimeType: 'image/webp',
        byteSize: 3 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(archiveStorage.createUploadIntent).not.toHaveBeenCalled();
  });

  it('returns active archive provider from env', () => {
    const prev = process.env.ARCHIVE_PROVIDER;
    process.env.ARCHIVE_PROVIDER = 'garage';
    try {
      expect(service.getConfig()).toEqual({
        provider: ArchiveProvider.GARAGE,
      });
    } finally {
      process.env.ARCHIVE_PROVIDER = prev;
    }
  });
});

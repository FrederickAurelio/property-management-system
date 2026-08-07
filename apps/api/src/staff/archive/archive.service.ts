import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ArchiveKind,
  ARCHIVE_IMAGE_MAX_BYTES,
  ARCHIVE_IMAGE_MIME_TYPES,
  type ArchiveUploadIntent,
  type StaffArchiveConfig,
} from '@cabin/api-contract';
import {
  ARCHIVE_STORAGE,
  type ArchiveStoragePort,
} from '../../integrations/archive/archive-storage.port.js';
import { resolveArchiveProvider } from '../../integrations/archive/resolve-archive-provider.js';
import type { CreateArchiveUploadIntentDto } from './dto/create-archive-upload-intent.dto.js';

@Injectable()
export class ArchiveService {
  constructor(
    @Inject(ARCHIVE_STORAGE)
    private readonly archiveStorage: ArchiveStoragePort,
  ) {}

  getConfig(): StaffArchiveConfig {
    return { provider: resolveArchiveProvider() };
  }

  async createUploadIntent(
    dto: CreateArchiveUploadIntentDto,
  ): Promise<ArchiveUploadIntent> {
    this.assertMimeAndSize(dto);

    return this.archiveStorage.createUploadIntent({
      id: randomUUID(),
      kind: dto.kind,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });
  }

  private assertMimeAndSize(dto: CreateArchiveUploadIntentDto): void {
    const mime = dto.mimeType.toLowerCase();

    if (dto.kind !== ArchiveKind.IMAGE) {
      throw new BadRequestException(
        `Unsupported archive kind: ${String(dto.kind)}`,
      );
    }

    if (!(ARCHIVE_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
      throw new BadRequestException(
        `Unsupported image type: ${dto.mimeType}. Allowed: ${ARCHIVE_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }
    if (dto.byteSize > ARCHIVE_IMAGE_MAX_BYTES) {
      throw new BadRequestException(
        `Image exceeds max size of ${ARCHIVE_IMAGE_MAX_BYTES} bytes`,
      );
    }
  }
}

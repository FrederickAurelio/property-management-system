import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MediaKind,
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_VIDEO_MAX_BYTES,
  MEDIA_VIDEO_MIME_TYPES,
  type MediaUploadIntent,
  type StaffMediaConfig,
} from '@cabin/api-contract';
import {
  MEDIA_STORAGE,
  type MediaStoragePort,
} from '../../integrations/media/media-storage.port.js';
import { resolveMediaProvider } from '../../integrations/media/resolve-media-provider.js';
import type { CreateUploadIntentDto } from './dto/create-upload-intent.dto.js';

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE)
    private readonly mediaStorage: MediaStoragePort,
  ) {}

  getConfig(): StaffMediaConfig {
    return { provider: resolveMediaProvider() };
  }

  async createUploadIntent(
    dto: CreateUploadIntentDto,
  ): Promise<MediaUploadIntent> {
    this.assertMimeAndSize(dto);

    return this.mediaStorage.createUploadIntent({
      id: randomUUID(),
      kind: dto.kind,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });
  }

  private assertMimeAndSize(dto: CreateUploadIntentDto): void {
    const mime = dto.mimeType.toLowerCase();

    if (dto.kind === MediaKind.IMAGE) {
      if (!(MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
        throw new BadRequestException(
          `Unsupported image type: ${dto.mimeType}. Allowed: ${MEDIA_IMAGE_MIME_TYPES.join(', ')}`,
        );
      }
      if (dto.byteSize > MEDIA_IMAGE_MAX_BYTES) {
        throw new BadRequestException(
          `Image exceeds max size of ${MEDIA_IMAGE_MAX_BYTES} bytes`,
        );
      }
      return;
    }

    if (!(MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
      throw new BadRequestException(
        `Unsupported video type: ${dto.mimeType}. Allowed: ${MEDIA_VIDEO_MIME_TYPES.join(', ')}`,
      );
    }
    if (dto.byteSize > MEDIA_VIDEO_MAX_BYTES) {
      throw new BadRequestException(
        `Video exceeds max size of ${MEDIA_VIDEO_MAX_BYTES} bytes`,
      );
    }
  }
}

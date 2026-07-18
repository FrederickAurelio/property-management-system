import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  MediaKind,
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_MAX_EDGE_PX,
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_VIDEO_MAX_BYTES,
  MEDIA_VIDEO_MIME_TYPES,
  type MediaUploadIntent,
} from '@cabin/api-contract';
import type { CreateUploadIntentDto } from './dto/create-upload-intent.dto.js';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

@Injectable()
export class MediaService {
  createUploadIntent(dto: CreateUploadIntentDto): MediaUploadIntent {
    this.assertMimeAndSize(dto);

    const config = this.readConfig();
    const id = randomUUID();
    const year = new Date().getUTCFullYear();
    const folder = `inventory/${year}`;
    const publicId = id;
    const timestamp = Math.floor(Date.now() / 1000);
    const resourceType = dto.kind === MediaKind.IMAGE ? 'image' : 'video';

    const paramsToSign: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    };

    let transformation: string | undefined;
    if (dto.kind === MediaKind.IMAGE) {
      // Limit stored pixels; delivery still uses f_auto,q_auto on the FE URL.
      transformation = `c_limit,w_${MEDIA_IMAGE_MAX_EDGE_PX}`;
      paramsToSign.transformation = transformation;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      config.apiSecret,
    );

    return {
      id,
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      timestamp,
      signature,
      folder,
      publicId,
      resourceType,
      ...(transformation ? { transformation } : {}),
    };
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

  private readConfig(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the root .env',
      );
    }

    return { cloudName, apiKey, apiSecret };
  }
}

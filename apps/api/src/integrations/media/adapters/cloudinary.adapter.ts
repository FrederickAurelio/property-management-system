import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  MediaKind,
  MediaProvider,
  MEDIA_IMAGE_MAX_EDGE_PX,
  type MediaUploadIntent,
} from '@cabin/api-contract';
import type {
  CreateMediaUploadIntentInput,
  MediaStoragePort,
} from '../media-storage.port.js';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

@Injectable()
export class CloudinaryMediaStorageAdapter implements MediaStoragePort {
  // Sync signing; async to match MediaStoragePort and surface errors as rejections.
  // eslint-disable-next-line @typescript-eslint/require-await -- interface is Promise-based
  async createUploadIntent(
    input: CreateMediaUploadIntentInput,
  ): Promise<MediaUploadIntent> {
    const config = this.readConfig();
    const year = new Date().getUTCFullYear();
    const folder = `inventory/${year}`;
    const publicId = input.id;
    const timestamp = Math.floor(Date.now() / 1000);
    const resourceType = input.kind === MediaKind.IMAGE ? 'image' : 'video';

    const paramsToSign: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    };

    let transformation: string | undefined;
    if (input.kind === MediaKind.IMAGE) {
      transformation = `c_limit,w_${MEDIA_IMAGE_MAX_EDGE_PX}`;
      paramsToSign.transformation = transformation;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      config.apiSecret,
    );

    const fields: Record<string, string> = {
      api_key: config.apiKey,
      timestamp: String(timestamp),
      signature,
      folder,
      public_id: publicId,
    };
    if (transformation) {
      fields.transformation = transformation;
    }

    return {
      id: input.id,
      provider: MediaProvider.CLOUDINARY,
      upload: {
        url: `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
        method: 'POST',
        fields,
      },
      delivery: {
        cloudName: config.cloudName,
        resourceType,
        publicId: `${folder}/${publicId}`,
      },
    };
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

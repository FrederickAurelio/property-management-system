import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaProvider, type MediaUploadIntent } from '@cabin/api-contract';
import type {
  CreateMediaUploadIntentInput,
  MediaStoragePort,
} from '../media-storage.port.js';

/** Presigned PUT lifetime — short bearer token for browser upload. */
const PRESIGN_EXPIRES_SECONDS = 900;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

@Injectable()
export class CloudflareR2MediaStorageAdapter implements MediaStoragePort {
  private client: S3Client | null = null;
  private cachedConfig: R2Config | null = null;

  async createUploadIntent(
    input: CreateMediaUploadIntentInput,
  ): Promise<MediaUploadIntent> {
    const config = this.readConfig();
    const year = new Date().getUTCFullYear();
    const key = `inventory/${year}/${input.id}`;

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.getClient(config), command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    return {
      id: input.id,
      provider: MediaProvider.CLOUDFLARE_R2,
      upload: {
        url: uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': input.mimeType },
      },
      delivery: {
        publicUrl: `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`,
      },
    };
  }

  private getClient(config: R2Config): S3Client {
    if (
      this.client &&
      this.cachedConfig &&
      this.cachedConfig.accountId === config.accountId &&
      this.cachedConfig.accessKeyId === config.accessKeyId &&
      this.cachedConfig.secretAccessKey === config.secretAccessKey
    ) {
      return this.client;
    }

    this.cachedConfig = config;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return this.client;
  }

  private readConfig(): R2Config {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
    const publicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL?.trim();

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicBaseUrl
    ) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET, and MEDIA_PUBLIC_BASE_URL in the root .env',
      );
    }

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl,
    };
  }
}

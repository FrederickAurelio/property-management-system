import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ArchiveProvider, type ArchiveUploadIntent } from '@cabin/api-contract';
import type {
  ArchiveStoragePort,
  CreateArchiveUploadIntentInput,
} from '../archive-storage.port.js';

/** Presigned PUT lifetime — short bearer token for browser upload. */
const PRESIGN_EXPIRES_SECONDS = 900;

type GarageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
};

@Injectable()
export class GarageArchiveStorageAdapter implements ArchiveStoragePort {
  private client: S3Client | null = null;
  private cachedConfig: GarageConfig | null = null;

  async createUploadIntent(
    input: CreateArchiveUploadIntentInput,
  ): Promise<ArchiveUploadIntent> {
    const config = this.readConfig();
    const year = new Date().getUTCFullYear();
    const key = `archive/${year}/${input.id}`;

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
      provider: ArchiveProvider.GARAGE,
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

  private getClient(config: GarageConfig): S3Client {
    if (
      this.client &&
      this.cachedConfig &&
      this.cachedConfig.endpoint === config.endpoint &&
      this.cachedConfig.accessKeyId === config.accessKeyId &&
      this.cachedConfig.secretAccessKey === config.secretAccessKey &&
      this.cachedConfig.forcePathStyle === config.forcePathStyle
    ) {
      return this.client;
    }

    this.cachedConfig = config;
    // WHEN_REQUIRED: newer AWS SDK otherwise injects CRC32 into presigned URLs;
    // browser PUT only sends Content-Type → Garage rejects the signature.
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return this.client;
  }

  private readConfig(): GarageConfig {
    const endpoint = process.env.ARCHIVE_S3_ENDPOINT?.trim();
    const region = process.env.ARCHIVE_S3_REGION?.trim() || 'garage';
    const accessKeyId = process.env.ARCHIVE_S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.ARCHIVE_S3_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.ARCHIVE_S3_BUCKET?.trim();
    const publicBaseUrl = process.env.ARCHIVE_PUBLIC_BASE_URL?.trim();
    const forcePathStyleRaw =
      process.env.ARCHIVE_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
    const forcePathStyle =
      forcePathStyleRaw === undefined ||
      forcePathStyleRaw === '' ||
      forcePathStyleRaw === 'true' ||
      forcePathStyleRaw === '1';

    if (
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicBaseUrl
    ) {
      throw new ServiceUnavailableException(
        'Garage archive storage is not configured. Set ARCHIVE_S3_ENDPOINT, ARCHIVE_S3_ACCESS_KEY_ID, ARCHIVE_S3_SECRET_ACCESS_KEY, ARCHIVE_S3_BUCKET, and ARCHIVE_PUBLIC_BASE_URL in the root .env',
      );
    }

    return {
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      bucket,
      forcePathStyle,
      publicBaseUrl,
    };
  }
}

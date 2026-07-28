import { Module } from '@nestjs/common';
import { MediaProvider } from '@cabin/api-contract';
import { CloudinaryMediaStorageAdapter } from './adapters/cloudinary.adapter.js';
import { CloudflareR2MediaStorageAdapter } from './adapters/cloudflare-r2.adapter.js';
import { MEDIA_STORAGE } from './media-storage.port.js';
import { resolveMediaProvider } from './resolve-media-provider.js';

const activeProvider = resolveMediaProvider();
const activeAdapterClass =
  activeProvider === MediaProvider.CLOUDFLARE_R2
    ? CloudflareR2MediaStorageAdapter
    : CloudinaryMediaStorageAdapter;

@Module({
  providers: [{ provide: MEDIA_STORAGE, useClass: activeAdapterClass }],
  exports: [MEDIA_STORAGE],
})
export class MediaStorageModule {}

import type { MediaKind, MediaUploadIntent } from '@cabin/api-contract';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export type CreateMediaUploadIntentInput = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  byteSize: number;
};

/** Capability port — vendor SDKs live only in adapters. */
export interface MediaStoragePort {
  createUploadIntent(
    input: CreateMediaUploadIntentInput,
  ): Promise<MediaUploadIntent>;
}

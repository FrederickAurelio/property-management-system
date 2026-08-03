import type { ArchiveKind, ArchiveUploadIntent } from '@cabin/api-contract';

export const ARCHIVE_STORAGE = Symbol('ARCHIVE_STORAGE');

export type CreateArchiveUploadIntentInput = {
  id: string;
  kind: ArchiveKind;
  mimeType: string;
  byteSize: number;
};

/** Capability port — vendor SDKs live only in adapters. */
export interface ArchiveStoragePort {
  createUploadIntent(
    input: CreateArchiveUploadIntentInput,
  ): Promise<ArchiveUploadIntent>;
}

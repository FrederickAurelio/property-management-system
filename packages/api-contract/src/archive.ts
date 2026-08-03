/** Staff archive proofs (invoices / receipts) — parallel to inventory media. */

export const ArchiveKind = {
  IMAGE: 'IMAGE',
} as const;

export type ArchiveKind = (typeof ArchiveKind)[keyof typeof ArchiveKind];

/** Post-compress ceiling for archive images (FE targets ~1.5 MB). */
export const ARCHIVE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const ARCHIVE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ArchiveImageMimeType = (typeof ARCHIVE_IMAGE_MIME_TYPES)[number];

/** Max edge for archive FE compress (smaller than gallery `MEDIA_IMAGE_MAX_EDGE_PX`). */
export const ARCHIVE_IMAGE_MAX_EDGE_PX = 1280;

/** Active archive storage vendor — Nest selects via `ARCHIVE_PROVIDER`. */
export const ArchiveProvider = {
  GARAGE: 'garage',
} as const;

export type ArchiveProvider =
  (typeof ArchiveProvider)[keyof typeof ArchiveProvider];

/** Nest → PMS: which archive vendor is active. */
export type StaffArchiveConfig = {
  provider: ArchiveProvider;
};

/**
 * Nest → PMS: provider-discriminated browser upload intent for archive proofs.
 * Secrets never leave Nest; FE executes `upload` then keeps `ArchiveItem` URL.
 */
export type ArchiveUploadIntent = {
  id: string;
  provider: typeof ArchiveProvider.GARAGE;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
  };
  delivery: {
    publicUrl: string;
  };
};

/** Uploaded archive proof (not inventory `MediaItem`). */
export type ArchiveItem = {
  id: string;
  kind: ArchiveKind;
  url: string;
  name: string;
  mimeType: string;
  byteSize: number;
};

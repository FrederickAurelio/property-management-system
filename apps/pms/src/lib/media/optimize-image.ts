import imageCompression from "browser-image-compression";
import {
  ARCHIVE_IMAGE_MAX_EDGE_PX,
  MEDIA_IMAGE_MAX_EDGE_PX,
} from "@cabin/api-contract";

export type ImageOptimizeProfile = "gallery" | "archive";

const PROFILE_OPTIONS = {
  /** R2 inventory images — match Cloudinary-ish targets. */
  gallery: {
    maxWidthOrHeight: MEDIA_IMAGE_MAX_EDGE_PX,
    initialQuality: 0.8,
    fileType: "image/webp" as const,
    useWebWorker: true,
    maxSizeMB: 8,
  },
  /** Staff archive proofs — smaller edge / stronger compress (~1–1.5 MB). */
  archive: {
    maxWidthOrHeight: ARCHIVE_IMAGE_MAX_EDGE_PX,
    initialQuality: 0.55,
    fileType: "image/webp" as const,
    useWebWorker: true,
    maxSizeMB: 1.5,
  },
} as const;

/**
 * Client-side image resize/compress before upload.
 * Gallery: R2 inventory path. Archive: Garage proofs.
 * Cloudinary gallery path skips this entirely (provider optimizes).
 */
export async function optimizeImageForUpload(
  file: File,
  profile: ImageOptimizeProfile = "gallery",
): Promise<File> {
  const compressed = await imageCompression(file, PROFILE_OPTIONS[profile]);
  if (compressed instanceof File) {
    return compressed;
  }
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([compressed], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

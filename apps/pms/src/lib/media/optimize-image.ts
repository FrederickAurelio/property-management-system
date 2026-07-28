import imageCompression from "browser-image-compression";
import { MEDIA_IMAGE_MAX_EDGE_PX } from "@cabin/api-contract";

/** Match Cloudinary-ish targets: max edge 1920, q≈0.8, webp (f_auto stand-in). */
const OPTIMIZE_OPTIONS = {
  maxWidthOrHeight: MEDIA_IMAGE_MAX_EDGE_PX,
  initialQuality: 0.8,
  fileType: "image/webp" as const,
  useWebWorker: true,
  maxSizeMB: 8,
};

/**
 * Client-side image resize/compress before R2 upload.
 * Cloudinary path skips this — provider optimizes server-side.
 */
export async function optimizeImageForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, OPTIMIZE_OPTIONS);
  if (compressed instanceof File) {
    return compressed;
  }
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([compressed], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

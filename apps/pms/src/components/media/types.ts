import {
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_VIDEO_MIME_TYPES,
  MediaKind,
  type MediaItem,
} from "@cabin/api-contract";

export type { MediaItem };
export { MediaKind };

const IMAGE_MIMES = new Set<string>(MEDIA_IMAGE_MIME_TYPES);
const VIDEO_MIMES = new Set<string>(MEDIA_VIDEO_MIME_TYPES);

export function isImageMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime.toLowerCase());
}

export function isVideoMime(mime: string): boolean {
  return VIDEO_MIMES.has(mime.toLowerCase());
}

export function mediaKindFromMime(mime: string): MediaKind | null {
  const normalized = mime.toLowerCase();
  if (IMAGE_MIMES.has(normalized)) {
    return MediaKind.IMAGE;
  }
  if (VIDEO_MIMES.has(normalized)) {
    return MediaKind.VIDEO;
  }
  return null;
}

export function isBlobMediaUrl(url: string): boolean {
  return url.startsWith("blob:");
}

export function revokeIfBlobUrl(url: string): void {
  if (isBlobMediaUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

/** Media asset shapes — later becomes uploaded storage URLs. */

export type MediaKind = "IMAGE" | "VIDEO";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  /** Object URL or remote URL */
  url: string;
  name: string;
  mimeType: string;
};

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

export function mediaKindFromMime(mime: string): MediaKind | null {
  if (isImageMime(mime)) {
    return "IMAGE";
  }
  if (isVideoMime(mime)) {
    return "VIDEO";
  }
  return null;
}

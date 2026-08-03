import {
  MEDIA_IMAGE_MAX_EDGE_PX,
  MediaKind,
  MediaProvider,
  type MediaItem,
  type MediaUploadIntent,
  type StaffMediaConfig,
} from "@cabin/api-contract";
import { optimizeImageForUpload } from "@/lib/media/optimize-image";
import { api } from "./client";

export type CreateUploadIntentInput = {
  kind: MediaKind;
  mimeType: string;
  byteSize: number;
  name?: string;
};

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  format?: string;
  resource_type?: string;
  bytes?: number;
};

export async function getMediaConfig(): Promise<StaffMediaConfig> {
  const { data } = await api.get<StaffMediaConfig>("/media/config");
  return data;
}

export async function createUploadIntent(
  input: CreateUploadIntentInput,
): Promise<MediaUploadIntent> {
  const { data } = await api.post<MediaUploadIntent>(
    "/media/upload-intent",
    input,
  );
  return data;
}

/** Delivery URL with Cloudinary auto format/quality (+ width limit for images). */
export function cloudinaryDeliveryUrl(
  delivery: Extract<
    MediaUploadIntent,
    { provider: typeof MediaProvider.CLOUDINARY }
  >["delivery"],
  uploadedPublicId?: string,
): string {
  const publicId = (uploadedPublicId ?? delivery.publicId).replace(/^\/+/, "");
  if (delivery.resourceType === "video") {
    return `https://res.cloudinary.com/${delivery.cloudName}/video/upload/${publicId}`;
  }
  const transform = `f_auto,q_auto,c_limit,w_${MEDIA_IMAGE_MAX_EDGE_PX}`;
  return `https://res.cloudinary.com/${delivery.cloudName}/image/upload/${transform}/${publicId}`;
}

export async function uploadToCloudinary(
  intent: Extract<
    MediaUploadIntent,
    { provider: typeof MediaProvider.CLOUDINARY }
  >,
  file: File,
): Promise<CloudinaryUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(intent.upload.fields)) {
    form.append(key, value);
  }

  const response = await fetch(intent.upload.url, {
    method: intent.upload.method,
    body: form,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        detail = body.error.message;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`Cloudinary upload failed: ${detail}`);
  }

  return (await response.json()) as CloudinaryUploadResponse;
}

export async function uploadToCloudflareR2(
  intent: Extract<
    MediaUploadIntent,
    { provider: typeof MediaProvider.CLOUDFLARE_R2 }
  >,
  file: File,
): Promise<void> {
  const response = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: file,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const text = await response.text();
      if (text) detail = text.slice(0, 200);
    } catch {
      // ignore
    }
    throw new Error(`Cloudflare R2 upload failed: ${detail}`);
  }
}

/**
 * Pick → optional FE optimize (R2 images only) → intent → provider upload → MediaItem.
 * Cloudinary: original bytes; provider applies f_auto/q_auto on delivery.
 */
export async function uploadMediaFile(file: File): Promise<MediaItem> {
  const kind = file.type.startsWith("video/")
    ? MediaKind.VIDEO
    : MediaKind.IMAGE;

  const { provider } = await getMediaConfig();

  let uploadFile = file;
  if (kind === MediaKind.IMAGE && provider === MediaProvider.CLOUDFLARE_R2) {
    uploadFile = await optimizeImageForUpload(file, "gallery");
  }

  const intent = await createUploadIntent({
    kind,
    mimeType: uploadFile.type,
    byteSize: uploadFile.size,
    name: uploadFile.name || file.name || undefined,
  });

  let url: string;
  if (intent.provider === MediaProvider.CLOUDFLARE_R2) {
    await uploadToCloudflareR2(intent, uploadFile);
    url = intent.delivery.publicUrl;
  } else {
    const uploaded = await uploadToCloudinary(intent, uploadFile);
    url = cloudinaryDeliveryUrl(intent.delivery, uploaded.public_id);
  }

  return {
    id: intent.id,
    kind,
    url,
    name:
      uploadFile.name ||
      file.name ||
      `${kind.toLowerCase()}-${intent.id.slice(0, 8)}`,
    mimeType: uploadFile.type || file.type,
  };
}

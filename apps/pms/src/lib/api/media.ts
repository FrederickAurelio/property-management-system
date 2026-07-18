import {
  MEDIA_IMAGE_MAX_EDGE_PX,
  MediaKind,
  type MediaItem,
  type MediaUploadIntent,
} from "@cabin/api-contract";
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

export async function createUploadIntent(
  input: CreateUploadIntentInput,
): Promise<MediaUploadIntent> {
  const { data } = await api.post<MediaUploadIntent>(
    "/staff/media/upload-intent",
    input,
  );
  return data;
}

/** Delivery URL with Cloudinary auto format/quality (+ width limit for images). */
export function cloudinaryDeliveryUrl(
  intent: MediaUploadIntent,
  uploadedPublicId: string,
): string {
  const publicId = uploadedPublicId.replace(/^\/+/, "");
  if (intent.resourceType === "video") {
    return `https://res.cloudinary.com/${intent.cloudName}/video/upload/${publicId}`;
  }
  const transform = `f_auto,q_auto,c_limit,w_${MEDIA_IMAGE_MAX_EDGE_PX}`;
  return `https://res.cloudinary.com/${intent.cloudName}/image/upload/${transform}/${publicId}`;
}

export async function uploadToCloudinary(
  intent: MediaUploadIntent,
  file: File,
): Promise<CloudinaryUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", intent.apiKey);
  form.append("timestamp", String(intent.timestamp));
  form.append("signature", intent.signature);
  form.append("folder", intent.folder);
  form.append("public_id", intent.publicId);
  if (intent.transformation) {
    form.append("transformation", intent.transformation);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${intent.cloudName}/${intent.resourceType}/upload`;
  const response = await fetch(endpoint, {
    method: "POST",
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

/** Full pick → intent → Cloudinary → MediaItem with optimized delivery URL. */
export async function uploadMediaFile(file: File): Promise<MediaItem> {
  const kind = file.type.startsWith("video/")
    ? MediaKind.VIDEO
    : MediaKind.IMAGE;

  const intent = await createUploadIntent({
    kind,
    mimeType: file.type,
    byteSize: file.size,
    name: file.name || undefined,
  });

  const uploaded = await uploadToCloudinary(intent, file);
  const url = cloudinaryDeliveryUrl(intent, uploaded.public_id);

  return {
    id: intent.id,
    kind,
    url,
    name: file.name || `${kind.toLowerCase()}-${intent.id.slice(0, 8)}`,
    mimeType: file.type,
  };
}

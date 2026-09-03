import {
  ArchiveKind,
  ArchiveProvider,
  type ArchiveItem,
  type ArchiveUploadIntent,
  type StaffArchiveConfig,
} from "@cabin/api-contract";
import { optimizeImageForUpload } from "@/lib/media/optimize-image";
import { api } from "./client";

export type CreateArchiveUploadIntentInput = {
  kind: ArchiveKind;
  mimeType: string;
  byteSize: number;
  name?: string;
};

export async function getArchiveConfig(): Promise<StaffArchiveConfig> {
  const { data } = await api.get<StaffArchiveConfig>("/archive/config");
  return data;
}

export async function createArchiveUploadIntent(
  input: CreateArchiveUploadIntentInput,
): Promise<ArchiveUploadIntent> {
  const { data } = await api.post<ArchiveUploadIntent>(
    "/archive/upload-intent",
    input,
  );
  return data;
}

export async function uploadToGarage(
  intent: Extract<
    ArchiveUploadIntent,
    { provider: typeof ArchiveProvider.GARAGE }
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
    throw new Error(`Garage archive upload failed: ${detail}`);
  }
}

/**
 * Archive proofs: FE archive-profile compress → intent → Garage PUT → ArchiveItem.
 * Does not touch inventory `uploadMediaFile`.
 */
export async function uploadArchiveFile(file: File): Promise<ArchiveItem> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Archive upload currently supports images only");
  }

  await getArchiveConfig();

  const uploadFile = await optimizeImageForUpload(file, "archive");

  const intent = await createArchiveUploadIntent({
    kind: ArchiveKind.IMAGE,
    mimeType: uploadFile.type,
    byteSize: uploadFile.size,
    name: uploadFile.name || file.name || undefined,
  });

  if (intent.provider !== ArchiveProvider.GARAGE) {
    throw new Error(`Unsupported archive provider: ${String(intent.provider)}`);
  }

  await uploadToGarage(intent, uploadFile);

  return {
    id: intent.id,
    kind: ArchiveKind.IMAGE,
    url: intent.delivery.publicUrl,
    name: uploadFile.name || file.name || `archive-${intent.id.slice(0, 8)}`,
    mimeType: uploadFile.type || file.type,
    byteSize: uploadFile.size,
  };
}

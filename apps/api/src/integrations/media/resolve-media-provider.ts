import { MediaProvider } from '@cabin/api-contract';

/** Resolve active media vendor from root `.env` (`MEDIA_PROVIDER`). */
export function resolveMediaProvider(): MediaProvider {
  const raw = process.env.MEDIA_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === MediaProvider.CLOUDINARY) {
    return MediaProvider.CLOUDINARY;
  }
  if (raw === MediaProvider.CLOUDFLARE_R2) {
    return MediaProvider.CLOUDFLARE_R2;
  }
  throw new Error(
    `Invalid MEDIA_PROVIDER="${raw}". Use "${MediaProvider.CLOUDINARY}" or "${MediaProvider.CLOUDFLARE_R2}".`,
  );
}

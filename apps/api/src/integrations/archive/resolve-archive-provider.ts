import { ArchiveProvider } from '@cabin/api-contract';

/** Resolve active archive vendor from root `.env` (`ARCHIVE_PROVIDER`). */
export function resolveArchiveProvider(): ArchiveProvider {
  const raw = process.env.ARCHIVE_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === ArchiveProvider.GARAGE) {
    return ArchiveProvider.GARAGE;
  }
  throw new Error(
    `Invalid ARCHIVE_PROVIDER="${raw}". Use "${ArchiveProvider.GARAGE}".`,
  );
}

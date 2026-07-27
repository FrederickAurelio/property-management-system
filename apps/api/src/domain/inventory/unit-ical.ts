import { randomBytes } from 'node:crypto';
import type {
  StaffUnit,
  StaffUnitIcalFeed,
  UnitIcalFeedSource,
} from '@cabin/api-contract';
import { UNIT_ICAL_FEED_SOURCES } from '@cabin/api-contract';
import type { Unit, UnitIcalFeed } from '../../generated/prisma/index.js';

export type UnitWithIcalFeeds = Unit & {
  icalFeeds?: UnitIcalFeed[];
};

export function newIcalExportToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Absolute .ics URL OTAs poll. Uses the **public PMS origin** (Vite :5173 /
 * nginx :8080), not the Nest bind address — API stays on the Docker network.
 * Path `/public/ical/...` is proxied by Vite/nginx → Nest `/public/ical/...`.
 */
export function buildIcalExportUrl(unitId: string, token: string): string {
  const raw =
    process.env.PUBLIC_PMS_BASE_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
  if (!raw) {
    // Production misconfig: do not invent localhost (OTAs cannot reach it).
    return '';
  }
  const base = raw.replace(/\/$/, '');
  return `${base}/public/ical/units/${unitId}.ics?token=${encodeURIComponent(token)}`;
}

export function toStaffUnitIcalFeed(row: UnitIcalFeed): StaffUnitIcalFeed {
  return {
    source: row.source as UnitIcalFeedSource,
    importUrl: row.importUrl,
    isActive: row.isActive,
    lastPulledAt: row.lastPulledAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export function toStaffUnit(row: UnitWithIcalFeeds): StaffUnit {
  const feeds = (row.icalFeeds ?? [])
    .filter((f) =>
      (UNIT_ICAL_FEED_SOURCES as readonly string[]).includes(f.source),
    )
    .map(toStaffUnitIcalFeed)
    .sort((a, b) => a.source.localeCompare(b.source));

  return {
    id: row.id,
    propertyId: row.propertyId,
    unitTypeId: row.unitTypeId,
    code: row.code,
    name: row.name,
    floor: row.floor,
    status: row.status,
    notes: row.notes,
    sortOrder: row.sortOrder,
    icalExportUrl: buildIcalExportUrl(row.id, row.icalExportToken),
    icalFeeds: feeds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

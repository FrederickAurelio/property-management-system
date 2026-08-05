import { Injectable, Logger } from '@nestjs/common';
import {
  IcalSyncWarning,
  OCCUPYING_RESERVATION_STATUSES,
  PaymentStatus,
  ReservationStatus,
  ymdInTimezone,
  type StaffIcalSyncAllResult,
} from '@cabin/api-contract';
import * as ical from 'node-ical';
import type {
  Prisma,
  ReservationSource,
  UnitIcalFeed,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { findOccupyingOverlap } from '../reservations/overlap.js';
import { parseYmd } from '../reservations/reservations-mapper.js';

type ParsedFeedEvent = {
  uid: string;
  startYmd: string;
  endYmd: string;
  summary: string | null;
};

/** Result of parsing an ICS body — active bookings vs skipped signals. */
type ParsedFeed = {
  events: ParsedFeedEvent[];
  /** UIDs seen with STATUS:CANCELLED (tombstones — not imported as stays). */
  cancelledUids: Set<string>;
  /** Raw VEVENT count before filters (0 = truly empty calendar). */
  veventCount: number;
};

type FeedPullContext = {
  id: string;
  unitId: string;
  source: ReservationSource;
  importUrl: string;
  unit: { propertyId: string; unitTypeId: string; timezone: string };
};

const PULL_TIMEOUT_MS = 15_000;
const PULL_CONCURRENCY = 3;
const UID_LOOKUP_ATTEMPTS = 3;
const UID_LOOKUP_RETRY_MS = 50;
const EMPTY_FEED_ERROR =
  'Feed returned 0 events (possible glitch or empty calendar)';

/** Result of looking up one OTA UID across property same-source feeds. */
export type UidLookupResult =
  | {
      kind: 'found';
      checkInDate: string;
      checkOutDate: string;
      unitId: string;
    }
  | { kind: 'absent' }
  | { kind: 'incomplete' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Normalized SUMMARY substrings that mean host block / closed — not a guest. */
const BLOCK_SUMMARY_MARKERS = [
  'unavailable',
  'not available',
  'blocked',
  'no vacancy',
  'closed',
] as const;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** All-day VALUE=DATE → calendar YMD (UTC midnight or floating local). */
function ymdAllDay(d: Date): string {
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return ymdUtc(d);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdUtc(d);
}

function guestNameFromSummary(summary: string | null): string {
  const trimmed = summary?.trim();
  if (!trimmed) {
    return 'Guest (iCal)';
  }
  if (/\(iCal\)\s*$/i.test(trimmed)) {
    return trimmed.slice(0, 128);
  }
  return `${trimmed.slice(0, 118)} (iCal)`;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  return null;
}

function summaryText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'val' in value) {
    const v = (value as { val?: unknown }).val;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

function eventStatus(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'val' in value) {
    const v = (value as { val?: unknown }).val;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

function isBlockLikeSummary(summary: string | null): boolean {
  if (!summary) return false;
  const normalized = summary.trim().toLowerCase();
  return BLOCK_SUMMARY_MARKERS.some((marker) => normalized.includes(marker));
}

function localIsMidnight(d: Date, timezone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const second = parts.find((p) => p.type === 'second')?.value;
    return hour === '00' && minute === '00' && second === '00';
  } catch {
    return (
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0
    );
  }
}

function toExclusiveEndYmd(
  start: Date,
  end: Date,
  allDay: boolean,
  timezone: string,
): string {
  if (allDay) {
    return ymdAllDay(end);
  }
  const endDay = ymdInTimezone(end, timezone);
  const startDay = ymdInTimezone(start, timezone);
  if (endDay <= startDay) {
    return addDaysYmd(startDay, 1);
  }
  // OTA DTEND often = local midnight checkout → exclusive YMD is that day.
  if (localIsMidnight(end, timezone)) {
    return endDay;
  }
  return addDaysYmd(endDay, 1);
}

@Injectable()
export class IcalImportService {
  private readonly logger = new Logger(IcalImportService.name);
  private syncPromise: Promise<StaffIcalSyncAllResult> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async syncAll(): Promise<StaffIcalSyncAllResult> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    this.syncPromise = this.runSyncAll().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async runSyncAll(): Promise<StaffIcalSyncAllResult> {
    const feeds = await this.prisma.unitIcalFeed.findMany({
      where: { isActive: true },
      select: {
        id: true,
        unitId: true,
        source: true,
        importUrl: true,
        unit: {
          select: {
            propertyId: true,
            unitTypeId: true,
            property: { select: { timezone: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    let feedsOk = 0;
    let feedsFailed = 0;

    for (let i = 0; i < feeds.length; i += PULL_CONCURRENCY) {
      const batch = feeds.slice(i, i + PULL_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (feed) => {
          const ctx: FeedPullContext = {
            id: feed.id,
            unitId: feed.unitId,
            source: feed.source,
            importUrl: feed.importUrl,
            unit: {
              propertyId: feed.unit.propertyId,
              unitTypeId: feed.unit.unitTypeId,
              timezone: feed.unit.property.timezone || 'Asia/Jakarta',
            },
          };
          try {
            await this.pullFeed(ctx);
            return true;
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : 'Unknown pull error';
            this.logger.warn(`Feed ${feed.id} failed: ${message}`);
            await this.prisma.unitIcalFeed.update({
              where: { id: feed.id },
              data: {
                lastPulledAt: new Date(),
                lastError: message.slice(0, 2000),
              },
            });
            return false;
          }
        }),
      );
      for (const ok of results) {
        if (ok) feedsOk += 1;
        else feedsFailed += 1;
      }
    }

    return {
      feedsAttempted: feeds.length,
      feedsOk,
      feedsFailed,
    };
  }

  async pullFeed(feed: FeedPullContext): Promise<void> {
    const parsed = await this.fetchAndParse(feed.importUrl, feed.unit.timezone);
    const { events, cancelledUids } = parsed;

    // Truly empty calendar (or only block-like rows) → glitch protection: keep
    // last good data, do not MISSING-storm. Explicit STATUS:CANCELLED tombstones
    // are different — they are a real cancel signal even when no active booking remains.
    if (events.length === 0 && cancelledUids.size === 0) {
      await this.prisma.unitIcalFeed.update({
        where: { id: feed.id },
        data: {
          lastPulledAt: new Date(),
          lastError: EMPTY_FEED_ERROR,
        },
      });
      throw new Error(EMPTY_FEED_ERROR);
    }

    const seenUids = new Set(events.map((e) => e.uid));

    await this.prisma.$transaction(async (tx) => {
      for (const event of events) {
        await this.reconcileEvent(tx, feed, event);
      }

      // Edge #17: clear OTA_STILL_LISTED (and sticky dismiss) when UID left this unit's feed.
      const stillListed = await tx.reservation.findMany({
        where: {
          unitId: feed.unitId,
          source: feed.source,
          status: {
            in: [ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT],
          },
          OR: [
            { icalSyncWarning: IcalSyncWarning.OTA_STILL_LISTED },
            { icalOtaStillListedDismissedAt: { not: null } },
          ],
        },
        select: {
          id: true,
          externalRef: true,
        },
      });

      for (const row of stillListed) {
        if (!row.externalRef || !seenUids.has(row.externalRef)) {
          await tx.reservation.update({
            where: { id: row.id },
            data: {
              icalSyncWarning: null,
              icalSyncWarnedAt: null,
              icalOtaStillListedDismissedAt: null,
            },
          });
        }
      }

      await tx.unitIcalFeed.update({
        where: { id: feed.id },
        data: {
          lastPulledAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
        },
      });
    });

    // MISSING scan outside tx — may HTTP-fetch sibling feeds (unit move / #4).
    // Cancelled-only feeds: seenUids empty → occupying local UIDs get MISSING
    // (unless still active on a sibling same-source feed).
    await this.applyMissingFromFeedWarnings(feed, seenUids);
  }

  /**
   * Occupying rows on this unit whose UID is absent from this feed:
   * - found on sibling unit → UNIT_DIFFER (do not auto-move)
   * - absent from all same-source property feeds → MISSING_FROM_FEED
   * - sibling lookup incomplete (fetch errors) → leave warning unchanged
   */
  private async applyMissingFromFeedWarnings(
    feed: FeedPullContext,
    seenUids: Set<string>,
  ): Promise<void> {
    const candidates = await this.prisma.reservation.findMany({
      where: {
        unitId: feed.unitId,
        source: feed.source,
        externalRef: { not: null },
        status: { in: [...OCCUPYING_RESERVATION_STATUSES] },
      },
      select: {
        id: true,
        externalRef: true,
        icalSyncWarning: true,
        icalObservedUnitId: true,
        icalObservedCheckInDate: true,
        icalObservedCheckOutDate: true,
        propertyId: true,
        unitId: true,
      },
    });

    for (const row of candidates) {
      if (!row.externalRef) continue;

      if (seenUids.has(row.externalRef)) {
        // UID on this unit’s feed — clear move/missing only.
        // Do not touch DATES_DIFFER: reconcile already set it + observed dates;
        // clearing on `icalObservedCheckInDate != null` wiped that warning every sync.
        if (
          row.icalSyncWarning === IcalSyncWarning.MISSING_FROM_FEED ||
          row.icalSyncWarning === IcalSyncWarning.UNIT_DIFFER
        ) {
          await this.prisma.reservation.update({
            where: { id: row.id },
            data: {
              icalSyncWarning: null,
              icalSyncWarnedAt: null,
              icalObservedUnitId: null,
              icalObservedCheckInDate: null,
              icalObservedCheckOutDate: null,
            },
          });
        }
        continue;
      }

      const lookup = await this.fetchEventDatesForUid({
        unitId: row.unitId,
        propertyId: row.propertyId,
        source: feed.source,
        externalRef: row.externalRef,
        timezone: feed.unit.timezone,
      });

      if (lookup.kind === 'incomplete') {
        this.logger.warn(
          `UID lookup incomplete for reservation ${row.id} — skip MISSING`,
        );
        continue;
      }

      if (lookup.kind === 'found') {
        if (lookup.unitId !== row.unitId) {
          // OTA moved listing to sibling unit — warn; staff Accepts move.
          const observedIn = parseYmd(lookup.checkInDate);
          const observedOut = parseYmd(lookup.checkOutDate);
          const sameUnit =
            row.icalSyncWarning === IcalSyncWarning.UNIT_DIFFER &&
            row.icalObservedUnitId === lookup.unitId;
          const sameDates =
            row.icalObservedCheckInDate != null &&
            row.icalObservedCheckOutDate != null &&
            ymdUtc(row.icalObservedCheckInDate) === lookup.checkInDate &&
            ymdUtc(row.icalObservedCheckOutDate) === lookup.checkOutDate;
          if (!sameUnit || !sameDates) {
            await this.prisma.reservation.update({
              where: { id: row.id },
              data: {
                icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
                ...(sameUnit ? {} : { icalSyncWarnedAt: new Date() }),
                icalObservedUnitId: lookup.unitId,
                icalObservedCheckInDate: observedIn,
                icalObservedCheckOutDate: observedOut,
              },
            });
          }
          continue;
        }

        // Same unit via sibling lookup — clear move/missing only (not DATES_DIFFER).
        if (
          row.icalSyncWarning === IcalSyncWarning.MISSING_FROM_FEED ||
          row.icalSyncWarning === IcalSyncWarning.UNIT_DIFFER
        ) {
          await this.prisma.reservation.update({
            where: { id: row.id },
            data: {
              icalSyncWarning: null,
              icalSyncWarnedAt: null,
              icalObservedUnitId: null,
              icalObservedCheckInDate: null,
              icalObservedCheckOutDate: null,
            },
          });
        }
        continue;
      }

      // kind === 'absent'
      if (row.icalSyncWarning !== IcalSyncWarning.MISSING_FROM_FEED) {
        await this.prisma.reservation.update({
          where: { id: row.id },
          data: {
            icalSyncWarning: IcalSyncWarning.MISSING_FROM_FEED,
            icalSyncWarnedAt: new Date(),
            icalObservedUnitId: null,
            icalObservedCheckInDate: null,
            icalObservedCheckOutDate: null,
          },
        });
      }
    }
  }

  /**
   * Re-fetch OTA dates + feed unit for one UID (Accept dates/unit / missing check).
   * Try current unit feed first, then other active same-source feeds on the property.
   * Retries each feed; returns incomplete if any feed failed after retries.
   */
  async fetchEventDatesForUid(input: {
    unitId: string;
    propertyId: string;
    source: ReservationSource;
    externalRef: string;
    timezone?: string;
  }): Promise<UidLookupResult> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { timezone: true },
    });
    const timezone = input.timezone || property?.timezone || 'Asia/Jakarta';

    const preferred = await this.prisma.unitIcalFeed.findUnique({
      where: {
        unitId_source: { unitId: input.unitId, source: input.source },
      },
    });
    const others = await this.prisma.unitIcalFeed.findMany({
      where: {
        isActive: true,
        source: input.source,
        unit: { propertyId: input.propertyId },
        ...(preferred ? { id: { not: preferred.id } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    const candidates: UnitIcalFeed[] = [];
    if (preferred?.isActive) {
      candidates.push(preferred);
    }
    candidates.push(...others);

    if (candidates.length === 0) {
      return { kind: 'absent' };
    }

    let anyFailure = false;

    for (const feed of candidates) {
      try {
        const { events } = await this.fetchAndParseWithRetry(
          feed.importUrl,
          timezone,
        );
        const hit = events.find((e) => e.uid === input.externalRef);
        if (hit) {
          return {
            kind: 'found',
            checkInDate: hit.startYmd,
            checkOutDate: hit.endYmd,
            unitId: feed.unitId,
          };
        }
      } catch (error: unknown) {
        anyFailure = true;
        this.logger.warn(
          `UID lookup feed ${feed.id} failed after retries: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
    }

    return anyFailure ? { kind: 'incomplete' } : { kind: 'absent' };
  }

  private async fetchAndParseWithRetry(
    importUrl: string,
    timezone: string,
  ): Promise<ParsedFeed> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= UID_LOOKUP_ATTEMPTS; attempt += 1) {
      try {
        return await this.fetchAndParse(importUrl, timezone);
      } catch (error: unknown) {
        lastError = error;
        if (attempt < UID_LOOKUP_ATTEMPTS) {
          await sleep(UID_LOOKUP_RETRY_MS * attempt);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Feed fetch failed');
  }

  private async fetchAndParse(
    importUrl: string,
    timezone: string,
  ): Promise<ParsedFeed> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PULL_TIMEOUT_MS);
    try {
      const res = await fetch(importUrl, {
        signal: controller.signal,
        headers: { Accept: 'text/calendar, text/plain, */*' },
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching feed`);
      }
      const text = await res.text();
      return this.parseIcs(text, timezone);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseIcs(text: string, timezone: string): ParsedFeed {
    const parsed = ical.sync.parseICS(text);
    const events: ParsedFeedEvent[] = [];
    const cancelledUids = new Set<string>();
    let veventCount = 0;

    for (const value of Object.values(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const ev = value as ical.VEvent;
      if (ev.type !== 'VEVENT') continue;
      veventCount += 1;
      const uid = typeof ev.uid === 'string' ? ev.uid.trim().slice(0, 256) : '';
      const status = eventStatus(ev.status)?.toUpperCase() ?? '';
      if (status === 'CANCELLED') {
        if (uid) cancelledUids.add(uid);
        continue;
      }
      const summary = summaryText(ev.summary);
      if (isBlockLikeSummary(summary)) continue;
      if (!uid) continue;
      const start = asDate(ev.start);
      const end = asDate(ev.end);
      if (!start || !end) continue;
      const allDay = ev.datetype === 'date';
      const startYmd = allDay
        ? ymdAllDay(start)
        : ymdInTimezone(start, timezone);
      const endYmd = toExclusiveEndYmd(start, end, allDay, timezone);
      if (endYmd <= startYmd) continue;
      events.push({
        uid,
        startYmd,
        endYmd,
        summary,
      });
    }
    return { events, cancelledUids, veventCount };
  }

  private async reconcileEvent(
    tx: Prisma.TransactionClient,
    feed: FeedPullContext,
    event: ParsedFeedEvent,
  ): Promise<void> {
    const existing = await tx.reservation.findFirst({
      where: {
        source: feed.source,
        externalRef: event.uid,
      },
    });

    if (!existing) {
      await this.insertOrRecoverNewEvent(tx, feed, event);
      return;
    }

    await this.updateExistingEvent(tx, feed, existing, event);
  }

  private async insertOrRecoverNewEvent(
    tx: Prisma.TransactionClient,
    feed: FeedPullContext,
    event: ParsedFeedEvent,
  ): Promise<void> {
    const overlap = await findOccupyingOverlap(tx, {
      unitId: feed.unitId,
      checkInDate: event.startYmd,
      checkOutDate: event.endYmd,
    });
    const hold = overlap != null;
    try {
      await tx.reservation.create({
        data: {
          propertyId: feed.unit.propertyId,
          unitId: feed.unitId,
          unitTypeId: feed.unit.unitTypeId,
          source: feed.source,
          status: ReservationStatus.UNCONFIRMED,
          checkInDate: parseYmd(event.startYmd),
          checkOutDate: parseYmd(event.endYmd),
          inventoryEndDate: parseYmd(event.endYmd),
          guestName: guestNameFromSummary(event.summary),
          guestEmail: null,
          guestPhone: null,
          guestCount: null,
          totalAmountIdr: null,
          paidAmountIdr: 0n,
          paymentStatus: PaymentStatus.UNPAID,
          externalRef: event.uid,
          icalSyncWarning: hold ? IcalSyncWarning.IMPORT_OVERLAP : null,
          icalSyncWarnedAt: hold ? new Date() : null,
          icalOverlapHold: hold,
        },
      });
    } catch (error: unknown) {
      const raced = await tx.reservation.findFirst({
        where: {
          source: feed.source,
          externalRef: event.uid,
        },
      });
      if (raced) {
        await this.updateExistingEvent(tx, feed, raced, event);
        return;
      }
      const message = error instanceof Error ? error.message : 'Insert failed';
      this.logger.warn(`Insert UID ${event.uid} failed: ${message}`);
      throw new Error(`Insert failed for UID ${event.uid}: ${message}`);
    }
  }

  private async updateExistingEvent(
    tx: Prisma.TransactionClient,
    feed: FeedPullContext,
    existing: {
      id: string;
      unitId: string;
      status: string;
      checkInDate: Date;
      checkOutDate: Date;
      icalSyncWarning: string | null;
      icalSyncWarnedAt: Date | null;
      icalOtaStillListedDismissedAt: Date | null;
      icalObservedUnitId?: string | null;
      icalObservedCheckInDate?: Date | null;
      icalObservedCheckOutDate?: Date | null;
    },
    event: ParsedFeedEvent,
  ): Promise<void> {
    if (
      existing.status === ReservationStatus.CANCELLED ||
      existing.status === ReservationStatus.CHECKED_OUT
    ) {
      // Do not revive — desk alert (edge #17). Sticky dismiss: skip if ack'd.
      if (
        existing.icalSyncWarning !== IcalSyncWarning.OTA_STILL_LISTED &&
        existing.icalOtaStillListedDismissedAt == null
      ) {
        await tx.reservation.update({
          where: { id: existing.id },
          data: {
            icalSyncWarning: IcalSyncWarning.OTA_STILL_LISTED,
            icalSyncWarnedAt: new Date(),
            icalObservedUnitId: null,
            icalObservedCheckInDate: null,
            icalObservedCheckOutDate: null,
          },
        });
      }
      return;
    }

    const unitDiffer = existing.unitId !== feed.unitId;
    const localIn = ymdUtc(existing.checkInDate);
    const localOut = ymdUtc(existing.checkOutDate);
    const datesDiffer = localIn !== event.startYmd || localOut !== event.endYmd;

    // OTA lists UID on a different unit — warn; never silent-move.
    // Prefer UNIT_DIFFER over DATES_DIFFER this sync (Accept move first).
    // Always store observed OTA dates so the banner can show dual drift.
    if (unitDiffer) {
      const data: Prisma.ReservationUpdateInput = {
        icalSyncWarning: IcalSyncWarning.UNIT_DIFFER,
        icalSyncWarnedAt:
          existing.icalSyncWarning === IcalSyncWarning.UNIT_DIFFER &&
          existing.icalObservedUnitId === feed.unitId
            ? existing.icalSyncWarnedAt
            : new Date(),
        icalObservedUnit: { connect: { id: feed.unitId } },
        icalObservedCheckInDate: parseYmd(event.startYmd),
        icalObservedCheckOutDate: parseYmd(event.endYmd),
      };

      if (existing.status === ReservationStatus.UNCONFIRMED && datesDiffer) {
        // Refresh stub dates on the *current* local unit (overlap against current unit).
        const overlap = await findOccupyingOverlap(tx, {
          unitId: existing.unitId,
          checkInDate: event.startYmd,
          checkOutDate: event.endYmd,
          excludeReservationId: existing.id,
        });
        data.checkInDate = parseYmd(event.startYmd);
        data.checkOutDate = parseYmd(event.endYmd);
        data.inventoryEndDate = parseYmd(event.endYmd);
        data.icalOverlapHold = overlap != null;
        // UNIT_DIFFER stays primary; hold flag still tracks occupancy conflict.
      }

      await tx.reservation.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    if (existing.status === ReservationStatus.UNCONFIRMED) {
      const checkInDate = event.startYmd;
      const checkOutDate = event.endYmd;
      const overlap = await findOccupyingOverlap(tx, {
        unitId: existing.unitId,
        checkInDate,
        checkOutDate,
        excludeReservationId: existing.id,
      });

      if (overlap) {
        await tx.reservation.update({
          where: { id: existing.id },
          data: {
            ...(datesDiffer
              ? {
                  checkInDate: parseYmd(checkInDate),
                  checkOutDate: parseYmd(checkOutDate),
                  inventoryEndDate: parseYmd(checkOutDate),
                }
              : {}),
            icalOverlapHold: true,
            icalSyncWarning: IcalSyncWarning.IMPORT_OVERLAP,
            icalSyncWarnedAt:
              existing.icalSyncWarning === IcalSyncWarning.IMPORT_OVERLAP
                ? existing.icalSyncWarnedAt
                : new Date(),
            icalObservedUnitId: null,
            icalObservedCheckInDate: null,
            icalObservedCheckOutDate: null,
          },
        });
        return;
      }

      // Free nights — promote hold or refresh dates; clear observed fields.
      await tx.reservation.update({
        where: { id: existing.id },
        data: {
          ...(datesDiffer
            ? {
                checkInDate: parseYmd(checkInDate),
                checkOutDate: parseYmd(checkOutDate),
                inventoryEndDate: parseYmd(checkOutDate),
              }
            : {}),
          icalOverlapHold: false,
          icalSyncWarning: null,
          icalSyncWarnedAt: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
        },
      });
      return;
    }

    if (datesDiffer) {
      const observedIn = existing.icalObservedCheckInDate
        ? ymdUtc(existing.icalObservedCheckInDate)
        : null;
      const observedOut = existing.icalObservedCheckOutDate
        ? ymdUtc(existing.icalObservedCheckOutDate)
        : null;
      const already =
        existing.icalSyncWarning === IcalSyncWarning.DATES_DIFFER &&
        observedIn === event.startYmd &&
        observedOut === event.endYmd;
      if (!already) {
        await tx.reservation.update({
          where: { id: existing.id },
          data: {
            icalSyncWarning: IcalSyncWarning.DATES_DIFFER,
            icalSyncWarnedAt:
              existing.icalSyncWarning === IcalSyncWarning.DATES_DIFFER
                ? existing.icalSyncWarnedAt
                : new Date(),
            icalObservedUnitId: null,
            icalObservedCheckInDate: parseYmd(event.startYmd),
            icalObservedCheckOutDate: parseYmd(event.endYmd),
          },
        });
      }
    } else if (
      existing.icalSyncWarning ||
      existing.icalObservedUnitId ||
      existing.icalObservedCheckInDate
    ) {
      await tx.reservation.update({
        where: { id: existing.id },
        data: {
          icalSyncWarning: null,
          icalSyncWarnedAt: null,
          icalObservedUnitId: null,
          icalObservedCheckInDate: null,
          icalObservedCheckOutDate: null,
        },
      });
    }
  }
}

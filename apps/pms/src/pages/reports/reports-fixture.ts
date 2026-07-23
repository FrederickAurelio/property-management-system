import {
  CollectedVia,
  ReservationSource,
  inclusiveDayCount,
  previousEqualPeriod,
  type StaffReportsSummary,
  type StaffReportsSummaryParams,
} from "@cabin/api-contract";

export { previousEqualPeriod } from "@cabin/api-contract";

/**
 * Rich month-end-style fixture for `/reports` UI review.
 * Lightly varies by date span so filter changes feel real.
 */
export function buildReportsFixture(
  params: StaffReportsSummaryParams,
): StaffReportsSummary {
  const { propertyId, from, to, compare = true } = params;
  const span = inclusiveDayCount(from, to);
  const scale = Math.max(0.55, Math.min(1.35, span / 23));

  const cashIn = Math.round(58_200_000 * scale);
  const cashOut = Math.round(5_800_000 * scale);
  const cashNet = cashIn - cashOut;

  const prevIn = Math.round(52_100_000 * scale);
  const prevOut = Math.round(4_000_000 * scale);
  const prevNet = prevIn - prevOut;
  const netDelta = cashNet - prevNet;
  const netDeltaPct =
    prevNet === 0 ? null : Math.round((netDelta / prevNet) * 1000) / 10;

  const occupied = Math.round(34 * scale);
  const available = Math.round(50 * scale);
  const occupancyPct =
    available === 0 ? null : Math.round((occupied / available) * 1000) / 10;

  const prevOccupied = Math.round(30 * scale);
  const prevAvailable = Math.round(49 * scale);
  const prevOccPct =
    prevAvailable === 0
      ? null
      : Math.round((prevOccupied / prevAvailable) * 1000) / 10;
  const occDelta =
    occupancyPct == null || prevOccPct == null
      ? null
      : Math.round((occupancyPct - prevOccPct) * 10) / 10;

  const typeRows = [
    {
      unitTypeId: "ut-deluxe",
      name: "Deluxe Villa",
      sortOrder: 1,
      occupiedNights: Math.round(16 * scale),
      availableNights: Math.round(18 * scale),
      prevOcc: Math.round(13 * scale),
      prevAvail: Math.round(18 * scale),
      units: [
        {
          unitId: "u-deluxe-1",
          name: "Deluxe 1",
          sortOrder: 1,
          occupiedNights: Math.round(9 * scale),
          availableNights: Math.round(9 * scale),
          prevOcc: Math.round(8 * scale),
          prevAvail: Math.round(9 * scale),
        },
        {
          unitId: "u-deluxe-2",
          name: "Deluxe 2",
          sortOrder: 2,
          occupiedNights: Math.round(7 * scale),
          availableNights: Math.round(9 * scale),
          prevOcc: Math.round(5 * scale),
          prevAvail: Math.round(9 * scale),
        },
      ],
    },
    {
      unitTypeId: "ut-garden",
      name: "Garden Suite",
      sortOrder: 2,
      occupiedNights: Math.round(12 * scale),
      availableNights: Math.round(16 * scale),
      prevOcc: Math.round(14 * scale),
      prevAvail: Math.round(16 * scale),
      units: [
        {
          unitId: "u-garden-a",
          name: "Garden A",
          sortOrder: 1,
          occupiedNights: Math.round(8 * scale),
          availableNights: Math.round(8 * scale),
          prevOcc: Math.round(8 * scale),
          prevAvail: Math.round(8 * scale),
        },
        {
          unitId: "u-garden-b",
          name: "Garden B",
          sortOrder: 2,
          occupiedNights: Math.round(4 * scale),
          availableNights: Math.round(8 * scale),
          prevOcc: Math.round(6 * scale),
          prevAvail: Math.round(8 * scale),
        },
      ],
    },
    {
      unitTypeId: "ut-family",
      name: "Family Bungalow",
      sortOrder: 3,
      // Soft product — clearly under-booked for analysis review
      occupiedNights: Math.round(3 * scale),
      availableNights: Math.round(14 * scale),
      prevOcc: Math.round(5 * scale),
      prevAvail: Math.round(12 * scale),
      units: [
        {
          unitId: "u-family-1",
          name: "Family 1",
          sortOrder: 1,
          occupiedNights: Math.round(3 * scale),
          availableNights: Math.round(7 * scale),
          prevOcc: Math.round(4 * scale),
          prevAvail: Math.round(6 * scale),
        },
        {
          unitId: "u-family-2",
          name: "Family 2",
          sortOrder: 2,
          occupiedNights: 0,
          availableNights: Math.round(7 * scale),
          prevOcc: Math.round(1 * scale),
          prevAvail: Math.round(6 * scale),
        },
      ],
    },
    {
      unitTypeId: null,
      name: "Ungrouped",
      sortOrder: 99,
      occupiedNights: Math.max(0, occupied - Math.round(31 * scale)),
      availableNights: Math.max(0, available - Math.round(48 * scale)),
      prevOcc: Math.max(0, prevOccupied - Math.round(32 * scale)),
      prevAvail: Math.max(0, prevAvailable - Math.round(46 * scale)),
      units: [
        {
          unitId: "u-ungrouped-1",
          name: "Unit X",
          sortOrder: 1,
          occupiedNights: Math.max(0, occupied - Math.round(31 * scale)),
          availableNights: Math.max(0, available - Math.round(48 * scale)),
          prevOcc: Math.max(0, prevOccupied - Math.round(32 * scale)),
          prevAvail: Math.max(0, prevAvailable - Math.round(46 * scale)),
        },
      ],
    },
  ].map((row) => {
    const pct =
      row.availableNights === 0
        ? null
        : Math.round((row.occupiedNights / row.availableNights) * 1000) / 10;
    const prevPct =
      row.prevAvail === 0
        ? null
        : Math.round((row.prevOcc / row.prevAvail) * 1000) / 10;
    return {
      unitTypeId: row.unitTypeId,
      name: row.name,
      sortOrder: row.sortOrder,
      occupiedNights: row.occupiedNights,
      availableNights: row.availableNights,
      occupancyPct: pct,
      units: row.units.map((u) => {
        const uPct =
          u.availableNights === 0
            ? null
            : Math.round((u.occupiedNights / u.availableNights) * 1000) / 10;
        const uPrevPct =
          u.prevAvail === 0
            ? null
            : Math.round((u.prevOcc / u.prevAvail) * 1000) / 10;
        return {
          unitId: u.unitId,
          name: u.name,
          sortOrder: u.sortOrder,
          occupiedNights: u.occupiedNights,
          availableNights: u.availableNights,
          occupancyPct: uPct,
          compare: compare
            ? {
                occupiedNights: u.prevOcc,
                availableNights: u.prevAvail,
                occupancyPct: uPrevPct,
                occupancyPctDelta:
                  uPct == null || uPrevPct == null
                    ? null
                    : Math.round((uPct - uPrevPct) * 10) / 10,
              }
            : undefined,
        };
      }),
      compare: compare
        ? {
            occupiedNights: row.prevOcc,
            availableNights: row.prevAvail,
            occupancyPct: prevPct,
            occupancyPctDelta:
              pct == null || prevPct == null
                ? null
                : Math.round((pct - prevPct) * 10) / 10,
          }
        : undefined,
    };
  });

  const sourceDefs: {
    source: (typeof ReservationSource)[keyof typeof ReservationSource];
    stays: number;
    nights: number;
    prevStays: number;
    prevNights: number;
  }[] = [
    {
      source: ReservationSource.AIRBNB,
      stays: Math.round(10 * scale),
      nights: Math.round(15 * scale),
      prevStays: Math.round(8 * scale),
      prevNights: Math.round(11 * scale),
    },
    {
      source: ReservationSource.BOOKING_COM,
      stays: Math.round(7 * scale),
      nights: Math.round(11 * scale),
      prevStays: Math.round(6 * scale),
      prevNights: Math.round(10 * scale),
    },
    {
      source: ReservationSource.MANUAL,
      stays: Math.round(3 * scale),
      nights: Math.round(4 * scale),
      prevStays: Math.round(5 * scale),
      prevNights: Math.round(6 * scale),
    },
    {
      source: ReservationSource.AGODA,
      stays: Math.round(3 * scale),
      nights: Math.round(3 * scale),
      prevStays: Math.round(2 * scale),
      prevNights: Math.round(2 * scale),
    },
    {
      source: ReservationSource.WEBSITE,
      stays: Math.round(1 * scale),
      nights: Math.round(1 * scale),
      prevStays: Math.round(1 * scale),
      prevNights: Math.round(1 * scale),
    },
  ];

  // Normalize nights to match property occupied for honest %
  const rawNights = sourceDefs.reduce((s, r) => s + r.nights, 0);
  const nightScale = rawNights === 0 ? 1 : occupied / rawNights;
  const sourceMix = (
    [
      ReservationSource.MANUAL,
      ReservationSource.WEBSITE,
      ReservationSource.BOOKING_COM,
      ReservationSource.AIRBNB,
      ReservationSource.AGODA,
    ] as const
  ).map((source) => {
    const def = sourceDefs.find((d) => d.source === source)!;
    const nights = Math.round(def.nights * nightScale);
    const prevNights = Math.round(def.prevNights * nightScale);
    return {
      source,
      staysCheckInInPeriod: def.stays,
      nights,
      pctOfNights:
        occupied === 0 ? 0 : Math.round((nights / occupied) * 1000) / 10,
      compare: compare
        ? {
            staysCheckInInPeriod: def.prevStays,
            nights: prevNights,
            pctOfNights:
              prevOccupied === 0
                ? 0
                : Math.round((prevNights / prevOccupied) * 1000) / 10,
            nightsDelta: nights - prevNights,
          }
        : undefined,
    };
  });

  const compareWindow = compare ? previousEqualPeriod(from, to) : undefined;

  return {
    propertyId,
    from,
    to,
    compare: compareWindow,
    cash: {
      inIdr: cashIn,
      outIdr: cashOut,
      netIdr: cashNet,
      bySource: [
        {
          source: ReservationSource.AIRBNB,
          inIdr: Math.round(cashIn * 0.42),
          outIdr: Math.round(cashOut * 0.22),
          netIdr: Math.round(cashIn * 0.42) - Math.round(cashOut * 0.22),
        },
        {
          source: ReservationSource.BOOKING_COM,
          inIdr: Math.round(cashIn * 0.3),
          outIdr: Math.round(cashOut * 0.28),
          netIdr: Math.round(cashIn * 0.3) - Math.round(cashOut * 0.28),
        },
        {
          source: ReservationSource.MANUAL,
          inIdr: Math.round(cashIn * 0.12),
          outIdr: Math.round(cashOut * 0.25),
          netIdr: Math.round(cashIn * 0.12) - Math.round(cashOut * 0.25),
        },
        {
          source: ReservationSource.AGODA,
          inIdr: Math.round(cashIn * 0.12),
          outIdr: Math.round(cashOut * 0.15),
          netIdr: Math.round(cashIn * 0.12) - Math.round(cashOut * 0.15),
        },
        {
          source: ReservationSource.WEBSITE,
          inIdr: Math.round(cashIn * 0.04),
          outIdr: Math.round(cashOut * 0.1),
          netIdr: Math.round(cashIn * 0.04) - Math.round(cashOut * 0.1),
        },
      ],
      byUnitType: [
        {
          unitTypeId: "ut-deluxe",
          name: "Deluxe Villa",
          sortOrder: 1,
          inIdr: Math.round(cashIn * 0.48),
          outIdr: Math.round(cashOut * 0.35),
          netIdr: Math.round(cashIn * 0.48) - Math.round(cashOut * 0.35),
        },
        {
          unitTypeId: "ut-garden",
          name: "Garden Suite",
          sortOrder: 2,
          inIdr: Math.round(cashIn * 0.32),
          outIdr: Math.round(cashOut * 0.3),
          netIdr: Math.round(cashIn * 0.32) - Math.round(cashOut * 0.3),
        },
        {
          unitTypeId: "ut-family",
          name: "Family Bungalow",
          sortOrder: 3,
          inIdr: Math.round(cashIn * 0.12),
          outIdr: Math.round(cashOut * 0.2),
          netIdr: Math.round(cashIn * 0.12) - Math.round(cashOut * 0.2),
        },
        {
          unitTypeId: null,
          name: "Ungrouped",
          sortOrder: 99,
          inIdr: Math.round(cashIn * 0.08),
          outIdr: Math.round(cashOut * 0.15),
          netIdr: Math.round(cashIn * 0.08) - Math.round(cashOut * 0.15),
        },
      ],
      byMethod: [
        {
          method: CollectedVia.PROPERTY,
          inIdr: Math.round(cashIn * 0.52),
          outIdr: Math.round(cashOut * 0.7),
          netIdr: Math.round(cashIn * 0.52) - Math.round(cashOut * 0.7),
        },
        {
          method: CollectedVia.CHANNEL,
          inIdr: Math.round(cashIn * 0.35),
          outIdr: Math.round(cashOut * 0.15),
          netIdr: Math.round(cashIn * 0.35) - Math.round(cashOut * 0.15),
        },
        {
          method: CollectedVia.MIXED,
          inIdr: Math.round(cashIn * 0.1),
          outIdr: Math.round(cashOut * 0.1),
          netIdr: Math.round(cashIn * 0.1) - Math.round(cashOut * 0.1),
        },
        {
          method: null,
          inIdr: Math.round(cashIn * 0.03),
          outIdr: Math.round(cashOut * 0.05),
          netIdr: Math.round(cashIn * 0.03) - Math.round(cashOut * 0.05),
        },
      ],
      compare: compare
        ? {
            inIdr: prevIn,
            outIdr: prevOut,
            netIdr: prevNet,
            netDeltaIdr: netDelta,
            netDeltaPct,
          }
        : undefined,
    },
    occupancy: {
      occupiedNights: occupied,
      availableNights: available,
      occupancyPct,
      compare: compare
        ? {
            occupiedNights: prevOccupied,
            availableNights: prevAvailable,
            occupancyPct: prevOccPct,
            occupancyPctDelta: occDelta,
          }
        : undefined,
    },
    occupancyByUnitType: typeRows,
    sourceMix,
  };
}

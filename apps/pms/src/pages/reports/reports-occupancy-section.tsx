/* anchor: Stripe-data occupancy, diverge: one % + by-type prev/Δ columns */
import type {
  StaffReportsOccupancy,
  StaffReportsOccupancyByUnitType,
} from "@cabin/api-contract";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deltaToneClass,
  formatPct,
  formatSignedPts,
} from "./reports-format";

function OccupancyTrack({ pct }: { pct: number | null }) {
  const width = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div
      className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-foreground/70"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

type ReportsOccupancySectionProps = {
  occupancy: StaffReportsOccupancy;
  byUnitType: StaffReportsOccupancyByUnitType[];
  compare: boolean;
};

export function ReportsOccupancySection({
  occupancy,
  byUnitType,
  compare,
}: ReportsOccupancySectionProps) {
  const showCompare = compare && occupancy.compare != null;
  const sorted = [...byUnitType].sort((a, b) => a.sortOrder - b.sortOrder);
  const emptyStays =
    occupancy.occupiedNights === 0 && occupancy.availableNights > 0;

  return (
    <section className="flex flex-col gap-4 border-b border-border pb-6 md:gap-4 md:pb-5">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Occupancy</h2>
          <p className="text-xs text-muted-foreground md:text-sm">
            Occupied unit-nights ÷ available (blocks excluded)
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
              {formatPct(occupancy.occupancyPct)}
            </p>
            {showCompare && occupancy.compare && (
              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                <span>vs {formatPct(occupancy.compare.occupancyPct)}</span>
                {occupancy.compare.occupancyPctDelta != null && (
                  <span
                    className={deltaToneClass(
                      occupancy.compare.occupancyPctDelta,
                    )}
                  >
                    {formatSignedPts(occupancy.compare.occupancyPctDelta)}
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {occupancy.occupiedNights} / {occupancy.availableNights} nights
            {showCompare && occupancy.compare && (
              <span>
                {" "}
                · prev {occupancy.compare.occupiedNights} /{" "}
                {occupancy.compare.availableNights}
              </span>
            )}
          </p>
          <OccupancyTrack pct={occupancy.occupancyPct} />
          {emptyStays && (
            <p className="pt-1 text-sm text-muted-foreground">
              No overlapping stays in this period — check calendar or iCal
              feeds.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">By unit type</h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background">
                  Type
                </TableHead>
                <TableHead className="text-right">Occupied</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">%</TableHead>
                {compare && (
                  <>
                    <TableHead className="text-right">Prev %</TableHead>
                    <TableHead className="text-right">Δ%</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.unitTypeId ?? "ungrouped"}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.occupiedNights}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.availableNights}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(row.occupancyPct)}
                  </TableCell>
                  {compare && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPct(row.compare?.occupancyPct ?? null)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${deltaToneClass(row.compare?.occupancyPctDelta ?? 0)}`}
                      >
                        {formatSignedPts(row.compare?.occupancyPctDelta ?? null)}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

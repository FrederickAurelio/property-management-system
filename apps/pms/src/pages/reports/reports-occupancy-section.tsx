/* anchor: Stripe-data occupancy, diverge: type rows expand to units */
import { Fragment, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import type {
  StaffReportsOccupancy,
  StaffReportsOccupancyByUnit,
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
import { cn } from "@/lib/utils";
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

function OccupancyMetricCells({
  occupiedNights,
  availableNights,
  occupancyPct,
  compare,
  showCompare,
  muted,
}: {
  occupiedNights: number;
  availableNights: number;
  occupancyPct: number | null;
  compare?: StaffReportsOccupancyByUnit["compare"];
  showCompare: boolean;
  muted?: boolean;
}) {
  return (
    <>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {occupiedNights}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {availableNights}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {formatPct(occupancyPct)}
      </TableCell>
      {showCompare && (
        <>
          <TableCell className="text-right tabular-nums text-muted-foreground">
            {formatPct(compare?.occupancyPct ?? null)}
          </TableCell>
          <TableCell
            className={`text-right ${deltaToneClass(compare?.occupancyPctDelta ?? 0)}`}
          >
            {formatSignedPts(compare?.occupancyPctDelta ?? null)}
          </TableCell>
        </>
      )}
    </>
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleType = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
        <div>
          <h3 className="text-sm font-medium text-foreground">By unit type</h3>
          <p className="text-xs text-muted-foreground">
            Expand a type to see each unit
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background">
                  Type / unit
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
              {sorted.map((row) => {
                const typeKey = row.unitTypeId ?? "ungrouped";
                const isOpen = expanded.has(typeKey);
                const units = [...row.units].sort(
                  (a, b) => a.sortOrder - b.sortOrder,
                );
                const canExpand = units.length > 0;

                return (
                  <Fragment key={typeKey}>
                    <TableRow data-state={isOpen ? "selected" : undefined}>
                      <TableCell className="sticky left-0 z-10 bg-background font-medium">
                        {canExpand ? (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-left"
                            aria-expanded={isOpen}
                            onClick={() => {
                              toggleType(typeKey);
                            }}
                          >
                            <ChevronRightIcon
                              className={cn(
                                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-90",
                              )}
                              aria-hidden
                            />
                            <span>{row.name}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              ({units.length})
                            </span>
                          </button>
                        ) : (
                          <span className="pl-5">{row.name}</span>
                        )}
                      </TableCell>
                      <OccupancyMetricCells
                        occupiedNights={row.occupiedNights}
                        availableNights={row.availableNights}
                        occupancyPct={row.occupancyPct}
                        compare={row.compare}
                        showCompare={compare}
                      />
                    </TableRow>
                    {isOpen &&
                      units.map((unit) => (
                        <TableRow key={`${typeKey}:${unit.unitId}`}>
                          <TableCell className="sticky left-0 z-10 bg-background pl-8 text-muted-foreground">
                            {unit.name}
                          </TableCell>
                          <OccupancyMetricCells
                            occupiedNights={unit.occupiedNights}
                            availableNights={unit.availableNights}
                            occupancyPct={unit.occupancyPct}
                            compare={unit.compare}
                            showCompare={compare}
                            muted
                          />
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

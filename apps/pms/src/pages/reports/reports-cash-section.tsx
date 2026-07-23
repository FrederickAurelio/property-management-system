/* anchor: Stripe-data cash hero, diverge: Net protagonist; source→type→method */
import type { ReactNode } from "react";
import type { StaffReportsCash } from "@cabin/api-contract";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr } from "@/pages/properties/inventory-types";
import { SourceBadge } from "@/pages/reservations/reservation-badges";
import {
  formatCollectedVia,
  formatReservationSource,
} from "@/pages/reservations/reservation-format";
import {
  deltaToneClass,
  formatPct,
  formatSignedIdr,
  pctOfTotal,
} from "./reports-format";

type ReportsCashSectionProps = {
  cash: StaffReportsCash;
  compare: boolean;
};

function CashBreakdownTable({
  labelColumn,
  rows,
  periodNetAbs,
}: {
  labelColumn: string;
  rows: {
    key: string;
    label: ReactNode;
    inIdr: number;
    outIdr: number;
    netIdr: number;
  }[];
  /** Absolute period net — share denominator (0 → all shares 0). */
  periodNetAbs: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background">
              {labelColumn}
            </TableHead>
            <TableHead className="text-right">In</TableHead>
            <TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">% of net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="sticky left-0 z-10 bg-background">
                {row.label}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIdr(row.inIdr)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIdr(row.outIdr)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIdr(row.netIdr)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatPct(pctOfTotal(row.netIdr, periodNetAbs))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ReportsCashSection({ cash, compare }: ReportsCashSectionProps) {
  const empty = cash.inIdr === 0 && cash.outIdr === 0;
  const showCompare = compare && cash.compare != null;
  const byUnitType = [...cash.byUnitType].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 md:gap-3.5 md:pb-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">Cash</h2>
        <p className="text-xs text-muted-foreground md:text-sm">
          Movements posted in this period
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Net</p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
            {formatIdr(cash.netIdr)}
          </p>
          {showCompare && cash.compare && (
            <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
              <span>
                vs prev{" "}
                <span className="tabular-nums">
                  {formatIdr(cash.compare.netIdr)}
                </span>
              </span>
              <span className={deltaToneClass(cash.compare.netDeltaIdr)}>
                {formatSignedIdr(cash.compare.netDeltaIdr)}
                {cash.compare.netDeltaPct != null && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({cash.compare.netDeltaPct > 0 ? "+" : ""}
                    {cash.compare.netDeltaPct}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">In </span>
            <span className="font-medium tabular-nums">
              {formatIdr(cash.inIdr)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Out </span>
            <span className="font-medium tabular-nums">
              {formatIdr(cash.outIdr)}
            </span>
          </div>
        </div>
        {showCompare && cash.compare && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Prev in {formatIdr(cash.compare.inIdr)} · Prev out{" "}
            {formatIdr(cash.compare.outIdr)}
          </p>
        )}
      </div>

      {empty && (
        <p className="text-sm text-muted-foreground">
          No cash posted in this period.
        </p>
      )}

      {!empty && (
        <div className="flex flex-col gap-3">
          <CashBreakdownTable
            labelColumn="By source"
            periodNetAbs={Math.abs(cash.netIdr) || 0}
            rows={cash.bySource.map((row) => ({
              key: row.source,
              label: (
                <SourceBadge
                  source={row.source}
                  label={formatReservationSource(row.source)}
                />
              ),
              inIdr: row.inIdr,
              outIdr: row.outIdr,
              netIdr: row.netIdr,
            }))}
          />

          <CashBreakdownTable
            labelColumn="By unit type"
            periodNetAbs={Math.abs(cash.netIdr) || 0}
            rows={byUnitType.map((row) => ({
              key: row.unitTypeId ?? "ungrouped",
              label: row.name,
              inIdr: row.inIdr,
              outIdr: row.outIdr,
              netIdr: row.netIdr,
            }))}
          />

          <CashBreakdownTable
            labelColumn="By method"
            periodNetAbs={Math.abs(cash.netIdr) || 0}
            rows={cash.byMethod.map((row) => ({
              key: row.method ?? "unspecified",
              label: formatCollectedVia(row.method) ?? "Unspecified",
              inIdr: row.inIdr,
              outIdr: row.outIdr,
              netIdr: row.netIdr,
            }))}
          />
        </div>
      )}
    </section>
  );
}

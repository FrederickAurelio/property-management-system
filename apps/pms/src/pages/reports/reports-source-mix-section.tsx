/* anchor: Stripe-data source mix, diverge: share Δ + cash net % + Direct vs OTA */
import type {
  StaffReportsCashSourceRow,
  StaffReportsSourceMixRow,
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
  STICKY_LABEL_MAX_CLASS,
  stickyLabelCellClass,
  stickyLabelInnerClass,
} from "@/lib/sticky-label-col";
import { formatIdr } from "@/pages/properties/inventory-types";
import { SourceBadge } from "@/pages/reservations/reservation-badges";
import { formatReservationSource } from "@/pages/reservations/reservation-format";
import {
  deltaToneClass,
  directVsOta,
  formatPct,
  formatSignedNights,
  formatSignedPts,
  pctOfTotal,
  shareDeltaPp,
} from "./reports-format";

type ReportsSourceMixSectionProps = {
  rows: StaffReportsSourceMixRow[];
  cashBySource: StaffReportsCashSourceRow[];
  periodCashNet: number;
  compare: boolean;
};

export function ReportsSourceMixSection({
  rows,
  cashBySource,
  periodCashNet,
  compare,
}: ReportsSourceMixSectionProps) {
  const cashMap = new Map(cashBySource.map((r) => [r.source, r]));
  const sorted = [...rows].sort((a, b) => b.nights - a.nights);
  const totalNights = rows.reduce((s, r) => s + r.nights, 0);
  const rollup = directVsOta(rows, cashBySource, periodCashNet);
  const empty = totalNights === 0;

  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 md:pb-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">Source mix</h2>
        <p className="text-xs text-muted-foreground md:text-sm">
          Stays by check-in in period · nights overlapping period · cash net
          share
        </p>
      </div>

      {empty && (
        <p className="text-sm text-muted-foreground">
          No overlapping stay nights in this period.
        </p>
      )}

      {!empty && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={stickyLabelCellClass()}>
                    <span className={stickyLabelInnerClass()}>Source</span>
                  </TableHead>
                  <TableHead className="text-right">Stays</TableHead>
                  <TableHead className="text-right">Nights</TableHead>
                  <TableHead className="text-right">% nights</TableHead>
                  <TableHead className="text-right">Cash net</TableHead>
                  <TableHead className="text-right">% of net</TableHead>
                  {compare && (
                    <>
                      <TableHead className="text-right">Prev nights</TableHead>
                      <TableHead className="text-right">Prev %</TableHead>
                      <TableHead className="text-right">Δ share</TableHead>
                      <TableHead className="text-right">Δ nights</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const cash = cashMap.get(row.source);
                  const cashNet = cash?.netIdr ?? 0;
                  const cashPct = pctOfTotal(
                    cashNet,
                    Math.abs(periodCashNet) || 0,
                  );
                  const prevPct = row.compare?.pctOfNights;
                  const shareΔ = shareDeltaPp(row.pctOfNights, prevPct);
                  const sourceLabel = formatReservationSource(row.source);

                  return (
                    <TableRow key={row.source}>
                      <TableCell className={stickyLabelCellClass()}>
                        <div
                          className={STICKY_LABEL_MAX_CLASS}
                          title={sourceLabel}
                        >
                          <SourceBadge
                            source={row.source}
                            label={sourceLabel}
                            className="max-w-full truncate"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.staysCheckInInPeriod}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.nights}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(row.pctOfNights)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatIdr(cashNet)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPct(cashPct)}
                      </TableCell>
                      {compare && (
                        <>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.compare?.nights ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {prevPct != null ? formatPct(prevPct) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right ${deltaToneClass(shareΔ ?? 0)}`}
                          >
                            {shareΔ != null ? formatSignedPts(shareΔ) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right ${deltaToneClass(row.compare?.nightsDelta ?? 0)}`}
                          >
                            {row.compare
                              ? formatSignedNights(row.compare.nightsDelta)
                              : "—"}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground md:text-sm">
            Direct (Manual + Website) {formatPct(rollup.directNightsPct)} of
            nights · {formatPct(rollup.directCashNetPct)} of cash net
            {" · "}
            OTA {formatPct(rollup.otaNightsPct)} of nights ·{" "}
            {formatPct(rollup.otaCashNetPct)} of cash net
          </p>
        </>
      )}
    </section>
  );
}

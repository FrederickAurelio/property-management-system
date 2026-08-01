/* anchor: Stripe-data source mix, diverge: share Δ + cash net % + Direct vs OTA */
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["reports", "common"]);
  const cashMap = new Map(cashBySource.map((r) => [r.source, r]));
  const sorted = [...rows].sort((a, b) => b.nights - a.nights);
  const totalNights = rows.reduce((s, r) => s + r.nights, 0);
  const rollup = directVsOta(rows, cashBySource, periodCashNet);
  const empty = totalNights === 0;

  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 md:pb-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          {t("reports:sourceMix.title")}
        </h2>
        <p className="text-xs text-muted-foreground md:text-sm">
          {t("reports:sourceMix.subtitle")}
        </p>
      </div>

      {empty && (
        <p className="text-sm text-muted-foreground">
          {t("reports:sourceMix.empty")}
        </p>
      )}

      {!empty && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={stickyLabelCellClass()}>
                    <span className={stickyLabelInnerClass()}>
                      {t("reports:sourceMix.table.source")}
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports:sourceMix.table.stays")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports:sourceMix.table.nights")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports:sourceMix.table.pctNights")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports:sourceMix.table.cashNet")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reports:sourceMix.table.pctOfNet")}
                  </TableHead>
                  {compare && (
                    <>
                      <TableHead className="text-right">
                        {t("reports:sourceMix.table.prevNights")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports:sourceMix.table.prevPct")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports:sourceMix.table.deltaShare")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("reports:sourceMix.table.deltaNights")}
                      </TableHead>
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
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatPct(cashPct)}
                      </TableCell>
                      {compare && (
                        <>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {row.compare?.nights ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
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
            {t("reports:sourceMix.directVsOtaSummary", {
              directNightsPct: formatPct(rollup.directNightsPct),
              directCashPct: formatPct(rollup.directCashNetPct),
              otaNightsPct: formatPct(rollup.otaNightsPct),
              otaCashPct: formatPct(rollup.otaCashNetPct),
            })}
          </p>
        </>
      )}
    </section>
  );
}

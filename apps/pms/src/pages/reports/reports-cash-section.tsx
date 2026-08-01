/* anchor: Stripe-data cash hero, diverge: Net protagonist; source→type→method */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { StaffReportsCash } from "@cabin/api-contract";
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
    labelTitle?: string;
    inIdr: number;
    outIdr: number;
    netIdr: number;
  }[];
  /** Absolute period net — share denominator (0 → all shares 0). */
  periodNetAbs: number;
}) {
  const { t } = useTranslation(["reports", "common"]);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={stickyLabelCellClass()}>
              <span className={stickyLabelInnerClass()}>{labelColumn}</span>
            </TableHead>
            <TableHead className="text-right">
              {t("reports:cash.table.in")}
            </TableHead>
            <TableHead className="text-right">
              {t("reports:cash.table.out")}
            </TableHead>
            <TableHead className="text-right">
              {t("reports:cash.table.net")}
            </TableHead>
            <TableHead className="text-right">
              {t("reports:cash.table.pctOfNet")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className={stickyLabelCellClass()}>
                {typeof row.label === "string" ? (
                  <span
                    className={stickyLabelInnerClass("block")}
                    title={row.labelTitle ?? row.label}
                  >
                    {row.label}
                  </span>
                ) : (
                  <div
                    className={STICKY_LABEL_MAX_CLASS}
                    title={row.labelTitle}
                  >
                    {row.label}
                  </div>
                )}
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
  const { t } = useTranslation(["reports", "common"]);
  const empty = cash.inIdr === 0 && cash.outIdr === 0;
  const showCompare = compare && cash.compare != null;
  const byUnitType = [...cash.byUnitType].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 md:gap-3.5 md:pb-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          {t("reports:cash.title")}
        </h2>
        <p className="text-xs text-muted-foreground md:text-sm">
          {t("reports:cash.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t("reports:cash.net")}</p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
            {formatIdr(cash.netIdr)}
          </p>
          {showCompare && cash.compare && (
            <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
              <span>
                {t("reports:cash.vsPrev")}{" "}
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
            <span className="text-muted-foreground">
              {t("reports:cash.in")}{" "}
            </span>
            <span className="font-medium tabular-nums">
              {formatIdr(cash.inIdr)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {t("reports:cash.out")}{" "}
            </span>
            <span className="font-medium tabular-nums">
              {formatIdr(cash.outIdr)}
            </span>
          </div>
        </div>
        {showCompare && cash.compare && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("reports:cash.prevInOut", {
              inAmount: formatIdr(cash.compare.inIdr),
              outAmount: formatIdr(cash.compare.outIdr),
            })}
          </p>
        )}
      </div>

      {empty && (
        <p className="text-sm text-muted-foreground">
          {t("reports:cash.empty")}
        </p>
      )}

      {!empty && (
        <div className="flex flex-col gap-3">
          <CashBreakdownTable
            labelColumn={t("reports:cash.table.bySource")}
            periodNetAbs={Math.abs(cash.netIdr) || 0}
            rows={cash.bySource.map((row) => ({
              key: row.source,
              label: (
                <SourceBadge
                  source={row.source}
                  label={formatReservationSource(row.source)}
                  className="max-w-full truncate"
                />
              ),
              labelTitle: formatReservationSource(row.source),
              inIdr: row.inIdr,
              outIdr: row.outIdr,
              netIdr: row.netIdr,
            }))}
          />

          <CashBreakdownTable
            labelColumn={t("reports:cash.table.byUnitType")}
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
            labelColumn={t("reports:cash.table.byMethod")}
            periodNetAbs={Math.abs(cash.netIdr) || 0}
            rows={cash.byMethod.map((row) => ({
              key: row.method ?? "unspecified",
              label:
                formatCollectedVia(row.method) ??
                t("reports:cash.methodUnspecified"),
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

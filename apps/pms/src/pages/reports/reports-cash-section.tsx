/* anchor: Stripe-data cash hero, diverge: Net then guest ledger; billed last */
import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  StaffReportsCashOutKind,
  type PropertyExpenseCategory,
  type StaffReportsCash,
  type StaffReportsCashOutRow,
} from "@cabin/api-contract";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { cn } from "@/lib/utils";
import { formatIdr } from "@/pages/properties/inventory-types";
import { SourceBadge } from "@/pages/reservations/reservation-badges";
import {
  formatCollectedVia,
  formatReservationSource,
} from "@/pages/reservations/reservation-format";
import { formatExpenseCategory } from "@/pages/expenses/expenses-format";
import {
  deltaToneClass,
  formatPct,
  formatSignedIdr,
  guestLedgerNetIdr,
  pctOfTotal,
} from "./reports-format";

type GuestBreakdown = "source" | "unitType" | "method";

type ReportsCashSectionProps = {
  cash: StaffReportsCash;
  compare: boolean;
  expensesHref: string;
};

function AmountCell({
  amount,
  muted,
}: {
  amount: number;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        muted && "text-muted-foreground",
      )}
    >
      {formatIdr(amount)}
    </TableCell>
  );
}

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
  /** Absolute guest net — share denominator (0 → all shares 0). */
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

function outRowLabel(
  row: StaffReportsCashOutRow,
  t: (key: string) => string,
): string {
  if (row.key === StaffReportsCashOutKind.GUEST_REFUND) {
    return t("reports:cash.outGuestRefunds");
  }
  return formatExpenseCategory(row.key as PropertyExpenseCategory);
}

export function ReportsCashSection({
  cash,
  compare,
  expensesHref,
}: ReportsCashSectionProps) {
  const { t } = useTranslation(["reports", "expenses", "common"]);
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<GuestBreakdown>("source");
  const showCompare = compare && cash.compare != null;
  const guestNetAbs = Math.abs(guestLedgerNetIdr(cash)) || 0;
  const cashEmpty = cash.inIdr === 0 && cash.outIdr === 0;
  const guestEmpty = cash.guestInIdr === 0 && cash.guestOutIdr === 0;
  const byUnitType = [...cash.byUnitType].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const outVisible = cash.outByCategory.filter((row) => {
    if (row.key === StaffReportsCashOutKind.GUEST_REFUND) return true;
    return row.outIdr > 0;
  });

  const billed = cash.billed;
  const billedCompare = showCompare ? billed.compare : undefined;

  const guestRows =
    breakdown === "source"
      ? cash.bySource.map((row) => ({
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
        }))
      : breakdown === "unitType"
        ? byUnitType.map((row) => ({
            key: row.unitTypeId ?? "ungrouped",
            label: row.name,
            inIdr: row.inIdr,
            outIdr: row.outIdr,
            netIdr: row.netIdr,
          }))
        : cash.byMethod.map((row) => ({
            key: row.method ?? "unspecified",
            label:
              formatCollectedVia(row.method) ??
              t("reports:cash.methodUnspecified"),
            inIdr: row.inIdr,
            outIdr: row.outIdr,
            netIdr: row.netIdr,
          }));

  const guestLabel =
    breakdown === "source"
      ? t("reports:cash.table.bySource")
      : breakdown === "unitType"
        ? t("reports:cash.table.byUnitType")
        : t("reports:cash.table.byMethod");

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
            <span className="text-muted-foreground">
              {" "}
              {t("reports:cash.outSplit", {
                refunds: formatIdr(cash.guestOutIdr),
                expenses: formatIdr(cash.expenseOutIdr),
              })}
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

      {cashEmpty && (
        <p className="text-sm text-muted-foreground">
          {t("reports:cash.empty")}
        </p>
      )}

      {!guestEmpty && (
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {t("reports:cash.guestTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("reports:cash.guestSubtitle")}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="default"
            size="sm"
            value={breakdown}
            aria-label={t("reports:cash.breakdownAria")}
            onValueChange={(value) => {
              if (!value) return;
              setBreakdown(value as GuestBreakdown);
            }}
          >
            <ToggleGroupItem value="source">
              {t("reports:cash.table.bySource")}
            </ToggleGroupItem>
            <ToggleGroupItem value="unitType">
              {t("reports:cash.table.byUnitType")}
            </ToggleGroupItem>
            <ToggleGroupItem value="method">
              {t("reports:cash.table.byMethod")}
            </ToggleGroupItem>
          </ToggleGroup>
          <CashBreakdownTable
            labelColumn={guestLabel}
            periodNetAbs={guestNetAbs}
            rows={guestRows}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("reports:cash.outTitle")}
          </h3>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={stickyLabelCellClass()}>
                  <span className={stickyLabelInnerClass()}>
                    {t("reports:cash.table.item")}
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  {t("reports:cash.table.amount")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outVisible.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className={stickyLabelCellClass()}>
                    <span className={stickyLabelInnerClass("block")}>
                      {outRowLabel(row, t)}
                    </span>
                  </TableCell>
                  <AmountCell amount={row.outIdr} />
                </TableRow>
              ))}
              <TableRow>
                <TableCell className={stickyLabelCellClass("font-medium")}>
                  <span className={stickyLabelInnerClass("block")}>
                    {t("reports:cash.outTotal")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="block font-medium tabular-nums">
                    {formatIdr(cash.outIdr)}
                  </span>
                  {showCompare && cash.compare && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("reports:cash.prevAmount", {
                        amount: formatIdr(cash.compare.outIdr),
                      })}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("reports:cash.billedTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("reports:cash.billedSubtitle")}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={stickyLabelCellClass()}>
                  <span className={stickyLabelInnerClass()}>
                    {t("reports:cash.table.item")}
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  {t("reports:cash.table.amount")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className={stickyLabelCellClass()}>
                  <span className={stickyLabelInnerClass("block")}>
                    {t("reports:cash.billedRent")}
                  </span>
                </TableCell>
                <AmountCell amount={billed.rentIdr} />
              </TableRow>
              <TableRow data-state={utilitiesOpen ? "selected" : undefined}>
                <TableCell className={stickyLabelCellClass("font-medium")}>
                  <button
                    type="button"
                    className={cn(
                      STICKY_LABEL_MAX_CLASS,
                      "flex min-w-0 items-center gap-1.5 text-left",
                    )}
                    aria-expanded={utilitiesOpen}
                    onClick={() => {
                      setUtilitiesOpen((open) => !open);
                    }}
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        utilitiesOpen && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">
                      {t("reports:cash.billedUtilities")}
                    </span>
                  </button>
                </TableCell>
                <AmountCell amount={billed.utilitiesIdr} />
              </TableRow>
              {utilitiesOpen && (
                <Fragment>
                  {(
                    [
                      ["electricity", billed.electricityIdr],
                      ["water", billed.waterIdr],
                      ["maintenance", billed.maintenanceIdr],
                      ["admin", billed.adminIdr],
                    ] as const
                  ).map(([key, amount]) => (
                    <TableRow key={key}>
                      <TableCell
                        className={stickyLabelCellClass(
                          "pl-8 text-muted-foreground",
                        )}
                      >
                        <span className={stickyLabelInnerClass("block")}>
                          {t(`reports:cash.billed.${key}`)}
                        </span>
                      </TableCell>
                      <AmountCell amount={amount} muted />
                    </TableRow>
                  ))}
                </Fragment>
              )}
              <TableRow>
                <TableCell className={stickyLabelCellClass("font-medium")}>
                  <span className={stickyLabelInnerClass("block")}>
                    {t("reports:cash.billedTotal")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="block font-medium tabular-nums">
                    {formatIdr(billed.totalIdr)}
                  </span>
                  {billedCompare && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("reports:cash.prevAmount", {
                        amount: formatIdr(billedCompare.totalIdr),
                      })}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <Link
          to={expensesHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("reports:cash.manageExpenses")}
        </Link>
      </p>
    </section>
  );
}

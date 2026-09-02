/* anchor: Linear-dense / Stripe-data period sheet, diverge: nested utility rows per billed month */
import { useState } from "react";
import {
  UTILITY_METER_VALUE_MAX,
  UtilityKind,
  computeMeterIntervalCharges,
  recomputeStayQuoteTotal,
  sumAdminChargesIdr,
  type ArchiveItem,
  type StaffReservation,
} from "@cabin/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { DecimalAmountInput } from "@/components/form/decimal-amount-input";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { YearMonthField } from "@/components/form/year-month-field";
import { YmdDateField } from "@/components/form/ymd-date-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveProofField } from "@/components/media/archive-proof-field";
import {
  handleError,
  handleSuccess,
  downloadReservationUtilityStatement,
  putReservationUtilities,
  syncReservationCaches,
} from "@/lib/api";
import { formatDecimalInput } from "@/lib/decimal-input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIdr } from "@/pages/properties/inventory-types";
import { formatDateYmd, formatMoneyOrDash } from "./reservation-format";
import {
  addPeriod,
  applyPeriodScheme,
  deletePeriod,
  flattenPeriods,
  periodKindPreview,
  periodSubtotalIdr,
  patchPeriod,
  seedPeriods,
  utilitiesSeedInput,
  type PeriodKindPreview,
  type UtilityEnd,
  type UtilityPeriod,
} from "./utilities-period-model";
import { PeriodUtilityRulesDialog } from "./period-utility-rules-dialog";

const COL_KIND = "w-44";
const COL_METER = "w-40";
const COL_USAGE = "w-24";
const COL_AMOUNT = "w-32";
const COL_PHOTO = "w-24";
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function canExportPeriod(period: UtilityPeriod): boolean {
  if (!YEAR_MONTH.test(period.chargeYearMonth)) {
    return false;
  }
  if (!period.startDate || !period.endDate) {
    return false;
  }
  const elec =
    period.elecStart.meterDigits !== "" && period.elecEnd.meterDigits !== "";
  const water =
    period.waterStart.meterDigits !== "" && period.waterEnd.meterDigits !== "";
  return elec || water;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function meterChainError(
  readings: Array<{ readingDate: string; meterValue: number }>,
): string | null {
  if (readings.length < 2) {
    return null;
  }
  try {
    computeMeterIntervalCharges(readings, 1);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "INVALID_METER";
  }
}

function periodMeterTotals(periods: UtilityPeriod[]): {
  elec: number;
  water: number;
} {
  let elec = 0;
  let water = 0;
  for (const period of periods) {
    const scheme = period.scheme;
    const electricityAddons = scheme.utilityAddons.filter(
      (addon) => addon.utility === UtilityKind.ELECTRICITY,
    );
    const waterAddons = scheme.utilityAddons.filter(
      (addon) => addon.utility === UtilityKind.WATER,
    );
    elec +=
      periodKindPreview(
        period.elecStart,
        period.elecEnd,
        period.startDate,
        period.endDate,
        scheme.electricityRateIdrPerKwh,
        electricityAddons,
        { minBilledUnits: scheme.electricityMinKwh },
      ).kindTotalIdr ?? 0;
    water +=
      periodKindPreview(
        period.waterStart,
        period.waterEnd,
        period.startDate,
        period.endDate,
        scheme.waterRateIdrPerM3,
        waterAddons,
      ).kindTotalIdr ?? 0;
  }
  return { elec, water };
}

function feeDigitsToIdr(digits: string): number {
  if (digits === "") {
    return 0;
  }
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

function maintChargeTotal(periods: UtilityPeriod[]): {
  total: number;
  error: string | null;
} {
  const seen = new Set<string>();
  let sum = 0;
  for (const period of periods) {
    if (period.chargeYearMonth) {
      if (seen.has(period.chargeYearMonth)) {
        return { total: 0, error: "DUPLICATE_MONTH" };
      }
      seen.add(period.chargeYearMonth);
    }
    if (period.amountDigits === "") {
      continue;
    }
    const n = Number(period.amountDigits);
    if (!Number.isFinite(n) || n < 0) {
      return { total: 0, error: "INVALID_AMOUNT" };
    }
    sum += Math.floor(n);
  }
  return { total: sum, error: null };
}

function adminChargeTotal(periods: UtilityPeriod[]): {
  total: number;
  error: string | null;
} {
  const rows: Array<{ amountIdr: number }> = [];
  for (const period of periods) {
    if (period.adminDigits === "") {
      continue;
    }
    const n = Number(period.adminDigits);
    if (!Number.isFinite(n) || n < 0) {
      return { total: 0, error: "INVALID_AMOUNT" };
    }
    rows.push({ amountIdr: Math.floor(n) });
  }
  try {
    return { total: sumAdminChargesIdr(rows), error: null };
  } catch {
    return { total: 0, error: "INVALID_AMOUNT" };
  }
}

function formatUsageCell(usage: number | null): string {
  if (usage == null) {
    return "…";
  }
  if (usage < 0) {
    return "—";
  }
  return formatDecimalInput(String(usage));
}

export function UtilitiesSheet({
  open,
  onOpenChange,
  reservation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: StaffReservation;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const queryClient = useQueryClient();

  const [periods, setPeriods] = useState(() =>
    seedPeriods(utilitiesSeedInput(reservation)),
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pendingExport, setPendingExport] = useState<UtilityPeriod | null>(
    null,
  );
  const [rulesPeriodKey, setRulesPeriodKey] = useState<string | null>(null);

  const currencyPrefix = t("reservations:utilitiesSheet.currencyPrefix");
  const unitTypeDefaults = reservation.unitTypeUtilityDefaults;
  const rulesPeriod =
    periods.find((period) => period.key === rulesPeriodKey) ?? null;

  const flat = flattenPeriods(periods);
  const meterTotals = periodMeterTotals(periods);
  const elecError = meterChainError(flat.electricityReadings);
  const waterError = meterChainError(flat.waterReadings);
  const maintTotal = maintChargeTotal(periods);
  const adminTotal = adminChargeTotal(periods);
  const sheetError =
    elecError ?? waterError ?? maintTotal.error ?? adminTotal.error;
  const previewQuote = recomputeStayQuoteTotal({
    rentAmountIdr: reservation.rentAmountIdr,
    electricityAmountIdr: meterTotals.elec,
    waterAmountIdr: meterTotals.water,
    maintenanceAmountIdr: maintTotal.total,
    adminAmountIdr: adminTotal.total,
  });

  function utilitiesPayload() {
    return {
      electricityReadings: flat.electricityReadings,
      waterReadings: flat.waterReadings,
      maintenanceCharges: flat.maintenanceCharges,
      adminCharges: flat.adminCharges,
      periodSchemes: flat.periodSchemes,
    };
  }

  function sheetErrorMessage(code: string): string {
    switch (code) {
      case "METER_DECREASED":
        return t("reservations:utilitiesSheet.errorMeterDecrease");
      case "DUPLICATE_READING_DATE":
        return t("reservations:utilitiesSheet.errorDuplicateDate");
      case "DUPLICATE_MONTH":
        return t("reservations:utilitiesSheet.errorDuplicateMonth");
      default:
        return t("errors:validationFailed");
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      return putReservationUtilities(reservation.id, utilitiesPayload());
    },
    onSuccess: (saved) => {
      setPeriods(seedPeriods(utilitiesSeedInput(saved)));
      setPhotoUploading(false);
      syncReservationCaches(queryClient, saved);
      handleSuccess(t("reservations:utilitiesSheet.toastSaved"));
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (period: UtilityPeriod) => {
      const saved = await putReservationUtilities(
        reservation.id,
        utilitiesPayload(),
      );
      const { blob, filename } = await downloadReservationUtilityStatement(
        saved.id,
        period.chargeYearMonth,
      );
      return { saved, blob, filename };
    },
    onSuccess: ({ saved, blob, filename }) => {
      setPendingExport(null);
      setPeriods(seedPeriods(utilitiesSeedInput(saved)));
      setPhotoUploading(false);
      syncReservationCaches(queryClient, saved);
      triggerBrowserDownload(blob, filename);
      handleSuccess(t("reservations:utilitiesSheet.toastExported"));
    },
    onError: (error) => {
      handleError(error);
    },
  });

  return (
    <>
      <ResponsiveFormShell
        open={open}
        onOpenChange={onOpenChange}
        title={t("reservations:utilitiesSheet.title")}
        description={t("reservations:utilitiesSheet.description")}
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending || exportMutation.isPending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                saveMutation.isPending ||
                exportMutation.isPending ||
                photoUploading
              }
              onClick={() => {
                if (sheetError) {
                  toast.error(sheetErrorMessage(sheetError));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {t("reservations:utilitiesSheet.confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {periods.map((period, index) => (
              <PeriodBlock
                key={period.key}
                period={period}
                index={index}
                canDelete={periods.length > 1}
                currencyPrefix={currencyPrefix}
                propertyTimezone={reservation.propertyTimezone}
                onPhotoUploadingChange={setPhotoUploading}
                onPatch={(patch) => {
                  setPeriods((prev) => patchPeriod(prev, index, patch));
                }}
                onDelete={() => {
                  setPeriods((prev) => deletePeriod(prev, index));
                }}
                canExport={canExportPeriod(period)}
                exportPending={
                  exportMutation.isPending ||
                  saveMutation.isPending ||
                  photoUploading
                }
                onExport={() => {
                  if (sheetError) {
                    toast.error(sheetErrorMessage(sheetError));
                    return;
                  }
                  setPendingExport(period);
                }}
                onEditRules={() => {
                  setRulesPeriodKey(period.key);
                }}
              />
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPeriods((prev) =>
                    addPeriod(prev, { scheme: unitTypeDefaults }),
                  );
                }}
              >
                <PlusIcon data-icon="inline-start" />
                {t("reservations:utilitiesSheet.addPeriod")}
              </Button>
            </div>
          </div>

          {elecError === "METER_DECREASED" && (
            <p className="text-sm text-destructive">
              {t("reservations:utilitiesSheet.errorMeterDecrease")}
            </p>
          )}
          {elecError === "DUPLICATE_READING_DATE" && (
            <p className="text-sm text-destructive">
              {t("reservations:utilitiesSheet.errorDuplicateDate")}
            </p>
          )}
          {waterError === "METER_DECREASED" &&
            elecError !== "METER_DECREASED" && (
              <p className="text-sm text-destructive">
                {t("reservations:utilitiesSheet.errorMeterDecrease")}
              </p>
            )}
          {waterError === "DUPLICATE_READING_DATE" &&
            elecError !== "DUPLICATE_READING_DATE" && (
              <p className="text-sm text-destructive">
                {t("reservations:utilitiesSheet.errorDuplicateDate")}
              </p>
            )}
          {maintTotal.error === "DUPLICATE_MONTH" && (
            <p className="text-sm text-destructive">
              {t("reservations:utilitiesSheet.errorDuplicateMonth")}
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="text-muted-foreground">
              {t("reservations:utilitiesSheet.rentLine", {
                amount: formatMoneyOrDash(reservation.rentAmountIdr),
              })}
            </p>
            <p className="font-medium tabular-nums">
              {t("reservations:utilitiesSheet.newTotal")}:{" "}
              {reservation.rentAmountIdr == null
                ? formatMoneyOrDash(null)
                : formatIdr(previewQuote.totalAmountIdr ?? 0)}
            </p>
          </div>
        </div>
      </ResponsiveFormShell>
      {rulesPeriod && (
        <PeriodUtilityRulesDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setRulesPeriodKey(null);
            }
          }}
          remountKey={rulesPeriod.key}
          chargeYearMonth={rulesPeriod.chargeYearMonth}
          scheme={rulesPeriod.scheme}
          unitTypeDefaults={unitTypeDefaults}
          onSave={(scheme) => {
            setPeriods((prev) => {
              const index = prev.findIndex(
                (row) => row.key === rulesPeriod.key,
              );
              if (index < 0) {
                return prev;
              }
              return patchPeriod(
                prev,
                index,
                applyPeriodScheme(prev[index]!, scheme),
              );
            });
            setRulesPeriodKey(null);
          }}
        />
      )}
      <ConfirmDialog
        open={pendingExport != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingExport(null);
          }
        }}
        title={t("reservations:utilitiesSheet.exportConfirmTitle")}
        description={t("reservations:utilitiesSheet.exportConfirmDescription")}
        confirmLabel={t("reservations:utilitiesSheet.exportConfirm")}
        confirmDisabled={exportMutation.isPending}
        onConfirm={() => {
          if (!pendingExport) {
            return;
          }
          exportMutation.mutate(pendingExport);
        }}
      />
    </>
  );
}

function PeriodBlock({
  period,
  index,
  canDelete,
  currencyPrefix,
  propertyTimezone,
  onPatch,
  onDelete,
  onPhotoUploadingChange,
  canExport,
  exportPending,
  onExport,
  onEditRules,
}: {
  period: UtilityPeriod;
  index: number;
  canDelete: boolean;
  currencyPrefix: string;
  propertyTimezone: string;
  onPatch: (patch: Partial<UtilityPeriod>) => void;
  onDelete: () => void;
  onPhotoUploadingChange?: (uploading: boolean) => void;
  canExport: boolean;
  exportPending: boolean;
  onExport: () => void;
  onEditRules: () => void;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const isFirst = index === 0;
  const scheme = period.scheme;
  const electricityAddons = scheme.utilityAddons.filter(
    (addon) => addon.utility === UtilityKind.ELECTRICITY,
  );
  const waterAddons = scheme.utilityAddons.filter(
    (addon) => addon.utility === UtilityKind.WATER,
  );
  const elecPreview = periodKindPreview(
    period.elecStart,
    period.elecEnd,
    period.startDate,
    period.endDate,
    scheme.electricityRateIdrPerKwh,
    electricityAddons,
    { minBilledUnits: scheme.electricityMinKwh },
  );
  const waterPreview = periodKindPreview(
    period.waterStart,
    period.waterEnd,
    period.startDate,
    period.endDate,
    scheme.waterRateIdrPerM3,
    waterAddons,
  );
  const subtotal = periodSubtotalIdr(period);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isFirst ? (
            <Field className="w-auto">
              <FieldLabel className="sr-only">
                {t("reservations:utilitiesSheet.startDate")}
              </FieldLabel>
              <YmdDateField
                value={period.startDate}
                timeZone={propertyTimezone}
                onChange={(ymd) => {
                  onPatch({ startDate: ymd });
                }}
              />
            </Field>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatDateYmd(period.startDate)}
            </span>
          )}
          <span className="text-muted-foreground">→</span>
          <Field className="w-auto">
            <FieldLabel className="sr-only">
              {t("reservations:utilitiesSheet.endDate")}
            </FieldLabel>
            <YmdDateField
              value={period.endDate}
              timeZone={propertyTimezone}
              onChange={(ymd) => {
                onPatch({ endDate: ymd });
              }}
            />
          </Field>
        </div>
        <div className="flex items-center gap-1">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("reservations:utilitiesSheet.periodSubtotal")}{" "}
            <span className="font-medium text-foreground">
              {formatIdr(subtotal)}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditRules}
          >
            {t("reservations:utilitiesSheet.periodRules")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport || exportPending}
            onClick={onExport}
          >
            {t("reservations:utilitiesSheet.exportPdf")}
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("reservations:utilitiesSheet.deletePeriodAria")}
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table className="min-w-[48.75rem] table-fixed">
          <colgroup>
            <col className={COL_KIND} />
            <col className={COL_METER} />
            <col className={COL_METER} />
            <col className={COL_USAGE} />
            <col className={COL_AMOUNT} />
            <col className={COL_PHOTO} />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className={cn(
                  COL_KIND,
                  "text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colKind")}
              </TableHead>
              <TableHead
                className={cn(
                  COL_METER,
                  "text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colStart")}
              </TableHead>
              <TableHead
                className={cn(
                  COL_METER,
                  "text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colEnd")}
              </TableHead>
              <TableHead
                className={cn(
                  COL_USAGE,
                  "text-right text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colUsage")}
              </TableHead>
              <TableHead
                className={cn(
                  COL_AMOUNT,
                  "text-right text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colAmount")}
              </TableHead>
              <TableHead
                className={cn(
                  COL_PHOTO,
                  "text-xs font-medium text-muted-foreground",
                )}
              >
                {t("reservations:utilitiesSheet.colPhoto")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <MeterKindRow
              kindLabel={t("reservations:utilitiesSheet.electricity")}
              unitLabel={t("reservations:utilitiesSheet.unitKwh")}
              start={period.elecStart}
              end={period.elecEnd}
              preview={elecPreview}
              startEditable={isFirst}
              startLabel={`${t("reservations:utilitiesSheet.electricity")} ${t("reservations:utilitiesSheet.colStart")}`}
              endLabel={`${t("reservations:utilitiesSheet.electricity")} ${t("reservations:utilitiesSheet.colEnd")}`}
              onStartChange={(elecStart) => {
                onPatch({ elecStart });
              }}
              onEndChange={(elecEnd) => {
                onPatch({ elecEnd });
              }}
              onPhotoUploadingChange={onPhotoUploadingChange}
            />
            <KindBreakdownRows preview={elecPreview} showMin />
            <MeterKindRow
              kindLabel={t("reservations:utilitiesSheet.water")}
              unitLabel={t("reservations:utilitiesSheet.unitM3")}
              start={period.waterStart}
              end={period.waterEnd}
              preview={waterPreview}
              startEditable={isFirst}
              startLabel={`${t("reservations:utilitiesSheet.water")} ${t("reservations:utilitiesSheet.colStart")}`}
              endLabel={`${t("reservations:utilitiesSheet.water")} ${t("reservations:utilitiesSheet.colEnd")}`}
              onStartChange={(waterStart) => {
                onPatch({ waterStart });
              }}
              onEndChange={(waterEnd) => {
                onPatch({ waterEnd });
              }}
              onPhotoUploadingChange={onPhotoUploadingChange}
            />
            <KindBreakdownRows preview={waterPreview} />
            <TableRow className="hover:bg-transparent">
              <TableCell className={cn(COL_KIND, "align-top")}>
                <span className="text-sm font-medium">
                  {t("reservations:utilitiesSheet.maintenance")}
                </span>
              </TableCell>
              <TableCell
                className={cn(COL_METER, "align-top text-muted-foreground")}
              >
                —
              </TableCell>
              <TableCell className={cn(COL_METER, "align-top")}>
                <Field>
                  <FieldLabel className="sr-only">
                    {t("reservations:utilitiesSheet.colMonth")}
                  </FieldLabel>
                  <YearMonthField
                    value={period.chargeYearMonth}
                    onChange={(ym) => {
                      onPatch({ chargeYearMonth: ym });
                    }}
                    placeholder={t("reservations:utilitiesSheet.colMonth")}
                  />
                </Field>
              </TableCell>
              <TableCell
                className={cn(
                  COL_USAGE,
                  "text-right align-top text-muted-foreground",
                )}
              >
                —
              </TableCell>
              <TableCell className={cn(COL_AMOUNT, "align-top")}>
                <Field>
                  <FieldLabel className="sr-only">
                    {t("reservations:utilitiesSheet.colAmount")}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>{currencyPrefix}</InputGroupText>
                    </InputGroupAddon>
                    <IdrAmountInput
                      data-slot="input-group-control"
                      className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                      value={period.amountDigits}
                      onValueChange={(amountDigits) => {
                        onPatch({
                          amountDigits,
                          scheme: {
                            ...period.scheme,
                            maintenanceFeeIdrPerMonth:
                              feeDigitsToIdr(amountDigits),
                          },
                        });
                      }}
                    />
                  </InputGroup>
                </Field>
              </TableCell>
              <TableCell
                className={cn(COL_PHOTO, "align-top text-muted-foreground")}
              >
                —
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className={cn(COL_KIND, "align-top")}>
                <span className="text-sm font-medium">
                  {t("reservations:utilitiesSheet.admin")}
                </span>
              </TableCell>
              <TableCell
                className={cn(COL_METER, "align-top text-muted-foreground")}
              >
                —
              </TableCell>
              <TableCell
                className={cn(COL_METER, "align-top text-muted-foreground")}
              >
                —
              </TableCell>
              <TableCell
                className={cn(
                  COL_USAGE,
                  "text-right align-top text-muted-foreground",
                )}
              >
                —
              </TableCell>
              <TableCell className={cn(COL_AMOUNT, "align-top")}>
                <Field>
                  <FieldLabel className="sr-only">
                    {t("reservations:utilitiesSheet.colAmount")}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>{currencyPrefix}</InputGroupText>
                    </InputGroupAddon>
                    <IdrAmountInput
                      data-slot="input-group-control"
                      className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                      value={period.adminDigits}
                      onValueChange={(adminDigits) => {
                        onPatch({
                          adminDigits,
                          scheme: {
                            ...period.scheme,
                            adminFeeIdrPerMonth: feeDigitsToIdr(adminDigits),
                          },
                        });
                      }}
                    />
                  </InputGroup>
                </Field>
              </TableCell>
              <TableCell
                className={cn(COL_PHOTO, "align-top text-muted-foreground")}
              >
                —
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MeterKindRow({
  kindLabel,
  unitLabel,
  start,
  end,
  preview,
  startEditable,
  startLabel,
  endLabel,
  onStartChange,
  onEndChange,
  onPhotoUploadingChange,
}: {
  kindLabel: string;
  unitLabel: string;
  start: UtilityEnd;
  end: UtilityEnd;
  preview: PeriodKindPreview;
  startEditable: boolean;
  startLabel: string;
  endLabel: string;
  onStartChange: (next: UtilityEnd) => void;
  onEndChange: (next: UtilityEnd) => void;
  onPhotoUploadingChange?: (uploading: boolean) => void;
}) {
  const amount = preview.kindTotalIdr;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className={cn(COL_KIND, "align-top")}>
        <span className="text-sm font-medium">{kindLabel}</span>
        <span className="text-muted-foreground"> {unitLabel}</span>
      </TableCell>
      <TableCell className={cn(COL_METER, "align-top")}>
        {startEditable ? (
          <Field>
            <FieldLabel className="sr-only">{startLabel}</FieldLabel>
            <DecimalAmountInput
              className="w-full"
              value={start.meterDigits}
              max={UTILITY_METER_VALUE_MAX}
              onValueChange={(meterDigits) => {
                onStartChange({ ...start, meterDigits });
              }}
            />
          </Field>
        ) : (
          <span className="text-muted-foreground tabular-nums">
            {start.meterDigits ? formatDecimalInput(start.meterDigits) : "—"}
          </span>
        )}
      </TableCell>
      <TableCell className={cn(COL_METER, "align-top")}>
        <Field>
          <FieldLabel className="sr-only">{endLabel}</FieldLabel>
          <DecimalAmountInput
            className="w-full"
            value={end.meterDigits}
            max={UTILITY_METER_VALUE_MAX}
            onValueChange={(meterDigits) => {
              onEndChange({ ...end, meterDigits });
            }}
          />
        </Field>
      </TableCell>
      <TableCell
        className={cn(
          COL_USAGE,
          "text-right align-top text-muted-foreground tabular-nums",
        )}
      >
        {formatUsageCell(preview.usage)}
      </TableCell>
      <TableCell
        className={cn(COL_AMOUNT, "text-right align-top tabular-nums")}
      >
        {amount == null ? "—" : formatIdr(amount)}
      </TableCell>
      <TableCell className={cn(COL_PHOTO, "align-top")}>
        <ArchiveProofField
          layout="pair"
          value={end.proofImages}
          onUploadingChange={onPhotoUploadingChange}
          onChange={(proofImages: ArchiveItem[]) => {
            onEndChange({ ...end, proofImages });
          }}
        />
      </TableCell>
    </TableRow>
  );
}

function KindBreakdownRows({
  preview,
  showMin = false,
}: {
  preview: PeriodKindPreview;
  showMin?: boolean;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const hasAddons = preview.addonLines.length > 0;
  const showBilled = showMin && preview.minApplied;
  if (
    preview.usageAmountIdr == null ||
    preview.kindTotalIdr == null ||
    (!showBilled && !hasAddons)
  ) {
    return null;
  }

  return (
    <>
      <NestedMathRow
        label={t("reservations:utilitiesSheet.actualUsage")}
        usage={formatUsageCell(preview.usage)}
      />
      {showBilled && (
        <NestedMathRow
          label={t("reservations:utilitiesSheet.billed")}
          usage={formatDecimalInput(String(preview.billedUnits))}
        />
      )}
      <NestedMathRow
        label={t("reservations:utilitiesSheet.usageRp")}
        amount={formatIdr(preview.usageAmountIdr)}
      />
      {preview.addonLines.map((line) => (
        <NestedMathRow
          key={`${line.name}-${line.kind}-${line.value}`}
          label={line.name}
          amount={formatIdr(line.amountIdr)}
        />
      ))}
      <NestedMathRow
        label={t("reservations:utilitiesSheet.kindSubtotal")}
        amount={formatIdr(preview.kindTotalIdr)}
        emphasize
      />
    </>
  );
}

function NestedMathRow({
  label,
  usage,
  amount,
  emphasize,
}: {
  label: string;
  usage?: string;
  amount?: string;
  emphasize?: boolean;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        className={cn(
          COL_KIND,
          "pl-4 align-top text-sm",
          emphasize ? "font-medium" : "text-muted-foreground",
        )}
      >
        {label}
      </TableCell>
      <TableCell className={COL_METER} />
      <TableCell className={COL_METER} />
      <TableCell
        className={cn(
          COL_USAGE,
          "text-right align-top text-muted-foreground tabular-nums",
        )}
      >
        {usage ?? ""}
      </TableCell>
      <TableCell
        className={cn(
          COL_AMOUNT,
          "text-right align-top tabular-nums",
          emphasize && "font-medium",
        )}
      >
        {amount ?? ""}
      </TableCell>
      <TableCell className={COL_PHOTO} />
    </TableRow>
  );
}

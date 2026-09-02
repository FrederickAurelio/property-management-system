/* anchor: Linear-dense / Stripe-data period sheet, diverge: nested utility rows per billed month */
import { useState } from "react";
import {
  UTILITY_METER_VALUE_MAX,
  computeMeterIntervalCharges,
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  deletePeriod,
  flattenPeriods,
  meterAmountIdr,
  meterUsage,
  patchPeriod,
  periodSubtotalIdr,
  seedPeriods,
  type UtilityEnd,
  type UtilityPeriod,
} from "./utilities-period-model";

const COL_KIND = "w-36";
const COL_METER = "w-40";
const COL_USAGE = "w-24";
const COL_AMOUNT = "w-32";
const COL_PHOTO = "w-24";

function meterChargeTotal(
  readings: Array<{ readingDate: string; meterValue: number }>,
  rate: number,
): { total: number; error: string | null } {
  if (readings.length < 2) {
    return { total: 0, error: null };
  }
  try {
    return {
      total: computeMeterIntervalCharges(readings, rate).totalAmountIdr,
      error: null,
    };
  } catch (e) {
    return {
      total: 0,
      error: e instanceof Error ? e.message : "INVALID_METER",
    };
  }
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

function formatUsageCell(usage: number | null): string {
  if (usage == null) {
    return "…";
  }
  if (usage < 0) {
    return "—";
  }
  return formatDecimalInput(String(usage));
}

function RateField({
  label,
  value,
  onValueChange,
  suffix,
  currencyPrefix,
}: {
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  suffix: string;
  currencyPrefix: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>{currencyPrefix}</InputGroupText>
        </InputGroupAddon>
        <IdrAmountInput
          data-slot="input-group-control"
          className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
          value={value}
          onValueChange={onValueChange}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
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

  const [elecRateDigits, setElecRateDigits] = useState(
    String(reservation.electricityRateIdrPerKwh),
  );
  const [waterRateDigits, setWaterRateDigits] = useState(
    String(reservation.waterRateIdrPerM3),
  );
  const [maintFeeDigits, setMaintFeeDigits] = useState(
    String(reservation.maintenanceFeeIdrPerMonth),
  );
  const [periods, setPeriods] = useState(() => seedPeriods(reservation));
  const [photoUploading, setPhotoUploading] = useState(false);

  const elecRate = Number(elecRateDigits) || 0;
  const waterRate = Number(waterRateDigits) || 0;
  const maintDefault = Number(maintFeeDigits) || 0;
  const currencyPrefix = t("reservations:utilitiesSheet.currencyPrefix");

  const flat = flattenPeriods(periods);
  const elecSummary = meterChargeTotal(flat.electricityReadings, elecRate);
  const waterSummary = meterChargeTotal(flat.waterReadings, waterRate);
  const maintTotal = maintChargeTotal(periods);
  const sheetError =
    elecSummary.error ?? waterSummary.error ?? maintTotal.error;

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
      return putReservationUtilities(reservation.id, {
        electricityRateIdrPerKwh: Math.floor(elecRate),
        waterRateIdrPerM3: Math.floor(waterRate),
        maintenanceFeeIdrPerMonth: Math.floor(maintDefault),
        electricityReadings: flat.electricityReadings,
        waterReadings: flat.waterReadings,
        maintenanceCharges: flat.maintenanceCharges,
      });
    },
    onSuccess: (saved) => {
      setPeriods(seedPeriods(saved));
      setPhotoUploading(false);
      syncReservationCaches(queryClient, saved);
      handleSuccess(t("reservations:utilitiesSheet.toastSaved"));
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  return (
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
            disabled={saveMutation.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending || photoUploading}
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
        <FieldGroup className="grid gap-3 sm:grid-cols-3">
          <RateField
            label={t("reservations:utilitiesSheet.elecRate")}
            value={elecRateDigits}
            onValueChange={setElecRateDigits}
            suffix={t("reservations:utilitiesSheet.perKwh")}
            currencyPrefix={currencyPrefix}
          />
          <RateField
            label={t("reservations:utilitiesSheet.waterRate")}
            value={waterRateDigits}
            onValueChange={setWaterRateDigits}
            suffix={t("reservations:utilitiesSheet.perM3")}
            currencyPrefix={currencyPrefix}
          />
          <RateField
            label={t("reservations:utilitiesSheet.maintDefault")}
            value={maintFeeDigits}
            onValueChange={setMaintFeeDigits}
            suffix={t("reservations:utilitiesSheet.perMonth")}
            currencyPrefix={currencyPrefix}
          />
        </FieldGroup>

        <div className="flex flex-col gap-4">
          {periods.map((period, index) => (
            <PeriodBlock
              key={period.key}
              period={period}
              index={index}
              canDelete={periods.length > 1}
              elecRate={elecRate}
              waterRate={waterRate}
              currencyPrefix={currencyPrefix}
              propertyTimezone={reservation.propertyTimezone}
              onPhotoUploadingChange={setPhotoUploading}
              onPatch={(patch) => {
                setPeriods((prev) => patchPeriod(prev, index, patch));
              }}
              onDelete={() => {
                setPeriods((prev) => deletePeriod(prev, index));
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
                  addPeriod(prev, { maintenanceFeeIdrPerMonth: maintDefault }),
                );
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {t("reservations:utilitiesSheet.addPeriod")}
            </Button>
          </div>
        </div>

        {elecSummary.error === "METER_DECREASED" && (
          <p className="text-sm text-destructive">
            {t("reservations:utilitiesSheet.errorMeterDecrease")}
          </p>
        )}
        {elecSummary.error === "DUPLICATE_READING_DATE" && (
          <p className="text-sm text-destructive">
            {t("reservations:utilitiesSheet.errorDuplicateDate")}
          </p>
        )}
        {waterSummary.error === "METER_DECREASED" &&
          elecSummary.error !== "METER_DECREASED" && (
            <p className="text-sm text-destructive">
              {t("reservations:utilitiesSheet.errorMeterDecrease")}
            </p>
          )}
        {waterSummary.error === "DUPLICATE_READING_DATE" &&
          elecSummary.error !== "DUPLICATE_READING_DATE" && (
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
              : formatIdr(
                  reservation.rentAmountIdr +
                    elecSummary.total +
                    waterSummary.total +
                    maintTotal.total,
                )}
          </p>
        </div>
      </div>
    </ResponsiveFormShell>
  );
}

function PeriodBlock({
  period,
  index,
  canDelete,
  elecRate,
  waterRate,
  currencyPrefix,
  propertyTimezone,
  onPatch,
  onDelete,
  onPhotoUploadingChange,
}: {
  period: UtilityPeriod;
  index: number;
  canDelete: boolean;
  elecRate: number;
  waterRate: number;
  currencyPrefix: string;
  propertyTimezone: string;
  onPatch: (patch: Partial<UtilityPeriod>) => void;
  onDelete: () => void;
  onPhotoUploadingChange?: (uploading: boolean) => void;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const isFirst = index === 0;
  const subtotal = periodSubtotalIdr(period, elecRate, waterRate);

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
              rate={elecRate}
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
            <MeterKindRow
              kindLabel={t("reservations:utilitiesSheet.water")}
              unitLabel={t("reservations:utilitiesSheet.unitM3")}
              start={period.waterStart}
              end={period.waterEnd}
              rate={waterRate}
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
                        onPatch({ amountDigits });
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
  rate,
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
  rate: number;
  startEditable: boolean;
  startLabel: string;
  endLabel: string;
  onStartChange: (next: UtilityEnd) => void;
  onEndChange: (next: UtilityEnd) => void;
  onPhotoUploadingChange?: (uploading: boolean) => void;
}) {
  const usage = meterUsage(start, end);
  const amount = meterAmountIdr(usage, rate);

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
        {formatUsageCell(usage)}
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

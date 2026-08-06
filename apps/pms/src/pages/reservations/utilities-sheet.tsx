/* anchor: Linear-dense utilities sheet, diverge: monthly meter + maintenance tables */
import { useState } from "react";
import {
  UtilityKind,
  UTILITY_METER_VALUE_MAX,
  computeMeterIntervalCharges,
  defaultFirstMaintenanceChargeYearMonth,
  defaultNextMaintenanceChargeYearMonth,
  defaultNextUtilityReadingDateYmd,
  yearMonthToChargeDateYmd,
  ymdYearMonth,
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
import { Separator } from "@/components/ui/separator";
import {
  handleError,
  handleSuccess,
  putReservationUtilities,
  syncReservationCaches,
} from "@/lib/api";
import { toast } from "sonner";
import {
  formatDecimalInput,
  formatIdr,
  plainFromMeterValue,
} from "@/pages/properties/inventory-types";
import { formatMoneyOrDash } from "./reservation-format";

type MeterRow = {
  key: string;
  readingDate: string;
  /** Canonical plain meter string (`"1234.5"`) for Number(). */
  meterDigits: string;
};

type MaintRow = {
  key: string;
  /** Calendar month `YYYY-MM` (desk); API stores as 1st of month. */
  chargeYearMonth: string;
  amountDigits: string;
};

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedMeterRows(
  reservation: StaffReservation,
  utility: typeof UtilityKind.ELECTRICITY | typeof UtilityKind.WATER,
): MeterRow[] {
  const existing = (reservation.utilityReadings ?? []).filter(
    (r) => r.utility === utility,
  );
  if (existing.length > 0) {
    return existing.map((r) => ({
      key: r.id,
      readingDate: r.readingDate,
      meterDigits: plainFromMeterValue(Number(r.meterValue)),
    }));
  }
  return [
    {
      key: newKey(),
      readingDate: reservation.checkInDate,
      meterDigits: "",
    },
  ];
}

function seedMaintRows(reservation: StaffReservation): MaintRow[] {
  const existing = reservation.maintenanceCharges ?? [];
  if (existing.length > 0) {
    return existing.map((c) => ({
      key: c.id,
      chargeYearMonth: ymdYearMonth(c.chargeDate) ?? c.chargeDate.slice(0, 7),
      amountDigits: String(c.amountIdr),
    }));
  }
  return [];
}

function meterChargeTotal(
  rows: MeterRow[],
  rate: number,
): { total: number; error: string | null } {
  const parsed = rows
    .filter((r) => r.readingDate && r.meterDigits !== "")
    .map((r) => ({
      readingDate: r.readingDate,
      meterValue: Number(r.meterDigits),
    }));
  if (parsed.length < 2) {
    return { total: 0, error: null };
  }
  try {
    return {
      total: computeMeterIntervalCharges(parsed, rate).totalAmountIdr,
      error: null,
    };
  } catch (e) {
    return {
      total: 0,
      error: e instanceof Error ? e.message : "INVALID_METER",
    };
  }
}

function maintChargeTotal(rows: MaintRow[]): {
  total: number;
  error: string | null;
} {
  const seen = new Set<string>();
  let sum = 0;
  for (const row of rows) {
    if (row.chargeYearMonth) {
      if (seen.has(row.chargeYearMonth)) {
        return { total: 0, error: "DUPLICATE_MONTH" };
      }
      seen.add(row.chargeYearMonth);
    }
    if (row.amountDigits === "") {
      continue;
    }
    const n = Number(row.amountDigits);
    if (!Number.isFinite(n) || n < 0) {
      return { total: 0, error: "INVALID_AMOUNT" };
    }
    sum += Math.floor(n);
  }
  return { total: sum, error: null };
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
  const [elecRows, setElecRows] = useState(() =>
    seedMeterRows(reservation, UtilityKind.ELECTRICITY),
  );
  const [waterRows, setWaterRows] = useState(() =>
    seedMeterRows(reservation, UtilityKind.WATER),
  );
  const [maintRows, setMaintRows] = useState(() => seedMaintRows(reservation));

  const elecRate = Number(elecRateDigits) || 0;
  const waterRate = Number(waterRateDigits) || 0;
  const maintDefault = Number(maintFeeDigits) || 0;

  const elecSummary = meterChargeTotal(elecRows, elecRate);
  const waterSummary = meterChargeTotal(waterRows, waterRate);
  const maintTotal = maintChargeTotal(maintRows);
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
        electricityReadings: elecRows
          .filter((r) => r.readingDate && r.meterDigits !== "")
          .map((r) => ({
            utility: UtilityKind.ELECTRICITY,
            readingDate: r.readingDate,
            meterValue: Number(r.meterDigits),
          })),
        waterReadings: waterRows
          .filter((r) => r.readingDate && r.meterDigits !== "")
          .map((r) => ({
            utility: UtilityKind.WATER,
            readingDate: r.readingDate,
            meterValue: Number(r.meterDigits),
          })),
        maintenanceCharges: maintRows
          .filter((r) => r.chargeYearMonth && r.amountDigits !== "")
          .map((r) => ({
            chargeDate: yearMonthToChargeDateYmd(r.chargeYearMonth),
            amountIdr: Math.floor(Number(r.amountDigits)),
          })),
      });
    },
    onSuccess: (saved) => {
      setElecRows(seedMeterRows(saved, UtilityKind.ELECTRICITY));
      setWaterRows(seedMeterRows(saved, UtilityKind.WATER));
      setMaintRows(seedMaintRows(saved));
      syncReservationCaches(queryClient, saved);
      handleSuccess(t("reservations:utilitiesSheet.toastSaved"));
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  function addMeterRow(rows: MeterRow[], setRows: (rows: MeterRow[]) => void) {
    const last = rows[rows.length - 1];
    const nextDate = last
      ? defaultNextUtilityReadingDateYmd(last.readingDate)
      : reservation.checkInDate;
    setRows([
      ...rows,
      {
        key: newKey(),
        readingDate: nextDate,
        // Prefill from previous reading so staff bumps usage, not retype the whole meter.
        meterDigits: last?.meterDigits ?? "",
      },
    ]);
  }

  function addMaintRow() {
    const last = maintRows[maintRows.length - 1];
    const nextMonth = last?.chargeYearMonth
      ? defaultNextMaintenanceChargeYearMonth(last.chargeYearMonth)
      : defaultFirstMaintenanceChargeYearMonth(reservation.checkInDate);
    setMaintRows([
      ...maintRows,
      {
        key: newKey(),
        chargeYearMonth: nextMonth,
        amountDigits: maintDefault > 0 ? String(maintDefault) : "",
      },
    ]);
  }

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={t("reservations:utilitiesSheet.title")}
      description={t("reservations:utilitiesSheet.description")}
      size="lg"
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
            disabled={saveMutation.isPending}
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
          <Field>
            <FieldLabel>{t("reservations:utilitiesSheet.elecRate")}</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  {t("reservations:utilitiesSheet.currencyPrefix")}
                </InputGroupText>
              </InputGroupAddon>
              <IdrAmountInput
                data-slot="input-group-control"
                className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                value={elecRateDigits}
                onValueChange={setElecRateDigits}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>
                  {t("reservations:utilitiesSheet.perKwh")}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>
              {t("reservations:utilitiesSheet.waterRate")}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  {t("reservations:utilitiesSheet.currencyPrefix")}
                </InputGroupText>
              </InputGroupAddon>
              <IdrAmountInput
                data-slot="input-group-control"
                className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                value={waterRateDigits}
                onValueChange={setWaterRateDigits}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>
                  {t("reservations:utilitiesSheet.perM3")}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel>
              {t("reservations:utilitiesSheet.maintDefault")}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  {t("reservations:utilitiesSheet.currencyPrefix")}
                </InputGroupText>
              </InputGroupAddon>
              <IdrAmountInput
                data-slot="input-group-control"
                className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                value={maintFeeDigits}
                onValueChange={setMaintFeeDigits}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>
                  {t("reservations:utilitiesSheet.perMonth")}
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>

        <MeterTable
          title={t("reservations:utilitiesSheet.electricity")}
          unitLabel="kWh"
          rows={elecRows}
          setRows={setElecRows}
          rate={elecRate}
          summary={elecSummary}
          onAdd={() => {
            addMeterRow(elecRows, setElecRows);
          }}
          addLabel={t("reservations:utilitiesSheet.addReading")}
          errorMeter={t("reservations:utilitiesSheet.errorMeterDecrease")}
          errorDup={t("reservations:utilitiesSheet.errorDuplicateDate")}
        />

        <Separator />

        <MeterTable
          title={t("reservations:utilitiesSheet.water")}
          unitLabel="m³"
          rows={waterRows}
          setRows={setWaterRows}
          rate={waterRate}
          summary={waterSummary}
          onAdd={() => {
            addMeterRow(waterRows, setWaterRows);
          }}
          addLabel={t("reservations:utilitiesSheet.addReading")}
          errorMeter={t("reservations:utilitiesSheet.errorMeterDecrease")}
          errorDup={t("reservations:utilitiesSheet.errorDuplicateDate")}
        />

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t("reservations:utilitiesSheet.maintenance")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMaintRow}
            >
              <PlusIcon data-icon="inline-start" />
              {t("reservations:utilitiesSheet.addMonth")}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-md text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("reservations:utilitiesSheet.colMonth")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("reservations:utilitiesSheet.colAmount")}
                  </th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {maintRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                      {t("reservations:utilitiesSheet.emptyMaint")}
                    </td>
                  </tr>
                )}
                {maintRows.map((row, index) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-2">
                      <YearMonthField
                        value={row.chargeYearMonth}
                        onChange={(ym) => {
                          const next = [...maintRows];
                          next[index] = {
                            ...row,
                            chargeYearMonth: ym,
                          };
                          setMaintRows(next);
                        }}
                        placeholder={t("reservations:utilitiesSheet.colMonth")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>
                            {t("reservations:utilitiesSheet.currencyPrefix")}
                          </InputGroupText>
                        </InputGroupAddon>
                        <IdrAmountInput
                          data-slot="input-group-control"
                          className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                          value={row.amountDigits}
                          onValueChange={(v) => {
                            const next = [...maintRows];
                            next[index] = { ...row, amountDigits: v };
                            setMaintRows(next);
                          }}
                        />
                      </InputGroup>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("common:actions.delete")}
                        onClick={() => {
                          setMaintRows(maintRows.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
                {maintTotal.error === "DUPLICATE_MONTH" && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-sm text-destructive"
                    >
                      {t("reservations:utilitiesSheet.errorDuplicateMonth")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm tabular-nums">
            {t("reservations:utilitiesSheet.subtotal")}:{" "}
            <span className="font-medium">{formatIdr(maintTotal.total)}</span>
          </p>
        </div>

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

function MeterTable({
  title,
  unitLabel,
  rows,
  setRows,
  rate,
  summary,
  onAdd,
  addLabel,
  errorMeter,
  errorDup,
}: {
  title: string;
  unitLabel: string;
  rows: MeterRow[];
  setRows: (rows: MeterRow[]) => void;
  rate: number;
  summary: { total: number; error: string | null };
  onAdd: () => void;
  addLabel: string;
  errorMeter: string;
  errorDup: string;
}) {
  const { t } = useTranslation(["reservations", "common"]);
  const intervals =
    summary.error == null
      ? (() => {
          try {
            const parsed = rows
              .filter((r) => r.readingDate && r.meterDigits !== "")
              .map((r) => ({
                readingDate: r.readingDate,
                meterValue: Number(r.meterDigits),
              }));
            if (parsed.length < 2) {
              return [];
            }
            return computeMeterIntervalCharges(parsed, rate).intervals;
          } catch {
            return [];
          }
        })()
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {addLabel}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-lg text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("reservations:utilitiesSheet.colDate")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("reservations:utilitiesSheet.colMeter", { unit: unitLabel })}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("reservations:utilitiesSheet.colUsage")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("reservations:utilitiesSheet.currencyPrefix")}
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const interval = intervals.find(
                (i) => i.toDate === row.readingDate,
              );
              return (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-3 py-2">
                    <YmdDateField
                      value={row.readingDate}
                      onChange={(ymd) => {
                        const next = [...rows];
                        next[index] = {
                          ...row,
                          readingDate: ymd,
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <DecimalAmountInput
                      value={row.meterDigits}
                      max={UTILITY_METER_VALUE_MAX}
                      onValueChange={(plain) => {
                        const next = [...rows];
                        next[index] = {
                          ...row,
                          meterDigits: plain,
                        };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {interval
                      ? formatDecimalInput(plainFromMeterValue(interval.usage))
                      : index === 0
                        ? "—"
                        : "…"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {interval ? formatIdr(interval.amountIdr) : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("common:actions.delete")}
                        onClick={() => {
                          setRows(rows.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {summary.error === "METER_DECREASED" && (
        <p className="text-xs text-destructive">{errorMeter}</p>
      )}
      {summary.error === "DUPLICATE_READING_DATE" && (
        <p className="text-xs text-destructive">{errorDup}</p>
      )}
      <p className="text-sm tabular-nums">
        {t("reservations:utilitiesSheet.subtotal")}:{" "}
        <span className="font-medium">{formatIdr(summary.total)}</span>
      </p>
    </div>
  );
}

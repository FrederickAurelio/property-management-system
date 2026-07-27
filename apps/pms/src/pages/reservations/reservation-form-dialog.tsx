/* anchor: Linear settings form, diverge: reservation create/edit CONFIRMED matrix */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RESERVATION_GUEST_EMAIL_MAX,
  RESERVATION_GUEST_NAME_MAX,
  RESERVATION_GUEST_NAME_MIN,
  RESERVATION_GUEST_PHONE_MAX,
  RESERVATION_NOTES_MAX,
  ReservationSource,
  StayBillingPeriod,
  UnitAvailabilityBlockReason,
  isPlaceholderGuestName,
  isValidStayPeriodRange,
  periodCountFromRange,
  rackPriceForPeriod,
  suggestStayTotalIdr,
  type StaffReservation,
} from "@cabin/api-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyApiFieldError,
  createReservation,
  getUnitTypeRack,
  handleError,
  handleSuccess,
  syncReservationCaches,
  listAvailableUnits,
  staffUnitsAvailabilityQueryKey,
  staffUnitTypeRackQueryKey,
  updateReservation,
} from "@/lib/api";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { formatIdr, formatIdrInput } from "@/pages/properties/inventory-types";
import { isOtaLinkedStay } from "./ical-playbooks";
import { OtaRemindDialog } from "./ota-remind-dialog";
import { formatReservationSource, nightCount } from "./reservation-format";
import { StayDateRangePicker } from "./stay-date-range-picker";
import { ChosenUnitField } from "./chosen-unit-field";
import { chosenFromReservation, type ChosenUnit } from "./chosen-unit";
import { UnitInventoryPicker } from "./unit-inventory-picker";
import { findStaffUnitTypeRack } from "@/pages/properties/explorer-nav-state";

const SOURCE_OPTIONS = [
  ReservationSource.MANUAL,
  ReservationSource.BOOKING_COM,
  ReservationSource.AIRBNB,
  ReservationSource.AGODA,
  ReservationSource.WEBSITE,
] as const;

const schema = z
  .object({
    unitId: z.string().min(1, "Unit is required"),
    billingPeriod: z.enum([
      StayBillingPeriod.DAILY,
      StayBillingPeriod.MONTHLY,
      StayBillingPeriod.YEARLY,
    ]),
    checkInDate: z.string().min(1, "Check-in is required"),
    checkOutDate: z.string().min(1, "Check-out is required"),
    guestName: z
      .string()
      .trim()
      .min(RESERVATION_GUEST_NAME_MIN, "Guest name is required")
      .max(RESERVATION_GUEST_NAME_MAX)
      .refine((name) => !isPlaceholderGuestName(name), {
        message: "Replace the iCal placeholder with the real guest name",
      }),
    guestEmail: z.union([
      z.literal(""),
      z.string().trim().email("Invalid email").max(RESERVATION_GUEST_EMAIL_MAX),
    ]),
    guestPhone: z.union([
      z.literal(""),
      z.string().trim().max(RESERVATION_GUEST_PHONE_MAX),
    ]),
    guestCount: z.coerce.number().int().min(1, "At least 1 guest"),
    source: z.enum([
      ReservationSource.MANUAL,
      ReservationSource.WEBSITE,
      ReservationSource.BOOKING_COM,
      ReservationSource.AIRBNB,
      ReservationSource.AGODA,
    ]),
    totalDigits: z.string().min(1, "Total is required"),
    paidDigits: z.string(),
    notes: z.union([
      z.literal(""),
      z.string().trim().max(RESERVATION_NOTES_MAX),
    ]),
  })
  .superRefine((values, ctx) => {
    if (values.checkOutDate <= values.checkInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "Check-out must be after check-in",
      });
    } else if (
      !isValidStayPeriodRange(
        values.billingPeriod,
        values.checkInDate,
        values.checkOutDate,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message:
          "Check-out must match a full daily, monthly, or yearly period from check-in",
      });
    }
    if (!values.guestEmail && !values.guestPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["guestPhone"],
        message: "Phone or email is required",
      });
    }
    const total = Number(values.totalDigits || "0");
    const paid = Number(values.paidDigits || "0");
    if (!Number.isFinite(total) || total < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["totalDigits"],
        message: "Enter a valid total",
      });
    }
    if (!Number.isFinite(paid) || paid < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["paidDigits"],
        message: "Enter a valid paid amount",
      });
    }
    // paid > total is allowed (overpay / pending refund after shrink).
  });

type FormValues = z.infer<typeof schema>;

function emptyFormValues(): FormValues {
  return {
    unitId: "",
    billingPeriod: StayBillingPeriod.DAILY,
    checkInDate: "",
    checkOutDate: "",
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    guestCount: 1,
    source: ReservationSource.MANUAL,
    totalDigits: "",
    paidDigits: "0",
    notes: "",
  };
}

type ReservationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: StaffReservation | null;
  /** Board property filter — picker starts at unit types when creating. */
  initialPropertyId?: string;
  initialPropertyName?: string;
  /** Create from calendar cell — unit already chosen; skip Choose unit. */
  initialChosen?: ChosenUnit | null;
  initialCheckInDate?: string;
  initialCheckOutDate?: string;
  /**
   * When creating without a locked unit,
   * open Choose unit immediately after the dialog mounts.
   */
  autoOpenUnitPicker?: boolean;
  /** Called after successful create with the new id (for navigate). */
  onCreated?: (id: string) => void;
  /** Opened from Confirm when details are incomplete. */
  intent?: "edit" | "confirm-enrich" | "create";
  /** Called after a successful save (create or update). */
  onSaved?: (saved: StaffReservation) => void;
};

export function ReservationFormDialog({
  open,
  onOpenChange,
  reservation = null,
  initialPropertyId = "",
  initialPropertyName = "",
  initialChosen = null,
  initialCheckInDate = "",
  initialCheckOutDate = "",
  autoOpenUnitPicker = false,
  onCreated,
  intent = "edit",
  onSaved,
}: ReservationFormDialogProps) {
  const isEdit = Boolean(reservation);
  const isConfirmEnrich = intent === "confirm-enrich";
  const queryClient = useQueryClient();
  const sourceLocked = isEdit && Boolean(reservation?.externalRef);
  const [pickerOpen, setPickerOpen] = useState(() =>
    Boolean(autoOpenUnitPicker && !reservation && !initialChosen),
  );
  const [otaRemindOpen, setOtaRemindOpen] = useState(false);
  /** `undefined` = fall back to reservation / initialChosen; `null` = cleared; else user pick. */
  const [picked, setPicked] = useState<ChosenUnit | null | undefined>(
    undefined,
  );
  const chosen =
    picked !== undefined
      ? picked
      : reservation
        ? chosenFromReservation(reservation)
        : initialChosen;
  /** Last full suggest key we applied (or seeded on edit when stay unchanged). */
  const appliedSuggestKeyRef = useRef<string | null>(null);
  /**
   * Edit open: stay fingerprint at reset (`unitTypeId:billingPeriod:periodCount`).
   * Used so a late rack load does not lock Total after staff already changed stay.
   */
  const editOpenStayKeyRef = useRef<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      unitId: initialChosen?.unitId ?? "",
      billingPeriod: StayBillingPeriod.DAILY,
      checkInDate: initialCheckInDate,
      checkOutDate: initialCheckOutDate,
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      guestCount: 1,
      source: ReservationSource.MANUAL,
      totalDigits: "",
      paidDigits: "0",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      appliedSuggestKeyRef.current = null;
      editOpenStayKeyRef.current = null;
      return;
    }
    if (reservation) {
      const openCount =
        periodCountFromRange(
          reservation.billingPeriod,
          reservation.checkInDate,
          reservation.checkOutDate,
        ) ?? 0;
      editOpenStayKeyRef.current = `${reservation.unitTypeId}:${reservation.billingPeriod}:${openCount}`;
      appliedSuggestKeyRef.current = null;
      form.reset({
        unitId: reservation.unitId,
        billingPeriod: reservation.billingPeriod,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail ?? "",
        guestPhone: reservation.guestPhone ?? "",
        guestCount: reservation.guestCount ?? 1,
        source: reservation.source,
        totalDigits:
          reservation.totalAmountIdr != null
            ? String(reservation.totalAmountIdr)
            : "",
        paidDigits: String(reservation.paidAmountIdr),
        notes: reservation.notes ?? "",
      });
      return;
    }
    editOpenStayKeyRef.current = null;
    appliedSuggestKeyRef.current = null;
    if (initialChosen) {
      form.reset({
        unitId: initialChosen.unitId,
        billingPeriod: StayBillingPeriod.DAILY,
        checkInDate: initialCheckInDate,
        checkOutDate: initialCheckOutDate,
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        guestCount: 1,
        source: ReservationSource.MANUAL,
        totalDigits: "",
        paidDigits: "0",
        notes: "",
      });
      return;
    }
    form.reset({
      unitId: "",
      billingPeriod: StayBillingPeriod.DAILY,
      checkInDate: initialCheckInDate,
      checkOutDate: initialCheckOutDate,
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      guestCount: 1,
      source: ReservationSource.MANUAL,
      totalDigits: "",
      paidDigits: "0",
      notes: "",
    });
  }, [
    open,
    reservation,
    form,
    initialChosen,
    initialCheckInDate,
    initialCheckOutDate,
  ]);

  const checkInDate = useWatch({ control: form.control, name: "checkInDate" });
  const checkOutDate = useWatch({
    control: form.control,
    name: "checkOutDate",
  });
  const billingPeriod = useWatch({
    control: form.control,
    name: "billingPeriod",
  });
  const totalDigits = useWatch({ control: form.control, name: "totalDigits" });
  const paidDigits = useWatch({ control: form.control, name: "paidDigits" });
  const periodCount =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? (periodCountFromRange(billingPeriod, checkInDate, checkOutDate) ?? 0)
      : 0;
  const nights =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? nightCount(checkInDate, checkOutDate)
      : 0;
  const totalAmount = totalDigits === "" ? null : Number(totalDigits || "0");
  const paidAmount = Number(paidDigits || "0");
  const refundAmount =
    totalAmount != null &&
    Number.isFinite(totalAmount) &&
    Number.isFinite(paidAmount)
      ? Math.max(paidAmount - totalAmount, 0)
      : 0;

  const unitTypeId = chosen?.unitTypeId ?? "";
  const rackFromChosen =
    chosen?.defaultPriceIdr != null &&
    chosen.monthlyPriceIdr != null &&
    chosen.yearlyPriceIdr != null
      ? {
          id: unitTypeId,
          defaultPriceIdr: chosen.defaultPriceIdr,
          monthlyPriceIdr: chosen.monthlyPriceIdr,
          yearlyPriceIdr: chosen.yearlyPriceIdr,
        }
      : undefined;
  const rackFromCache =
    rackFromChosen == null && unitTypeId
      ? findStaffUnitTypeRack(queryClient, unitTypeId)
      : undefined;

  const rackQuery = useQuery({
    queryKey: staffUnitTypeRackQueryKey(unitTypeId),
    queryFn: () => getUnitTypeRack(unitTypeId),
    enabled:
      open &&
      Boolean(unitTypeId) &&
      rackFromChosen == null &&
      rackFromCache == null,
  });

  const datesReady =
    Boolean(checkInDate) && Boolean(checkOutDate) && checkOutDate > checkInDate;

  /** 2a: when stay dates change, re-check the chosen unit against availability. */
  const unitAvailabilityQuery = useQuery({
    queryKey: staffUnitsAvailabilityQueryKey(chosen?.propertyId ?? "", {
      checkInDate,
      checkOutDate,
      unitTypeId: chosen?.unitTypeId,
      ...(reservation?.id ? { excludeReservationId: reservation.id } : {}),
    }),
    queryFn: () =>
      listAvailableUnits(chosen!.propertyId, {
        checkInDate,
        checkOutDate,
        unitTypeId: chosen!.unitTypeId,
        ...(reservation?.id ? { excludeReservationId: reservation.id } : {}),
      }),
    enabled:
      open &&
      !pickerOpen &&
      Boolean(chosen?.propertyId) &&
      Boolean(chosen?.unitTypeId) &&
      Boolean(chosen?.unitId) &&
      datesReady,
    staleTime: 0,
  });

  /** Last hard-block key we already cleared for (avoid toast loops). */
  const clearedUnitKeyRef = useRef<string | null>(null);

  /** Soft conflict: keep unit, highlight stay dates until range is free. */
  const dateOverlapConflict = useMemo(() => {
    if (!chosen || !datesReady || !unitAvailabilityQuery.isSuccess) {
      return false;
    }
    const row = unitAvailabilityQuery.data.find((u) => u.id === chosen.unitId);
    return (
      Boolean(row) &&
      !row!.available &&
      row!.blockReason === UnitAvailabilityBlockReason.DATE_OVERLAP
    );
  }, [
    chosen,
    datesReady,
    unitAvailabilityQuery.isSuccess,
    unitAvailabilityQuery.data,
  ]);

  const dateOverlapError = dateOverlapConflict
    ? {
        message:
          "These dates overlap a booking on this unit — change dates or choose another unit.",
      }
    : undefined;

  useEffect(() => {
    if (!open || !chosen || !unitAvailabilityQuery.isSuccess) {
      return;
    }
    const row = unitAvailabilityQuery.data.find((u) => u.id === chosen.unitId);
    if (!row || row.available) {
      return;
    }
    // Soft date conflict — keep unit; field error via dateOverlapConflict.
    if (row.blockReason === UnitAvailabilityBlockReason.DATE_OVERLAP) {
      return;
    }
    const key = `${chosen.unitId}:${checkInDate}:${checkOutDate}:${row.blockReason}`;
    if (clearedUnitKeyRef.current === key) {
      return;
    }
    clearedUnitKeyRef.current = key;
    setPicked(null);
    form.setValue("unitId", "", { shouldDirty: true, shouldValidate: true });
    handleError(
      new Error("That unit isn’t bookable for these dates — choose another."),
    );
  }, [
    open,
    chosen,
    checkInDate,
    checkOutDate,
    unitAvailabilityQuery.isSuccess,
    unitAvailabilityQuery.data,
    form,
  ]);
  const rack =
    rackFromChosen ?? rackFromCache ?? rackQuery.data ?? undefined;
  const rackPriceIdr =
    rack != null ? rackPriceForPeriod(billingPeriod, rack) : undefined;
  const suggestedTotal =
    rackPriceIdr != null && periodCount >= 1
      ? suggestStayTotalIdr(periodCount, rackPriceIdr)
      : null;
  const suggestKey =
    chosen && suggestedTotal != null && rackPriceIdr != null
      ? `${chosen.unitTypeId}:${billingPeriod}:${periodCount}:${rackPriceIdr}`
      : null;

  useEffect(() => {
    if (!open || suggestKey == null || suggestedTotal == null) {
      return;
    }

    const applySuggested = () => {
      // Total only — Paid stays (shrink → Refund; extend → Due).
      form.setValue("totalDigits", String(suggestedTotal), {
        shouldDirty: true,
        shouldValidate: true,
      });
    };

    const stayKey =
      chosen != null && periodCount >= 1
        ? `${chosen.unitTypeId}:${billingPeriod}:${periodCount}`
        : null;

    // Edit: first rack/suggest after open — keep saved Total only if stay
    // still matches the reservation; otherwise staff changed stay while rack
    // was loading and Total must catch up.
    if (
      reservation &&
      appliedSuggestKeyRef.current === null &&
      editOpenStayKeyRef.current != null &&
      stayKey != null
    ) {
      if (stayKey === editOpenStayKeyRef.current) {
        appliedSuggestKeyRef.current = suggestKey;
        return;
      }
      applySuggested();
      appliedSuggestKeyRef.current = suggestKey;
      return;
    }

    if (appliedSuggestKeyRef.current === null) {
      applySuggested();
      appliedSuggestKeyRef.current = suggestKey;
      return;
    }

    if (appliedSuggestKeyRef.current === suggestKey) {
      return;
    }
    applySuggested();
    appliedSuggestKeyRef.current = suggestKey;
  }, [
    open,
    suggestKey,
    suggestedTotal,
    reservation,
    form,
    chosen,
    billingPeriod,
    periodCount,
  ]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPicked(undefined);
      setPickerOpen(false);
    }
    onOpenChange(next);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!chosen || chosen.unitId !== values.unitId) {
        throw new Error("Choose a unit");
      }
      const total = Number(values.totalDigits);
      const paid = Number(values.paidDigits || "0");

      if (reservation) {
        return updateReservation(reservation.id, {
          unitId: chosen.unitId,
          unitTypeId: chosen.unitTypeId,
          billingPeriod: values.billingPeriod,
          checkInDate: values.checkInDate,
          checkOutDate: values.checkOutDate,
          guestName: values.guestName,
          guestEmail: values.guestEmail || null,
          guestPhone: values.guestPhone || null,
          guestCount: values.guestCount,
          source: values.source,
          totalAmountIdr: total,
          notes: values.notes || null,
        });
      }

      return createReservation({
        propertyId: chosen.propertyId,
        unitId: chosen.unitId,
        unitTypeId: chosen.unitTypeId,
        source: values.source,
        billingPeriod: values.billingPeriod,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        guestName: values.guestName,
        guestEmail: values.guestEmail || null,
        guestPhone: values.guestPhone || null,
        guestCount: values.guestCount,
        notes: values.notes || null,
        totalAmountIdr: total,
        depositAmountIdr: paid,
      });
    },
    onSuccess: (saved) => {
      appliedSuggestKeyRef.current = null;
      editOpenStayKeyRef.current = null;
      const prev = reservation;
      const occupancyChanged =
        prev == null ||
        prev.unitId !== saved.unitId ||
        prev.checkInDate !== saved.checkInDate ||
        prev.checkOutDate !== saved.checkOutDate;
      const remindOta =
        isEdit &&
        prev != null &&
        isOtaLinkedStay(prev) &&
        occupancyChanged &&
        (prev.unitId !== saved.unitId ||
          prev.checkInDate !== saved.checkInDate ||
          prev.checkOutDate !== saved.checkOutDate);
      form.reset(emptyFormValues());
      setPicked(null);
      setPickerOpen(false);
      syncReservationCaches(queryClient, saved, { occupancyChanged });
      handleSuccess(
        isConfirmEnrich
          ? "Details saved"
          : isEdit
            ? "Reservation updated"
            : "Reservation created",
      );
      onOpenChange(false);
      if (!isEdit) {
        onCreated?.(saved.id);
      }
      onSaved?.(saved);
      if (remindOta) {
        setOtaRemindOpen(true);
      }
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  const title = isConfirmEnrich
    ? "Complete details to confirm"
    : isEdit
      ? "Edit reservation"
      : "New reservation";

  const description = isConfirmEnrich
    ? "Fill guest contact, guest count, and stay total — then save to confirm."
    : isEdit
      ? "Update stay, guest, or quote. Money in/out stays on Collect or Refund."
      : "Walk-in / manual stay. Choose unit and dates, then guest and money.";

  return (
    <>
      <ResponsiveFormShell
        open={open && !pickerOpen}
        onOpenChange={(next) => {
          if (pickerOpen) {
            return;
          }
          handleOpenChange(next);
        }}
        title={title}
        description={description}
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reservation-form"
              disabled={
                saveMutation.isPending ||
                (!isEdit && !chosen) ||
                dateOverlapConflict
              }
            >
              {saveMutation.isPending
                ? "Saving…"
                : isConfirmEnrich
                  ? "Save & confirm"
                  : isEdit
                    ? "Save changes"
                    : "Create"}
            </Button>
          </>
        }
      >
        <form
          id="reservation-form"
          className="flex flex-col gap-5"
          onSubmit={onSubmit}
        >
          <FieldGroup className="gap-4">
            <p className="text-sm font-medium text-foreground">Stay</p>
            <ChosenUnitField
              chosen={chosen}
              onChoose={() => {
                setPickerOpen(true);
              }}
              invalid={Boolean(form.formState.errors.unitId)}
              error={form.formState.errors.unitId}
              unitIdInputProps={form.register("unitId")}
            />

            <Field
              data-invalid={Boolean(
                form.formState.errors.checkInDate ||
                form.formState.errors.checkOutDate ||
                dateOverlapConflict,
              )}
            >
              <FieldLabel htmlFor="stay-dates">Stay</FieldLabel>
              <StayDateRangePicker
                id="stay-dates"
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                billingPeriod={billingPeriod}
                onBillingPeriodChange={(next) => {
                  form.setValue("billingPeriod", next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                unitId={chosen?.unitId}
                excludeReservationId={reservation?.id}
                invalid={Boolean(
                  form.formState.errors.checkInDate ||
                  form.formState.errors.checkOutDate ||
                  dateOverlapConflict,
                )}
                onChange={({ checkInDate, checkOutDate }) => {
                  const complete = Boolean(checkInDate && checkOutDate);
                  form.setValue("checkInDate", checkInDate, {
                    shouldDirty: true,
                    shouldValidate: complete,
                  });
                  form.setValue("checkOutDate", checkOutDate, {
                    shouldDirty: true,
                    shouldValidate: complete,
                  });
                }}
              />
              <FieldError
                errors={[
                  form.formState.errors.checkInDate,
                  form.formState.errors.checkOutDate,
                  dateOverlapError,
                ]}
              />
            </Field>
          </FieldGroup>

          <FieldGroup className="gap-4">
            <p className="text-sm font-medium text-foreground">Guest</p>
            <Controller
              control={form.control}
              name="guestName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="guest-name">Guest name</FieldLabel>
                  <Input
                    id="guest-name"
                    autoComplete="name"
                    autoFocus={isConfirmEnrich}
                    placeholder="Full name"
                    maxLength={RESERVATION_GUEST_NAME_MAX}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="guestPhone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="guest-phone">Phone</FieldLabel>
                    <Input
                      id="guest-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="08…"
                      maxLength={RESERVATION_GUEST_PHONE_MAX}
                      aria-invalid={fieldState.invalid}
                      {...field}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="guestEmail"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="guest-email">Email</FieldLabel>
                    <Input
                      id="guest-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Optional if phone set"
                      maxLength={RESERVATION_GUEST_EMAIL_MAX}
                      aria-invalid={fieldState.invalid}
                      {...field}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Phone or email required — phone first is fine for walk-ins.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="guestCount"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="guest-count">Guests</FieldLabel>
                    <Input
                      id="guest-count"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="1"
                      aria-invalid={fieldState.invalid}
                      value={field.value}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          field.onChange("");
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isFinite(n)) {
                          return;
                        }
                        field.onChange(Math.max(1, Math.floor(n)));
                      }}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="source"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Source</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={sourceLocked}
                    >
                      <SelectTrigger aria-invalid={fieldState.invalid}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {SOURCE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {formatReservationSource(s)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {sourceLocked ? (
                      <p className="text-xs text-muted-foreground">
                        Channel is locked while this stay is linked to an OTA
                        calendar UID.
                      </p>
                    ) : null}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <FieldGroup className="gap-4">
            <p className="text-sm font-medium text-foreground">Money</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="totalDigits"
                render={({ field, fieldState }) => {
                  const currentTotal =
                    field.value === "" ? null : Number(field.value || "0");
                  const divergedFromSuggest =
                    suggestedTotal != null &&
                    currentTotal != null &&
                    Number.isFinite(currentTotal) &&
                    currentTotal !== suggestedTotal;

                  return (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="stay-total">Total (IDR)</FieldLabel>
                      <IdrAmountInput
                        id="stay-total"
                        placeholder={
                          suggestedTotal != null
                            ? formatIdrInput(String(suggestedTotal))
                            : "0"
                        }
                        aria-invalid={fieldState.invalid}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      {suggestedTotal != null &&
                        rackPriceIdr != null &&
                        periodCount >= 1 && (
                        <p className="text-xs text-muted-foreground">
                          {periodCount}{" "}
                          {billingPeriod === StayBillingPeriod.MONTHLY
                            ? periodCount === 1
                              ? "month"
                              : "months"
                            : billingPeriod === StayBillingPeriod.YEARLY
                              ? periodCount === 1
                                ? "year"
                                : "years"
                              : periodCount === 1
                                ? "night"
                                : "nights"}{" "}
                          × {formatIdr(rackPriceIdr)}/
                          {billingPeriod === StayBillingPeriod.MONTHLY
                            ? "month"
                            : billingPeriod === StayBillingPeriod.YEARLY
                              ? "year"
                              : "night"}{" "}
                          = {formatIdr(suggestedTotal)}
                          {nights > 0 &&
                          billingPeriod !== StayBillingPeriod.DAILY
                            ? ` · ${nights} nights`
                            : null}
                          {divergedFromSuggest ? (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="underline underline-offset-2 hover:text-foreground"
                                onClick={() => {
                                  form.setValue(
                                    "totalDigits",
                                    String(suggestedTotal),
                                    {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    },
                                  );
                                }}
                              >
                                Use suggested
                              </button>
                            </>
                          ) : null}
                        </p>
                      )}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  );
                }}
              />
              <Controller
                control={form.control}
                name="paidDigits"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="stay-deposit">
                      {isEdit ? "Paid (IDR)" : "Deposit now (IDR)"}
                    </FieldLabel>
                    <IdrAmountInput
                      id="stay-deposit"
                      placeholder="0"
                      disabled={isEdit}
                      aria-invalid={fieldState.invalid}
                      value={field.value}
                      onValueChange={(digits) => {
                        if (isEdit) {
                          return;
                        }
                        field.onChange(digits);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                    {isEdit ? (
                      <p className="text-xs text-muted-foreground">
                        Use Collect or Refund on the reservation for money in or
                        out.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Optional opening deposit. Leave 0 if paying later.
                      </p>
                    )}
                    {refundAmount > 0 ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Refund {formatIdr(refundAmount)} — Paid is above Total.
                        Save the quote, then use Refund to return the excess.
                      </p>
                    ) : null}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <FieldGroup>
            <Controller
              control={form.control}
              name="notes"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="stay-notes">Notes</FieldLabel>
                  <Textarea
                    id="stay-notes"
                    rows={2}
                    maxLength={RESERVATION_NOTES_MAX}
                    placeholder="Optional — special requests, channel ref…"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </ResponsiveFormShell>
      {pickerOpen ? (
        <UnitInventoryPicker
          open
          onOpenChange={setPickerOpen}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          initialPropertyId={chosen?.propertyId ?? initialPropertyId}
          initialPropertyName={chosen?.propertyName ?? initialPropertyName}
          initialUnitTypeId={chosen?.unitTypeId ?? ""}
          initialUnitTypeName={chosen?.unitTypeName ?? ""}
          initialUnitId={chosen?.unitId ?? ""}
          excludeReservationId={reservation?.id}
          onConfirm={(next) => {
            clearedUnitKeyRef.current = null;
            setPicked(next);
            form.setValue("unitId", next.unitId, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
      ) : null}

      <OtaRemindDialog
        open={otaRemindOpen}
        onOpenChange={setOtaRemindOpen}
        source={reservation?.source ?? ReservationSource.BOOKING_COM}
        reason="dates-or-unit"
      />
    </>
  );
}

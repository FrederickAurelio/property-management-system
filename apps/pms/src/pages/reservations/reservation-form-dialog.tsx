/* anchor: Linear settings form, diverge: FieldSet Stay/Guest/Money/Notes + Separators */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { TFunction } from "i18next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  applyApiFieldError,
  createReservation,
  getUnitTypeRack,
  handleError,
  handleSuccess,
  syncReservationCaches,
  listAvailableUnits,
  listPropertyOptions,
  staffPropertiesOptionsQueryKey,
  staffUnitsAvailabilityQueryKey,
  staffUnitTypeRackQueryKey,
  updateReservation,
} from "@/lib/api";
import { opsTodayYmd, resolvePropertyTimezone } from "@/lib/ops-date";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { useOtaRemindDialog } from "@/hooks/use-ota-remind-dialog";
import { formatIdr, formatIdrInput } from "@/pages/properties/inventory-types";
import { isOtaLinkedStay } from "@/lib/ota-channels";
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

function createReservationSchema(t: TFunction) {
  return z
    .object({
      unitId: z.string().min(1, t("reservations:formDialog.zod.unitRequired")),
      billingPeriod: z.enum([
        StayBillingPeriod.DAILY,
        StayBillingPeriod.MONTHLY,
        StayBillingPeriod.YEARLY,
      ]),
      checkInDate: z
        .string()
        .min(1, t("reservations:formDialog.zod.checkInRequired")),
      checkOutDate: z
        .string()
        .min(1, t("reservations:formDialog.zod.checkOutRequired")),
      guestName: z
        .string()
        .trim()
        .min(
          RESERVATION_GUEST_NAME_MIN,
          t("reservations:formDialog.zod.guestNameRequired"),
        )
        .max(RESERVATION_GUEST_NAME_MAX)
        .refine((name) => !isPlaceholderGuestName(name), {
          message: t("reservations:formDialog.zod.guestNamePlaceholderError"),
        }),
      guestEmail: z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .email(t("reservations:formDialog.zod.invalidEmail"))
          .max(RESERVATION_GUEST_EMAIL_MAX),
      ]),
      guestPhone: z.union([
        z.literal(""),
        z.string().trim().max(RESERVATION_GUEST_PHONE_MAX),
      ]),
      guestCount: z.coerce
        .number()
        .int()
        .min(1, t("reservations:formDialog.zod.atLeastOneGuest")),
      source: z.enum([
        ReservationSource.MANUAL,
        ReservationSource.WEBSITE,
        ReservationSource.BOOKING_COM,
        ReservationSource.AIRBNB,
        ReservationSource.AGODA,
      ]),
      rentDigits: z
        .string()
        .min(1, t("reservations:formDialog.zod.totalRequired")),
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
          message: t("reservations:formDialog.zod.checkOutAfterCheckIn"),
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
          message: t("reservations:formDialog.zod.invalidPeriodRange"),
        });
      }
      if (!values.guestEmail && !values.guestPhone) {
        ctx.addIssue({
          code: "custom",
          path: ["guestPhone"],
          message: t("reservations:formDialog.zod.contactRequired"),
        });
      }
      const total = Number(values.rentDigits || "0");
      const paid = Number(values.paidDigits || "0");
      if (!Number.isFinite(total) || total < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rentDigits"],
          message: t("reservations:formDialog.zod.invalidTotal"),
        });
      }
      if (!Number.isFinite(paid) || paid < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["paidDigits"],
          message: t("reservations:formDialog.zod.invalidPaid"),
        });
      }
      // paid > total is allowed (credit / utilities deposit until checkout).
    });
}

type FormValues = z.infer<ReturnType<typeof createReservationSchema>>;

function periodUnitLabel(
  t: TFunction,
  billingPeriod: StayBillingPeriod,
  count: number,
): string {
  if (billingPeriod === StayBillingPeriod.MONTHLY) {
    return t("reservations:format.units.month", { count });
  }
  if (billingPeriod === StayBillingPeriod.YEARLY) {
    return t("reservations:format.units.year", { count });
  }
  return t("reservations:format.units.night", { count });
}

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
    rentDigits: "",
    paidDigits: "0",
    notes: "",
  };
}

function formValuesFromOpen(args: {
  reservation: StaffReservation | null;
  initialChosen: ChosenUnit | null;
  initialCheckInDate: string;
  initialCheckOutDate: string;
}): FormValues {
  const {
    reservation,
    initialChosen,
    initialCheckInDate,
    initialCheckOutDate,
  } = args;
  if (reservation) {
    return {
      unitId: reservation.unitId,
      billingPeriod: reservation.billingPeriod,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail ?? "",
      guestPhone: reservation.guestPhone ?? "",
      guestCount: reservation.guestCount ?? 1,
      source: reservation.source,
      rentDigits:
        reservation.rentAmountIdr != null
          ? String(reservation.rentAmountIdr)
          : reservation.totalAmountIdr != null
            ? String(reservation.totalAmountIdr)
            : "",
      paidDigits: String(reservation.paidAmountIdr),
      notes: reservation.notes ?? "",
    };
  }
  if (initialChosen) {
    return {
      unitId: initialChosen.unitId,
      billingPeriod: StayBillingPeriod.DAILY,
      checkInDate: initialCheckInDate,
      checkOutDate: initialCheckOutDate,
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      guestCount: 1,
      source: ReservationSource.MANUAL,
      rentDigits: "",
      paidDigits: "0",
      notes: "",
    };
  }
  return {
    unitId: "",
    billingPeriod: StayBillingPeriod.DAILY,
    checkInDate: initialCheckInDate,
    checkOutDate: initialCheckOutDate,
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    guestCount: 1,
    source: ReservationSource.MANUAL,
    rentDigits: "",
    paidDigits: "0",
    notes: "",
  };
}

function editStayKeyFromReservation(
  reservation: StaffReservation | null,
): string | null {
  if (!reservation) {
    return null;
  }
  const openCount =
    periodCountFromRange(
      reservation.billingPeriod,
      reservation.checkInDate,
      reservation.checkOutDate,
    ) ?? 0;
  return `${reservation.unitTypeId}:${reservation.billingPeriod}:${openCount}`;
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
  const { t } = useTranslation(["reservations", "common"]);
  const schema = useMemo(() => createReservationSchema(t), [t]);
  const isEdit = Boolean(reservation);
  const isConfirmEnrich = intent === "confirm-enrich";
  const queryClient = useQueryClient();
  const sourceLocked = isEdit && Boolean(reservation?.externalRef);
  const [pickerOpen, setPickerOpen] = useState(() =>
    Boolean(autoOpenUnitPicker && !reservation && !initialChosen),
  );
  const [stayDatesOpen, setStayDatesOpen] = useState(false);
  /** Run after staff dismisses an OTA remind (keeps form open until then). */
  const afterOtaRemindRef = useRef<(() => void) | null>(null);
  const { showRefreshImports, showSourceRemind, remindDialog } =
    useOtaRemindDialog({
      onDismissed: () => {
        afterOtaRemindRef.current?.();
        afterOtaRemindRef.current = null;
      },
    });
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

  const propertyOptionsQuery = useQuery({
    queryKey: staffPropertiesOptionsQueryKey(),
    queryFn: listPropertyOptions,
    enabled: open,
  });

  const propertyTimezone = useMemo(() => {
    if (reservation) {
      return reservation.propertyTimezone;
    }
    const pid = chosen?.propertyId ?? initialPropertyId;
    if (!pid) {
      return undefined;
    }
    return resolvePropertyTimezone(propertyOptionsQuery.data ?? [], pid);
  }, [reservation, chosen, initialPropertyId, propertyOptionsQuery.data]);

  const opsToday = useMemo(
    () => opsTodayYmd(propertyTimezone),
    [propertyTimezone],
  );

  /** Last full suggest key we applied (or seeded on edit when stay unchanged). */
  const appliedSuggestKeyRef = useRef<string | null>(null);
  /**
   * Edit open: stay fingerprint at mount (`unitTypeId:billingPeriod:periodCount`).
   * Used so a late rack load does not lock Total after staff already changed stay.
   */
  const editOpenStayKeyRef = useRef<string | null>(
    editStayKeyFromReservation(reservation),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: formValuesFromOpen({
      reservation,
      initialChosen,
      initialCheckInDate,
      initialCheckOutDate,
    }),
  });

  const checkInDate = useWatch({ control: form.control, name: "checkInDate" });
  const checkOutDate = useWatch({
    control: form.control,
    name: "checkOutDate",
  });
  const billingPeriod = useWatch({
    control: form.control,
    name: "billingPeriod",
  });
  const rentDigits = useWatch({ control: form.control, name: "rentDigits" });
  const paidDigits = useWatch({ control: form.control, name: "paidDigits" });
  const periodCount =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? (periodCountFromRange(billingPeriod, checkInDate, checkOutDate) ?? 0)
      : 0;
  const nights =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? nightCount(checkInDate, checkOutDate)
      : 0;
  const rentAmount = rentDigits === "" ? null : Number(rentDigits || "0");
  // Edit: cash Total = rent field + existing utility denorms (utilities sheet owns those).
  // Create: no utilities yet → rent is the Total.
  const cashTotalAmount =
    rentAmount == null || !Number.isFinite(rentAmount)
      ? null
      : isEdit && reservation != null
        ? rentAmount +
          reservation.electricityAmountIdr +
          reservation.waterAmountIdr +
          reservation.maintenanceAmountIdr +
          reservation.adminAmountIdr
        : rentAmount;
  const paidAmount = Number(paidDigits || "0");
  const refundAmount =
    cashTotalAmount != null && Number.isFinite(paidAmount)
      ? Math.max(paidAmount - cashTotalAmount, 0)
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
      billingPeriod,
      unitTypeId: chosen?.unitTypeId,
      ...(reservation?.id ? { excludeReservationId: reservation.id } : {}),
    }),
    queryFn: () =>
      listAvailableUnits(chosen!.propertyId, {
        checkInDate,
        checkOutDate,
        billingPeriod,
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
    ? { message: t("reservations:formDialog.dateOverlapError") }
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
    handleError(new Error(t("reservations:formDialog.unitNotBookableError")));
  }, [
    open,
    chosen,
    checkInDate,
    checkOutDate,
    unitAvailabilityQuery.isSuccess,
    unitAvailabilityQuery.data,
    form,
    t,
  ]);
  const rack = rackFromChosen ?? rackFromCache ?? rackQuery.data ?? undefined;
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
    if (
      !open ||
      stayDatesOpen ||
      suggestKey == null ||
      suggestedTotal == null
    ) {
      return;
    }

    const applySuggested = () => {
      // Total only — Paid stays (shrink → Refund; extend → Due).
      form.setValue("rentDigits", String(suggestedTotal), {
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
    stayDatesOpen,
    suggestKey,
    suggestedTotal,
    reservation,
    form,
    chosen,
    billingPeriod,
    periodCount,
  ]);

  const handleStayDatesChange = useCallback(
    (next: { checkInDate: string; checkOutDate: string }) => {
      const complete = Boolean(next.checkInDate && next.checkOutDate);
      form.setValue("checkInDate", next.checkInDate, {
        shouldDirty: true,
        shouldValidate: complete,
      });
      form.setValue("checkOutDate", next.checkOutDate, {
        shouldDirty: true,
        shouldValidate: complete,
      });
    },
    [form],
  );

  const handleBillingPeriodChange = useCallback(
    (next: FormValues["billingPeriod"]) => {
      form.setValue("billingPeriod", next, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPicked(undefined);
      setPickerOpen(false);
      setStayDatesOpen(false);
    }
    onOpenChange(next);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!chosen || chosen.unitId !== values.unitId) {
        throw new Error(t("reservations:formDialog.zod.unitRequired"));
      }
      const total = Number(values.rentDigits);
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
          rentAmountIdr: total,
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
        rentAmountIdr: total,
        depositAmountIdr: paid,
      });
    },
    onSuccess: (saved) => {
      const prev = reservation;
      const occupancyChanged =
        prev == null ||
        prev.unitId !== saved.unitId ||
        prev.checkInDate !== saved.checkInDate ||
        prev.checkOutDate !== saved.checkOutDate ||
        prev.billingPeriod !== saved.billingPeriod;
      const remindOta =
        isEdit &&
        prev != null &&
        isOtaLinkedStay(prev) &&
        occupancyChanged &&
        (prev.unitId !== saved.unitId ||
          prev.checkInDate !== saved.checkInDate ||
          prev.checkOutDate !== saved.checkOutDate);
      // Stay-open (OTA / refresh remind): re-seed like the old open-reset Effect —
      // edit stay fingerprint from saved row + clear applied key so the suggest
      // Effect takes the "seed, don't overwrite Total" branch. Do not clear
      // editOpenStayKeyRef to null (that forced applySuggested over the saved Total).
      // Next open remounts and re-seeds via useRef / defaultValues.
      if (isEdit) {
        editOpenStayKeyRef.current = editStayKeyFromReservation(saved);
        appliedSuggestKeyRef.current = null;
      }
      syncReservationCaches(queryClient, saved, { occupancyChanged });
      handleSuccess(
        isConfirmEnrich
          ? t("reservations:formDialog.toastDetailsSaved")
          : isEdit
            ? t("reservations:formDialog.toastUpdated")
            : t("reservations:formDialog.toastCreated"),
      );

      const finish = () => {
        form.reset(emptyFormValues());
        // Edit/confirm: `undefined` so stay-mounted reopen falls back to reservation.
        // Create: `null` so we don't flash `initialChosen` while the shell is still open.
        setPicked(isEdit || isConfirmEnrich ? undefined : null);
        setPickerOpen(false);
        onOpenChange(false);
        if (!isEdit) {
          onCreated?.(saved.id);
        }
        onSaved?.(saved);
      };

      if (!isEdit && !isConfirmEnrich) {
        afterOtaRemindRef.current = finish;
        showRefreshImports({
          trigger: "walk-in",
          unitId: saved.unitId,
          bookingSource: saved.source,
        });
        return;
      }
      if (remindOta && prev) {
        afterOtaRemindRef.current = finish;
        showSourceRemind(prev.source, "dates-or-unit");
        return;
      }
      if (
        isEdit &&
        prev != null &&
        occupancyChanged &&
        !isOtaLinkedStay(prev)
      ) {
        afterOtaRemindRef.current = finish;
        showRefreshImports({
          trigger: "stay-update",
          unitId: saved.unitId,
          bookingSource: saved.source,
        });
        return;
      }

      finish();
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  const title = isConfirmEnrich
    ? t("reservations:formDialog.titleConfirmEnrich")
    : isEdit
      ? t("reservations:formDialog.titleEdit")
      : t("reservations:formDialog.titleCreate");

  const description = isConfirmEnrich
    ? t("reservations:formDialog.descriptionConfirmEnrich")
    : isEdit
      ? t("reservations:formDialog.descriptionEdit")
      : t("reservations:formDialog.descriptionCreate");

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
              {t("reservations:formDialog.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              form="reservation-form"
              disabled={
                saveMutation.isPending ||
                stayDatesOpen ||
                (!isEdit && !chosen) ||
                dateOverlapConflict
              }
            >
              {saveMutation.isPending
                ? t("reservations:formDialog.buttons.saving")
                : stayDatesOpen
                  ? t("reservations:formDialog.buttons.confirmDateFirst")
                  : isConfirmEnrich
                    ? t("reservations:formDialog.buttons.saveAndConfirm")
                    : isEdit
                      ? t("reservations:formDialog.buttons.saveChanges")
                      : t("reservations:formDialog.buttons.create")}
            </Button>
          </>
        }
      >
        <form
          id="reservation-form"
          className="flex flex-col gap-5"
          onSubmit={onSubmit}
        >
          <FieldSet className="gap-4">
            <FieldLegend variant="label">
              {t("reservations:formDialog.sections.stay")}
            </FieldLegend>
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
              <FieldLabel htmlFor="stay-dates">
                {t("reservations:formDialog.stayFieldLabel")}
              </FieldLabel>
              <StayDateRangePicker
                id="stay-dates"
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                billingPeriod={billingPeriod}
                onBillingPeriodChange={handleBillingPeriodChange}
                unitId={chosen?.unitId}
                excludeReservationId={reservation?.id}
                propertyTimezone={propertyTimezone}
                opsTodayYmd={opsToday}
                invalid={Boolean(
                  form.formState.errors.checkInDate ||
                  form.formState.errors.checkOutDate ||
                  dateOverlapConflict,
                )}
                onChange={handleStayDatesChange}
                onPanelOpenChange={setStayDatesOpen}
              />
              <FieldError
                errors={[
                  form.formState.errors.checkInDate,
                  form.formState.errors.checkOutDate,
                  dateOverlapError,
                ]}
              />
            </Field>
          </FieldSet>

          <Separator />

          <FieldSet className="gap-4">
            <FieldLegend variant="label">
              {t("reservations:formDialog.sections.guest")}
            </FieldLegend>
            <Controller
              control={form.control}
              name="guestName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="guest-name">
                    {t("reservations:formDialog.fields.guestName")}
                  </FieldLabel>
                  <Input
                    id="guest-name"
                    autoComplete="name"
                    autoFocus={isConfirmEnrich}
                    placeholder={t(
                      "reservations:formDialog.fields.guestNamePlaceholder",
                    )}
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
                    <FieldLabel htmlFor="guest-phone">
                      {t("reservations:formDialog.fields.phone")}
                    </FieldLabel>
                    <Input
                      id="guest-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={t(
                        "reservations:formDialog.fields.phonePlaceholder",
                      )}
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
                    <FieldLabel htmlFor="guest-email">
                      {t("reservations:formDialog.fields.email")}
                    </FieldLabel>
                    <Input
                      id="guest-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t(
                        "reservations:formDialog.fields.emailPlaceholder",
                      )}
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
              {t("reservations:formDialog.contactRequiredHint")}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="guestCount"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="guest-count">
                      {t("reservations:formDialog.fields.guests")}
                    </FieldLabel>
                    <Input
                      id="guest-count"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={t(
                        "reservations:formDialog.fields.guestsPlaceholder",
                      )}
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
                    <FieldLabel>
                      {t("reservations:formDialog.fields.source")}
                    </FieldLabel>
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
                        {t("reservations:formDialog.sourceLockedHint")}
                      </p>
                    ) : null}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldSet>

          <Separator />

          <FieldSet className="gap-4">
            <FieldLegend variant="label">
              {t("reservations:formDialog.sections.money")}
            </FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="rentDigits"
                render={({ field, fieldState }) => {
                  const currentTotal =
                    field.value === "" ? null : Number(field.value || "0");
                  const divergedFromSuggest =
                    suggestedTotal != null &&
                    currentTotal != null &&
                    Number.isFinite(currentTotal) &&
                    currentTotal !== suggestedTotal;
                  const unitLabel =
                    suggestedTotal != null
                      ? periodUnitLabel(t, billingPeriod, periodCount)
                      : "";

                  return (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="stay-total">
                        {t("reservations:formDialog.fields.totalIdr")}
                      </FieldLabel>
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
                            {t("reservations:formDialog.rackSuggestLine", {
                              count: periodCount,
                              unit: unitLabel,
                              price: formatIdr(rackPriceIdr),
                              total: formatIdr(suggestedTotal),
                            })}
                            {nights > 0 &&
                              billingPeriod !== StayBillingPeriod.DAILY &&
                              t(
                                "reservations:formDialog.rackSuggestNightsSuffix",
                                { count: nights },
                              )}
                            {divergedFromSuggest ? (
                              <>
                                {" · "}
                                <button
                                  type="button"
                                  className="underline underline-offset-2 hover:text-foreground"
                                  onClick={() => {
                                    form.setValue(
                                      "rentDigits",
                                      String(suggestedTotal),
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      },
                                    );
                                  }}
                                >
                                  {t("reservations:formDialog.useSuggested")}
                                </button>
                              </>
                            ) : null}
                          </p>
                        )}
                      <p className="text-xs text-muted-foreground">
                        {t("reservations:formDialog.fields.utilitiesHint")}
                      </p>
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
                      {isEdit
                        ? t("reservations:formDialog.fields.paidIdrEdit")
                        : t("reservations:formDialog.fields.paidIdrCreate")}
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
                        {t("reservations:formDialog.paidEditHint")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("reservations:formDialog.paidCreateHint")}
                      </p>
                    )}
                    {refundAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("reservations:formDialog.refundAbovePaidHint", {
                          amount: formatIdr(refundAmount),
                        })}
                      </p>
                    )}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldSet>

          <Separator />

          <FieldSet className="gap-4">
            <FieldLegend variant="label">
              {t("reservations:formDialog.sections.notes")}
            </FieldLegend>
            <Controller
              control={form.control}
              name="notes"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="stay-notes" className="sr-only">
                    {t("reservations:formDialog.fields.notes")}
                  </FieldLabel>
                  <Textarea
                    id="stay-notes"
                    rows={2}
                    maxLength={RESERVATION_NOTES_MAX}
                    placeholder={t(
                      "reservations:formDialog.fields.notesPlaceholder",
                    )}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldSet>
        </form>
      </ResponsiveFormShell>
      {pickerOpen ? (
        <UnitInventoryPicker
          open
          onOpenChange={setPickerOpen}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          billingPeriod={billingPeriod}
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

      {remindDialog}
    </>
  );
}

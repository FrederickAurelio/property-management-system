/* anchor: Linear settings form, diverge: reservation create/edit CONFIRMED matrix */
import { useEffect, useRef, useState } from "react";
import {
  RESERVATION_GUEST_EMAIL_MAX,
  RESERVATION_GUEST_NAME_MAX,
  RESERVATION_GUEST_NAME_MIN,
  RESERVATION_GUEST_PHONE_MAX,
  RESERVATION_NOTES_MAX,
  ReservationSource,
  isPlaceholderGuestName,
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
  getUnitType,
  handleError,
  handleSuccess,
  syncReservationCaches,
  listAvailableUnits,
  staffUnitsAvailabilityQueryKey,
  staffUnitTypeQueryKey,
  updateReservation,
} from "@/lib/api";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import {
  formatIdr,
  formatIdrInput,
} from "@/pages/properties/inventory-types";
import {
  formatReservationSource,
  nightCount,
} from "./reservation-format";
import { StayDateRangePicker } from "./stay-date-range-picker";
import {
  chosenFromReservation,
  formatChosenUnitLabel,
  type ChosenUnit,
} from "./chosen-unit";
import { UnitInventoryPicker } from "./unit-inventory-picker";

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

type ReservationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: StaffReservation | null;
  /** Board property filter — picker starts at unit types when creating. */
  initialPropertyId?: string;
  initialPropertyName?: string;
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
  onCreated,
  intent = "edit",
  onSaved,
}: ReservationFormDialogProps) {
  const isEdit = Boolean(reservation);
  const isConfirmEnrich = intent === "confirm-enrich";
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  /** `undefined` = fall back to reservation; `null` = cleared; else user pick. */
  const [picked, setPicked] = useState<ChosenUnit | null | undefined>(
    undefined,
  );
  const chosen =
    picked !== undefined
      ? picked
      : reservation
        ? chosenFromReservation(reservation)
        : null;
  /** Last unitTypeId:nights:rack we applied (or seeded on edit open). */
  const appliedSuggestKeyRef = useRef<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      unitId: "",
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
    },
  });

  useEffect(() => {
    if (!open) {
      appliedSuggestKeyRef.current = null;
      return;
    }
    if (reservation) {
      form.reset({
        unitId: reservation.unitId,
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
    form.reset({
      unitId: "",
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
    });
  }, [open, reservation, form]);

  const checkInDate = useWatch({ control: form.control, name: "checkInDate" });
  const checkOutDate = useWatch({
    control: form.control,
    name: "checkOutDate",
  });
  const totalDigits = useWatch({ control: form.control, name: "totalDigits" });
  const paidDigits = useWatch({ control: form.control, name: "paidDigits" });
  const nights =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? nightCount(checkInDate, checkOutDate)
      : 0;
  const totalAmount =
    totalDigits === "" ? null : Number(totalDigits || "0");
  const paidAmount = Number(paidDigits || "0");
  const refundAmount =
    totalAmount != null &&
    Number.isFinite(totalAmount) &&
    Number.isFinite(paidAmount)
      ? Math.max(paidAmount - totalAmount, 0)
      : 0;

  const unitTypeQuery = useQuery({
    queryKey: staffUnitTypeQueryKey(chosen?.unitTypeId ?? ""),
    queryFn: () => getUnitType(chosen!.unitTypeId),
    enabled: open && Boolean(chosen?.unitTypeId),
  });

  const datesReady =
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    checkOutDate > checkInDate;

  /** 2a: when stay dates change, re-check the chosen unit against availability. */
  const unitAvailabilityQuery = useQuery({
    queryKey: staffUnitsAvailabilityQueryKey(chosen?.propertyId ?? "", {
      checkInDate,
      checkOutDate,
      unitTypeId: chosen?.unitTypeId,
      ...(reservation?.id
        ? { excludeReservationId: reservation.id }
        : {}),
    }),
    queryFn: () =>
      listAvailableUnits(chosen!.propertyId, {
        checkInDate,
        checkOutDate,
        unitTypeId: chosen!.unitTypeId,
        ...(reservation?.id
          ? { excludeReservationId: reservation.id }
          : {}),
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

  /** Last availability key we already cleared for (avoid toast loops). */
  const clearedUnitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !chosen || !unitAvailabilityQuery.isSuccess) {
      return;
    }
    const row = unitAvailabilityQuery.data.find((u) => u.id === chosen.unitId);
    if (row?.available) {
      return;
    }
    const key = `${chosen.unitId}:${checkInDate}:${checkOutDate}`;
    if (clearedUnitKeyRef.current === key) {
      return;
    }
    clearedUnitKeyRef.current = key;
    setPicked(null);
    form.setValue("unitId", "", { shouldDirty: true, shouldValidate: true });
    handleError(
      new Error(
        "That unit isn’t free for these dates — choose another unit.",
      ),
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
  const rackPriceIdr = unitTypeQuery.data?.defaultPriceIdr;
  const suggestedTotal =
    rackPriceIdr != null && nights >= 1
      ? suggestStayTotalIdr(nights, rackPriceIdr)
      : null;
  const suggestKey =
    chosen && suggestedTotal != null && rackPriceIdr != null
      ? `${chosen.unitTypeId}:${nights}:${rackPriceIdr}`
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

    // Edit open: keep saved Total until nights / unit type change.
    if (appliedSuggestKeyRef.current === null) {
      if (reservation) {
        appliedSuggestKeyRef.current = suggestKey;
        return;
      }
      applySuggested();
      appliedSuggestKeyRef.current = suggestKey;
      return;
    }

    if (appliedSuggestKeyRef.current === suggestKey) {
      return;
    }
    applySuggested();
    appliedSuggestKeyRef.current = suggestKey;
  }, [open, suggestKey, suggestedTotal, reservation, form]);

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
      const occupancyChanged =
        reservation == null ||
        reservation.unitId !== saved.unitId ||
        reservation.checkInDate !== saved.checkInDate ||
        reservation.checkOutDate !== saved.checkOutDate;
      syncReservationCaches(queryClient, saved, { occupancyChanged });
      handleSuccess(
        isConfirmEnrich
          ? "Details saved"
          : isEdit
            ? "Reservation updated"
            : "Reservation created",
      );
      setPicked(undefined);
      setPickerOpen(false);
      onOpenChange(false);
      if (!isEdit) {
        onCreated?.(saved.id);
      }
      onSaved?.(saved);
    },
    onError: (error) => {
      if (applyApiFieldError(error, form.setError)) {
        return;
      }
      handleError(error);
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
            disabled={saveMutation.isPending || (!isEdit && !chosen)}
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
      <form id="reservation-form" className="flex flex-col gap-5" onSubmit={onSubmit}>
        <FieldGroup className="gap-4">
          <p className="text-sm font-medium text-foreground">Stay</p>
          <Field
            data-invalid={Boolean(form.formState.errors.unitId)}
          >
            <FieldLabel>Unit</FieldLabel>
            <div className="flex items-center gap-2">
              <div
                className={
                  chosen
                    ? "bg-muted/40 flex min-h-8 min-w-0 flex-1 items-center rounded-lg border px-2.5 text-sm"
                    : "bg-muted/40 text-muted-foreground flex min-h-8 min-w-0 flex-1 items-center rounded-lg border border-dashed px-2.5 text-sm"
                }
              >
                <span className="truncate">
                  {chosen ? formatChosenUnitLabel(chosen) : "No unit chosen"}
                </span>
              </div>
              <Button
                type="button"
                variant={chosen ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  setPickerOpen(true);
                }}
              >
                {chosen ? "Change" : "Choose"}
              </Button>
            </div>
            <input type="hidden" {...form.register("unitId")} />
            <FieldError errors={[form.formState.errors.unitId]} />
          </Field>

          <Field
            data-invalid={Boolean(
              form.formState.errors.checkInDate ||
                form.formState.errors.checkOutDate,
            )}
          >
            <FieldLabel htmlFor="stay-dates">Stay dates</FieldLabel>
            <StayDateRangePicker
              id="stay-dates"
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              unitId={chosen?.unitId}
              excludeReservationId={reservation?.id}
              invalid={Boolean(
                form.formState.errors.checkInDate ||
                  form.formState.errors.checkOutDate,
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
                    {suggestedTotal != null && rackPriceIdr != null && (
                      <p className="text-xs text-muted-foreground">
                        {nights} night{nights === 1 ? "" : "s"} ×{" "}
                        {formatIdr(rackPriceIdr)}
                        /night = {formatIdr(suggestedTotal)}
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
          setPicked(next);
          form.setValue("unitId", next.unitId, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }}
      />
    ) : null}
    </>
  );
}

/* anchor: Stripe cancel + refund, diverge: guest vs property money preview */
import { useMemo, useState } from "react";
import {
  RESERVATION_NOTES_MAX,
  type StaffReservation,
} from "@cabin/api-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  cancelReservation,
  handleError,
  handleSuccess,
  syncReservationCaches,
  type CancelDisposition,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatIdr } from "@/pages/properties/inventory-types";
import { isOtaLinkedStay } from "@/lib/ota-channels";
import { OtaRemindDialog } from "@/components/ota/ota-remind-dialog";
import { formatMoneyOrDash } from "./reservation-format";

type FormValues = {
  disposition: "full_refund" | "keep" | "partial";
  /** Amount returned to the guest (not “paid remaining”). */
  refundToGuestDigits: string;
  notes: string;
};

function emptyFormValues(): FormValues {
  return {
    disposition: "keep",
    refundToGuestDigits: "",
    notes: "",
  };
}

function cancelDefaults(reservation: StaffReservation): FormValues {
  return {
    disposition: "keep",
    refundToGuestDigits: "",
    notes: reservation.notes ?? "",
  };
}

function createCancelSchema(t: TFunction, hasPaid: boolean, paid: number) {
  return z
    .object({
      disposition: z.enum(["full_refund", "keep", "partial"]),
      refundToGuestDigits: z.string(),
      notes: z.union([
        z.literal(""),
        z.string().trim().max(RESERVATION_NOTES_MAX),
      ]),
    })
    .superRefine((values, ctx) => {
      if (!hasPaid || values.disposition !== "partial") {
        return;
      }
      const refund = Number(values.refundToGuestDigits || "");
      if (!Number.isFinite(refund)) {
        ctx.addIssue({
          code: "custom",
          path: ["refundToGuestDigits"],
          message: t("reservations:cancelSheet.zod.enterRefundAmount"),
        });
        return;
      }
      if (refund <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["refundToGuestDigits"],
          message: t("reservations:cancelSheet.zod.mustBeAboveZero"),
        });
        return;
      }
      if (refund >= paid) {
        ctx.addIssue({
          code: "custom",
          path: ["refundToGuestDigits"],
          message: t("reservations:cancelSheet.zod.useFullRefund", {
            amount: formatIdr(paid),
          }),
        });
      }
    });
}

type CancelSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: StaffReservation;
};

type MoneyPreview = {
  returnToGuest: number;
  propertyKeeps: number;
};

function previewFor(
  disposition: FormValues["disposition"],
  paid: number,
  refundDigits: string,
): MoneyPreview {
  if (disposition === "full_refund") {
    return { returnToGuest: paid, propertyKeeps: 0 };
  }
  if (disposition === "keep") {
    return { returnToGuest: 0, propertyKeeps: paid };
  }
  const refund = Number(refundDigits || "0");
  const safe = Number.isFinite(refund) && refund > 0 ? Math.floor(refund) : 0;
  const capped = Math.min(safe, paid);
  return {
    returnToGuest: capped,
    propertyKeeps: Math.max(0, paid - capped),
  };
}

export function CancelSheet({
  open,
  onOpenChange,
  reservation,
}: CancelSheetProps) {
  const { t } = useTranslation(["reservations", "common"]);
  const queryClient = useQueryClient();
  const paid = reservation.paidAmountIdr;
  const hasPaid = paid > 0;
  const [otaRemindOpen, setOtaRemindOpen] = useState(false);
  const remindOtaAfterCancel = isOtaLinkedStay(reservation);

  const schema = useMemo(
    () => createCancelSchema(t, hasPaid, paid),
    [t, hasPaid, paid],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: cancelDefaults(reservation),
  });

  const disposition = useWatch({
    control: form.control,
    name: "disposition",
  });
  const refundDigits = useWatch({
    control: form.control,
    name: "refundToGuestDigits",
  });

  const preview = useMemo(
    () => previewFor(disposition, paid, refundDigits),
    [disposition, paid, refundDigits],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!hasPaid) {
        return cancelReservation(reservation.id, {
          disposition: "none",
          notes: values.notes || null,
        });
      }
      const dispositionValue = values.disposition as CancelDisposition;
      if (dispositionValue === "partial") {
        return cancelReservation(reservation.id, {
          disposition: "partial",
          refundAmountIdr: Math.floor(Number(values.refundToGuestDigits)),
          notes: values.notes || null,
        });
      }
      return cancelReservation(reservation.id, {
        disposition: dispositionValue,
        notes: values.notes || null,
      });
    },
    onSuccess: (saved) => {
      form.reset(emptyFormValues());
      syncReservationCaches(queryClient, saved, { occupancyChanged: true });
      handleSuccess(t("reservations:cancelSheet.toastCancelled"));
      onOpenChange(false);
      if (remindOtaAfterCancel) {
        setOtaRemindOpen(true);
      }
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
        title={t("reservations:cancelSheet.title")}
        description={
          hasPaid
            ? t("reservations:cancelSheet.descriptionPaid")
            : t("reservations:cancelSheet.descriptionUnpaid")
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("reservations:cancelSheet.keepStay")}
            </Button>
            <Button
              type="submit"
              form="cancel-form"
              variant="destructive"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t("reservations:cancelSheet.cancelling")
                : t("reservations:cancelSheet.cancelStay")}
            </Button>
          </>
        }
      >
        <form
          id="cancel-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            saveMutation.mutate(values);
          })}
        >
          {hasPaid && (
            <>
              <FieldSet>
                <FieldLegend variant="label">
                  {t("reservations:cancelSheet.sections.collected")}
                </FieldLegend>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                  <p className="text-lg font-semibold tracking-tight tabular-nums">
                    {formatIdr(paid)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("reservations:cancelSheet.alreadyCollectedHint")}
                  </p>
                </div>
              </FieldSet>

              <Separator />

              <FieldSet>
                <FieldLegend variant="label">
                  {t("reservations:cancelSheet.sections.disposition")}
                </FieldLegend>
                <Controller
                  control={form.control}
                  name="disposition"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }
                          field.onChange(value);
                          if (value !== "partial") {
                            form.setValue("refundToGuestDigits", "", {
                              shouldDirty: true,
                            });
                          }
                        }}
                        className="flex w-full flex-col gap-2"
                      >
                        <ToggleGroupItem
                          value="full_refund"
                          className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
                        >
                          <span className="text-sm font-medium">
                            {t(
                              "reservations:cancelSheet.options.fullRefundTitle",
                            )}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t(
                              "reservations:cancelSheet.options.fullRefundHint",
                              {
                                amount: formatIdr(0),
                              },
                            )}
                          </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="keep"
                          className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
                        >
                          <span className="text-sm font-medium">
                            {t("reservations:cancelSheet.options.keepTitle")}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t("reservations:cancelSheet.options.keepHint", {
                              guestAmount: formatIdr(0),
                              propertyAmount: formatIdr(paid),
                            })}
                          </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="partial"
                          className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
                        >
                          <span className="text-sm font-medium">
                            {t("reservations:cancelSheet.options.partialTitle")}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t("reservations:cancelSheet.options.partialHint")}
                          </span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                {disposition === "partial" && (
                  <Controller
                    control={form.control}
                    name="refundToGuestDigits"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="cancel-refund-amount">
                          {t("reservations:cancelSheet.refundToGuestLabel")}
                        </FieldLabel>
                        <IdrAmountInput
                          id="cancel-refund-amount"
                          autoFocus
                          aria-invalid={fieldState.invalid}
                          placeholder={t(
                            "reservations:cancelSheet.refundToGuestPlaceholder",
                            { amount: formatIdr(paid) },
                          )}
                          value={field.value}
                          max={Math.max(0, paid - 1)}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("reservations:cancelSheet.refundToGuestMaxHint", {
                            amount: formatIdr(Math.max(0, paid - 1)),
                          })}
                        </p>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                )}
              </FieldSet>

              <Separator />

              <FieldSet>
                <FieldLegend variant="label">
                  {t("reservations:cancelSheet.sections.outcome")}
                </FieldLegend>
                <div
                  className={cn(
                    "rounded-lg border border-border px-3 py-3",
                    disposition === "full_refund" &&
                      "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("reservations:cancelSheet.guestGetsBack")}
                      </dt>
                      <dd
                        className={cn(
                          "mt-0.5 text-base font-semibold tracking-tight tabular-nums",
                          preview.returnToGuest > 0 &&
                            "text-amber-800 dark:text-amber-200",
                        )}
                      >
                        {formatMoneyOrDash(preview.returnToGuest)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("reservations:cancelSheet.propertyKeeps")}
                      </dt>
                      <dd className="mt-0.5 text-base font-semibold tracking-tight tabular-nums">
                        {formatMoneyOrDash(preview.propertyKeeps)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {disposition === "full_refund"
                      ? t("reservations:cancelSheet.explain.fullRefund")
                      : disposition === "keep"
                        ? t("reservations:cancelSheet.explain.keep")
                        : preview.returnToGuest > 0
                          ? t(
                              "reservations:cancelSheet.explain.partialWithAmount",
                              {
                                guestAmount: formatIdr(preview.returnToGuest),
                                propertyAmount: formatIdr(
                                  preview.propertyKeeps,
                                ),
                              },
                            )
                          : t("reservations:cancelSheet.explain.partialEmpty")}
                  </p>
                </div>
              </FieldSet>

              <Separator />
            </>
          )}

          <FieldSet>
            <FieldLegend variant="label">
              {t("reservations:cancelSheet.sections.notes")}
            </FieldLegend>
            <Controller
              control={form.control}
              name="notes"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cancel-notes" className="sr-only">
                    {t("reservations:cancelSheet.notesLabel")}
                  </FieldLabel>
                  <Textarea
                    id="cancel-notes"
                    rows={2}
                    maxLength={RESERVATION_NOTES_MAX}
                    aria-invalid={fieldState.invalid}
                    placeholder={t("reservations:cancelSheet.notesPlaceholder")}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldSet>
        </form>
      </ResponsiveFormShell>
      {otaRemindOpen && isOtaLinkedStay(reservation) && (
        <OtaRemindDialog
          open={otaRemindOpen}
          onOpenChange={setOtaRemindOpen}
          source={reservation.source}
          reason="cancel"
        />
      )}
    </>
  );
}

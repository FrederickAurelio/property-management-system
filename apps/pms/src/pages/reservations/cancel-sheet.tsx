/* anchor: Stripe cancel + refund, diverge: guest vs property money preview */
import { useEffect, useMemo, useState } from "react";
import { RESERVATION_NOTES_MAX, type StaffReservation } from "@cabin/api-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { IdrAmountInput } from "@/components/form/idr-amount-input";
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
import { isOtaLinkedStay } from "./ical-playbooks";
import { OtaRemindDialog } from "./ota-remind-dialog";
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
  const safe =
    Number.isFinite(refund) && refund > 0 ? Math.floor(refund) : 0;
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
  const queryClient = useQueryClient();
  const paid = reservation.paidAmountIdr;
  const hasPaid = paid > 0;
  const [otaRemindOpen, setOtaRemindOpen] = useState(false);
  const remindOtaAfterCancel = isOtaLinkedStay(reservation);

  const schema = z
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
          message: "Enter how much to return to the guest",
        });
        return;
      }
      if (refund <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["refundToGuestDigits"],
          message: "Return more than 0, or choose Keep payment",
        });
        return;
      }
      if (refund >= paid) {
        ctx.addIssue({
          code: "custom",
          path: ["refundToGuestDigits"],
          message: `Use Full refund to return all ${formatIdr(paid)}`,
        });
      }
    });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      disposition: "keep",
      refundToGuestDigits: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({
      disposition: "keep",
      refundToGuestDigits: "",
      notes: reservation.notes ?? "",
    });
  }, [open, reservation.notes, form]);

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
      handleSuccess("Reservation cancelled");
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
      title="Cancel reservation"
      description={
        hasPaid
          ? "Cancelling frees the unit. Choose what happens to money already collected."
          : "No payment on file. Confirm to cancel this stay."
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
            Keep stay
          </Button>
          <Button
            type="submit"
            form="cancel-form"
            variant="destructive"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Cancelling…" : "Cancel stay"}
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
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
            <p className="text-sm font-medium">Already collected</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
              {formatIdr(paid)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guest paid this to the property. Decide how much goes back.
            </p>
          </div>
        )}

        <FieldGroup>
          {hasPaid && (
            <Controller
              control={form.control}
              name="disposition"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>What happens to the money?</FieldLabel>
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
                        Return all to guest
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Full refund · property keeps {formatIdr(0)}
                      </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="keep"
                      className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
                    >
                      <span className="text-sm font-medium">
                        Keep all (no refund)
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Guest gets {formatIdr(0)} · property keeps{" "}
                        {formatIdr(paid)}
                      </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="partial"
                      className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal"
                    >
                      <span className="text-sm font-medium">
                        Return part to guest
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Enter how much the guest gets back
                      </span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          )}

          {hasPaid && disposition === "partial" && (
            <Controller
              control={form.control}
              name="refundToGuestDigits"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cancel-refund-amount">
                    Return to guest (IDR)
                  </FieldLabel>
                  <IdrAmountInput
                    id="cancel-refund-amount"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                    placeholder={`Less than ${formatIdr(paid)}`}
                    value={field.value}
                    max={Math.max(0, paid - 1)}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max partial {formatIdr(Math.max(0, paid - 1))}. For the full{" "}
                    {formatIdr(paid)}, choose Return all to guest.
                  </p>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          )}

          {hasPaid && (
            <div
              className={cn(
                "rounded-lg border border-border px-3 py-3",
                disposition === "full_refund" &&
                  "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <p className="text-sm font-medium">After cancel</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Guest gets back
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-base font-semibold tabular-nums tracking-tight",
                      preview.returnToGuest > 0 &&
                        "text-amber-800 dark:text-amber-200",
                    )}
                  >
                    {formatMoneyOrDash(preview.returnToGuest)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Property keeps
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums tracking-tight">
                    {formatMoneyOrDash(preview.propertyKeeps)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                {disposition === "full_refund"
                  ? "Returns everything to the guest, then cancels."
                  : disposition === "keep"
                    ? "No refund — property keeps what was already collected, then cancels."
                    : preview.returnToGuest > 0
                      ? `Guest gets ${formatIdr(preview.returnToGuest)} back; property keeps ${formatIdr(preview.propertyKeeps)}.`
                      : "Enter an amount to return to the guest."}
              </p>
            </div>
          )}

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cancel-notes">Notes</FieldLabel>
                <Textarea
                  id="cancel-notes"
                  rows={2}
                  maxLength={RESERVATION_NOTES_MAX}
                  aria-invalid={fieldState.invalid}
                  placeholder="Optional — why cancelled / refund note"
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </ResponsiveFormShell>
      <OtaRemindDialog
        open={otaRemindOpen}
        onOpenChange={setOtaRemindOpen}
        source={reservation.source}
        reason="cancel"
      />
    </>
  );
}

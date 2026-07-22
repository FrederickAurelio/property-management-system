/* anchor: Stripe Collect sheet, diverge: cash-first IN/OUT movements */
import { useEffect, useMemo } from "react";
import {
  CollectedVia,
  PAYMENT_MOVEMENT_NOTE_MAX,
  PaymentMovementDirection,
  PaymentMovementKind,
  balanceDueIdr,
  refundDueIdr,
  recomputePaymentStatus,
  type StaffReservation,
} from "@cabin/api-contract";
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
  handleError,
  handleSuccess,
  syncReservationCaches,
  postPaymentMovement,
} from "@/lib/api";
import { formatIdr } from "@/pages/properties/inventory-types";
import { ReservationBadge } from "./reservation-badges";
import {
  formatMoneyOrDash,
  formatPaymentStatus,
  paymentBadgeTone,
} from "./reservation-format";

const METHOD_NONE = "__none__";

type FormValues = {
  amountDigits: string;
  method: typeof METHOD_NONE | CollectedVia;
  note: string;
};

function emptyFormValues(): FormValues {
  return {
    amountDigits: "",
    method: METHOD_NONE,
    note: "",
  };
}

type CollectSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: StaffReservation;
};

export function CollectSheet({
  open,
  onOpenChange,
  reservation,
}: CollectSheetProps) {
  const queryClient = useQueryClient();
  const due = balanceDueIdr(
    reservation.totalAmountIdr,
    reservation.paidAmountIdr,
  );
  const refund = refundDueIdr(
    reservation.totalAmountIdr,
    reservation.paidAmountIdr,
  );
  const mode: "collect" | "refund" | "settled" =
    refund != null && refund > 0
      ? "refund"
      : due != null && due > 0
        ? "collect"
        : "settled";
  const maxAmount =
    mode === "refund"
      ? (refund ?? 0)
      : mode === "collect"
        ? (due ?? 0)
        : 0;

  const schema = z
    .object({
      amountDigits: z.string().min(1, "Amount is required"),
      method: z.enum([
        METHOD_NONE,
        CollectedVia.PROPERTY,
        CollectedVia.CHANNEL,
        CollectedVia.MIXED,
      ]),
      note: z.union([
        z.literal(""),
        z.string().trim().max(PAYMENT_MOVEMENT_NOTE_MAX),
      ]),
    })
    .superRefine((values, ctx) => {
      if (mode === "settled") {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: "Nothing to collect or refund",
        });
        return;
      }
      if (reservation.totalAmountIdr == null && mode === "collect") {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: "Set Total on Edit stay before collecting",
        });
        return;
      }
      const amount = Number(values.amountDigits || "0");
      if (!Number.isFinite(amount) || amount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: "Enter an amount greater than 0",
        });
        return;
      }
      if (amount > maxAmount) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: `Cannot exceed ${maxAmount.toLocaleString("id-ID")}`,
        });
      }
    });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      amountDigits: "",
      method: METHOD_NONE,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({
      amountDigits: maxAmount > 0 ? String(maxAmount) : "",
      method:
        reservation.collectedVia ??
        (mode === "collect" ? CollectedVia.PROPERTY : METHOD_NONE),
      note: "",
    });
  }, [open, reservation, form, maxAmount, mode]);

  const amountDigits = useWatch({
    control: form.control,
    name: "amountDigits",
  });

  const preview = useMemo(() => {
    const amount = Number(amountDigits || "0");
    const safeAmount =
      Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
    const nextPaid =
      mode === "collect"
        ? reservation.paidAmountIdr + safeAmount
        : mode === "refund"
          ? Math.max(0, reservation.paidAmountIdr - safeAmount)
          : reservation.paidAmountIdr;
    return {
      paid: nextPaid,
      due: balanceDueIdr(reservation.totalAmountIdr, nextPaid),
      refund: refundDueIdr(reservation.totalAmountIdr, nextPaid),
      status: recomputePaymentStatus({
        totalAmountIdr: reservation.totalAmountIdr,
        paidAmountIdr: nextPaid,
      }),
    };
  }, [amountDigits, mode, reservation.paidAmountIdr, reservation.totalAmountIdr]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const amount = Number(values.amountDigits);
      const method =
        values.method === METHOD_NONE ? null : values.method;
      if (mode === "collect") {
        const isFullChannelSettle =
          method === CollectedVia.CHANNEL &&
          reservation.paidAmountIdr === 0 &&
          amount === (reservation.totalAmountIdr ?? -1);
        return postPaymentMovement(reservation.id, {
          direction: PaymentMovementDirection.IN,
          kind: isFullChannelSettle
            ? PaymentMovementKind.CHANNEL_SETTLED
            : reservation.paidAmountIdr <= 0
              ? PaymentMovementKind.DEPOSIT
              : PaymentMovementKind.TOP_UP,
          amountIdr: amount,
          method,
          note: values.note || null,
        });
      }
      return postPaymentMovement(reservation.id, {
        direction: PaymentMovementDirection.OUT,
        kind: PaymentMovementKind.REFUND,
        amountIdr: amount,
        method,
        note: values.note || null,
      });
    },
    onSuccess: (saved) => {
      form.reset(emptyFormValues());
      syncReservationCaches(queryClient, saved);
      handleSuccess(mode === "refund" ? "Refund recorded" : "Payment collected");
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const title =
    mode === "refund"
      ? "Refund"
      : mode === "collect"
        ? "Collect"
        : "Collect";
  const description =
    mode === "refund"
      ? "Record cash returned to the guest. Paid updates from the cash timeline."
      : mode === "collect"
        ? "Record cash received. Change Total on Edit stay if the quote changed."
        : "Paid already matches Total. Change Total on Edit stay if the quote changed.";

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="collect-form"
            disabled={saveMutation.isPending || mode === "settled"}
          >
            {saveMutation.isPending
              ? "Saving…"
              : mode === "refund"
                ? "Record refund"
                : "Record collection"}
          </Button>
        </>
      }
    >
      <form
        id="collect-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          saveMutation.mutate(values);
        })}
      >
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">After this movement</p>
            <ReservationBadge
              label={formatPaymentStatus(preview.status)}
              tone={paymentBadgeTone(preview.status)}
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="mt-0.5 tabular-nums font-medium">
                {formatMoneyOrDash(reservation.totalAmountIdr)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paid</dt>
              <dd className="mt-0.5 tabular-nums font-medium">
                {formatMoneyOrDash(preview.paid)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {preview.refund != null && preview.refund > 0
                  ? "Refund"
                  : "Due"}
              </dt>
              <dd className="mt-0.5 tabular-nums font-medium">
                {formatMoneyOrDash(
                  preview.refund != null && preview.refund > 0
                    ? preview.refund
                    : preview.due,
                )}
              </dd>
            </div>
          </dl>
          {mode === "refund" ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              Guest overpaid by {formatIdr(refund ?? 0)}. Refund up to that
              amount.
            </p>
          ) : null}
        </div>

        <FieldGroup>
          <Controller
            control={form.control}
            name="amountDigits"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cash-amount">
                  {mode === "refund" ? "Refund amount (IDR)" : "Collect amount (IDR)"}
                </FieldLabel>
                <IdrAmountInput
                  id="cash-amount"
                  autoFocus={mode !== "settled"}
                  aria-invalid={fieldState.invalid}
                  disabled={mode === "settled"}
                  placeholder={
                    maxAmount > 0
                      ? `Max ${formatMoneyOrDash(maxAmount)}`
                      : undefined
                  }
                  value={field.value}
                  max={maxAmount}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                {maxAmount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue("amountDigits", String(maxAmount), {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      {mode === "refund"
                        ? `Full refund (${formatIdr(maxAmount)})`
                        : `Collect full Due (${formatIdr(maxAmount)})`}
                    </Button>
                  </div>
                ) : null}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="method"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Via</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={mode === "settled"}
                >
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Where cash moved" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={METHOD_NONE}>Not set</SelectItem>
                      <SelectItem value={CollectedVia.PROPERTY}>
                        Property
                      </SelectItem>
                      <SelectItem value={CollectedVia.CHANNEL}>
                        Channel
                      </SelectItem>
                      <SelectItem value={CollectedVia.MIXED}>Mixed</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="note"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cash-note">Note</FieldLabel>
                <Textarea
                  id="cash-note"
                  rows={2}
                  maxLength={PAYMENT_MOVEMENT_NOTE_MAX}
                  aria-invalid={fieldState.invalid}
                  disabled={mode === "settled"}
                  placeholder="Optional — receipt #, who paid…"
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </ResponsiveFormShell>
  );
}

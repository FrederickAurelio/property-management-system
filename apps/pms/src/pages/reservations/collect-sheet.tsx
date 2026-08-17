/* anchor: Stripe Collect sheet, diverge: cash-first IN/OUT movements */
import { useMemo, useState } from "react";
import {
  CollectedVia,
  PAYMENT_MOVEMENT_NOTE_MAX,
  PAYMENT_MOVEMENT_PROOF_MAX,
  PaymentMovementDirection,
  PaymentMovementKind,
  balanceDueIdr,
  refundDueIdr,
  recomputePaymentStatus,
  type ArchiveItem,
  type StaffReservation,
} from "@cabin/api-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
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
  postPaymentMovement,
  reservationCashMutationKey,
  syncReservationCaches,
} from "@/lib/api";
import { ArchiveProofField } from "@/components/media/archive-proof-field";
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

function collectDefaults(
  reservation: StaffReservation,
  mode: "collect" | "refund" | "settled",
  maxAmount: number,
): FormValues {
  return {
    amountDigits: maxAmount > 0 ? String(maxAmount) : "",
    method:
      reservation.collectedVia ??
      (mode === "collect" ? CollectedVia.PROPERTY : METHOD_NONE),
    note: "",
  };
}

function createCollectSchema(
  t: TFunction,
  mode: "collect" | "refund" | "settled",
  totalAmountIdr: number | null,
  maxAmount: number,
) {
  return z
    .object({
      amountDigits: z
        .string()
        .min(1, t("reservations:collectSheet.zod.amountRequired")),
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
          message: t("reservations:collectSheet.zod.nothingToDo"),
        });
        return;
      }
      if (totalAmountIdr == null && mode === "collect") {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: t("reservations:collectSheet.zod.setTotalFirst"),
        });
        return;
      }
      const amount = Number(values.amountDigits || "0");
      if (!Number.isFinite(amount) || amount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: t("reservations:collectSheet.zod.amountAboveZero"),
        });
        return;
      }
      if (amount > maxAmount) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: t("reservations:collectSheet.zod.cannotExceed", {
            max: maxAmount.toLocaleString("id-ID"),
          }),
        });
      }
    });
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
  const { t } = useTranslation(["reservations", "common"]);
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
    mode === "refund" ? (refund ?? 0) : mode === "collect" ? (due ?? 0) : 0;

  const schema = useMemo(
    () => createCollectSchema(t, mode, reservation.totalAmountIdr, maxAmount),
    [t, mode, reservation.totalAmountIdr, maxAmount],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: collectDefaults(reservation, mode, maxAmount),
  });
  const [proofImages, setProofImages] = useState<ArchiveItem[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

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
  }, [
    amountDigits,
    mode,
    reservation.paidAmountIdr,
    reservation.totalAmountIdr,
  ]);

  const saveMutation = useMutation({
    mutationKey: reservationCashMutationKey(reservation.id),
    mutationFn: async (values: FormValues) => {
      const amount = Number(values.amountDigits);
      const method = values.method === METHOD_NONE ? null : values.method;
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
          proofImages,
        });
      }
      return postPaymentMovement(reservation.id, {
        direction: PaymentMovementDirection.OUT,
        kind: PaymentMovementKind.REFUND,
        amountIdr: amount,
        method,
        note: values.note || null,
        proofImages,
      });
    },
    onSuccess: (saved) => {
      form.reset(emptyFormValues());
      setProofImages([]);
      setPhotoUploading(false);
      syncReservationCaches(queryClient, saved);
      handleSuccess(
        mode === "refund"
          ? t("reservations:collectSheet.toastRefundRecorded")
          : t("reservations:collectSheet.toastPaymentCollected"),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const cashBusy =
    useIsMutating({
      mutationKey: reservationCashMutationKey(reservation.id),
    }) > 0;

  const title =
    mode === "refund"
      ? t("reservations:collectSheet.titleRefund")
      : t("reservations:collectSheet.titleCollect");
  const description =
    mode === "refund"
      ? t("reservations:collectSheet.descriptionRefund")
      : mode === "collect"
        ? t("reservations:collectSheet.descriptionCollect")
        : t("reservations:collectSheet.descriptionSettled");

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
            {t("reservations:collectSheet.cancel")}
          </Button>
          <Button
            type="submit"
            form="collect-form"
            disabled={cashBusy || photoUploading || mode === "settled"}
          >
            {saveMutation.isPending
              ? t("reservations:collectSheet.saving")
              : mode === "refund"
                ? t("reservations:collectSheet.recordRefund")
                : t("reservations:collectSheet.recordCollection")}
          </Button>
        </>
      }
    >
      <form
        id="collect-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          if (cashBusy) {
            return;
          }
          saveMutation.mutate(values);
        })}
      >
        <FieldSet>
          <FieldLegend variant="label">
            {t("reservations:collectSheet.sections.preview")}
          </FieldLegend>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {t("reservations:collectSheet.afterMovement")}
              </p>
              <ReservationBadge
                label={formatPaymentStatus(preview.status)}
                tone={paymentBadgeTone(preview.status)}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("reservations:collectSheet.total")}
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatMoneyOrDash(reservation.totalAmountIdr)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("reservations:collectSheet.paid")}
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatMoneyOrDash(preview.paid)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {preview.refund != null && preview.refund > 0
                    ? t("reservations:collectSheet.refund")
                    : t("reservations:collectSheet.due")}
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatMoneyOrDash(
                    preview.refund != null && preview.refund > 0
                      ? preview.refund
                      : preview.due,
                  )}
                </dd>
              </div>
            </dl>
            {mode === "refund" && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                {t("reservations:collectSheet.overpaidHint", {
                  amount: formatIdr(refund ?? 0),
                })}
              </p>
            )}
          </div>
        </FieldSet>

        <Separator />

        <FieldSet>
          <FieldLegend variant="label">
            {t("reservations:collectSheet.sections.amount")}
          </FieldLegend>
          <Controller
            control={form.control}
            name="amountDigits"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cash-amount">
                  {mode === "refund"
                    ? t("reservations:collectSheet.refundAmountLabel")
                    : t("reservations:collectSheet.collectAmountLabel")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>
                      {t("reservations:utilitiesSheet.currencyPrefix")}
                    </InputGroupText>
                  </InputGroupAddon>
                  <IdrAmountInput
                    id="cash-amount"
                    data-slot="input-group-control"
                    className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                    autoFocus={mode !== "settled"}
                    aria-invalid={fieldState.invalid}
                    disabled={mode === "settled"}
                    placeholder={
                      maxAmount > 0
                        ? t("reservations:collectSheet.maxAmountPlaceholder", {
                            amount: formatMoneyOrDash(maxAmount),
                          })
                        : undefined
                    }
                    value={field.value}
                    max={maxAmount}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </InputGroup>
                {maxAmount > 0 && (
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
                        ? t("reservations:collectSheet.fullRefundButton", {
                            amount: formatIdr(maxAmount),
                          })
                        : t("reservations:collectSheet.collectFullDueButton", {
                            amount: formatIdr(maxAmount),
                          })}
                    </Button>
                  </div>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldSet>

        <Separator />

        <FieldSet>
          <FieldLegend variant="label">
            {t("reservations:collectSheet.sections.details")}
          </FieldLegend>
          <FieldGroup>
            <Controller
              control={form.control}
              name="method"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>
                    {t("reservations:collectSheet.viaLabel")}
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "settled"}
                  >
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue
                        placeholder={t(
                          "reservations:collectSheet.viaPlaceholder",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={METHOD_NONE}>
                          {t("reservations:collectSheet.viaOptions.notSet")}
                        </SelectItem>
                        <SelectItem value={CollectedVia.PROPERTY}>
                          {t("reservations:collectSheet.viaOptions.property")}
                        </SelectItem>
                        <SelectItem value={CollectedVia.CHANNEL}>
                          {t("reservations:collectSheet.viaOptions.channel")}
                        </SelectItem>
                        <SelectItem value={CollectedVia.MIXED}>
                          {t("reservations:collectSheet.viaOptions.mixed")}
                        </SelectItem>
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
                  <FieldLabel htmlFor="cash-note">
                    {t("reservations:collectSheet.noteLabel")}
                  </FieldLabel>
                  <Textarea
                    id="cash-note"
                    rows={2}
                    maxLength={PAYMENT_MOVEMENT_NOTE_MAX}
                    aria-invalid={fieldState.invalid}
                    disabled={mode === "settled"}
                    placeholder={t("reservations:collectSheet.notePlaceholder")}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Field>
              <FieldLabel>
                {t("reservations:collectSheet.proofLabel")}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  {t("reservations:collectSheet.proofOptional")}
                </span>
              </FieldLabel>
              <ArchiveProofField
                value={proofImages}
                max={PAYMENT_MOVEMENT_PROOF_MAX}
                layout="row"
                readOnly={mode === "settled"}
                onUploadingChange={setPhotoUploading}
                onChange={setProofImages}
                labels={{
                  add: t("reservations:collectSheet.photos.add"),
                  limit: t("reservations:collectSheet.photos.limit", {
                    max: PAYMENT_MOVEMENT_PROOF_MAX,
                  }),
                  counter: t("reservations:collectSheet.photos.counter"),
                  noPhotos: t("reservations:collectSheet.photos.noPhotos"),
                  titleFallback: t(
                    "reservations:collectSheet.photos.titleFallback",
                  ),
                  previousAria: t(
                    "reservations:collectSheet.photos.previousAria",
                  ),
                  nextAria: t("reservations:collectSheet.photos.nextAria"),
                  closeAria: t("reservations:collectSheet.photos.closeAria"),
                  removeAria: t("reservations:collectSheet.photos.removeAria"),
                  nothingToPreview: t(
                    "reservations:collectSheet.photos.nothingToPreview",
                  ),
                }}
              />
              <FieldDescription>
                {t("reservations:collectSheet.proofHint")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </ResponsiveFormShell>
  );
}

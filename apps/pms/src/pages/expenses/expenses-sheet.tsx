/* anchor: Stripe Collect sheet, diverge: property expense form not guest cash */
import { useState } from "react";
import {
  PROPERTY_EXPENSE_AMOUNT_IDR_MAX,
  PROPERTY_EXPENSE_CATEGORIES,
  PROPERTY_EXPENSE_NOTE_MAX,
  PROPERTY_EXPENSE_PROOF_MAX,
  PropertyExpenseCategory,
  type ArchiveItem,
  type StaffPropertyExpense,
  type StaffUnit,
} from "@cabin/api-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { ArchiveProofField } from "@/components/media/archive-proof-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
  createPropertyExpense,
  handleSuccess,
  invalidateExpenseCaches,
  updatePropertyExpense,
} from "@/lib/api";
import { createExpenseFormSchema } from "./expenses-form";
import { formatExpenseCategory } from "./expenses-format";

const UNIT_NONE = "__none__";

type FormValues = {
  occurredOn: string;
  category: PropertyExpenseCategory;
  amountDigits: string;
  unitId: string;
  note: string;
};

function emptyFormValues(occurredOn: string): FormValues {
  return {
    occurredOn,
    category: PropertyExpenseCategory.UTILITIES,
    amountDigits: "",
    unitId: UNIT_NONE,
    note: "",
  };
}

function valuesFromExpense(expense: StaffPropertyExpense): FormValues {
  return {
    occurredOn: expense.occurredOn,
    category: expense.category,
    amountDigits: String(expense.amountIdr),
    unitId: expense.unitId ?? UNIT_NONE,
    note: expense.note ?? "",
  };
}

type ExpensesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  defaultOccurredOn: string;
  units: StaffUnit[];
  expense: StaffPropertyExpense | null;
  onDelete?: () => void;
};

export function ExpensesSheet({
  open,
  onOpenChange,
  propertyId,
  defaultOccurredOn,
  units,
  expense,
  onDelete,
}: ExpensesSheetProps) {
  const { t } = useTranslation(["expenses", "common"]);
  const queryClient = useQueryClient();
  const isEdit = expense != null;
  const [proofImages, setProofImages] = useState<ArchiveItem[]>(
    expense?.proofImages ?? [],
  );
  const [photoUploading, setPhotoUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createExpenseFormSchema((key) => t(key))),
    defaultValues: expense
      ? valuesFromExpense(expense)
      : emptyFormValues(defaultOccurredOn),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        occurredOn: values.occurredOn,
        category: values.category,
        amountIdr: Number(values.amountDigits),
        unitId: values.unitId === UNIT_NONE ? null : values.unitId,
        note: values.note.trim() || null,
        proofImages,
      };
      if (isEdit) {
        return updatePropertyExpense(expense.id, body);
      }
      return createPropertyExpense({ propertyId, ...body });
    },
    onSuccess: () => {
      form.reset(emptyFormValues(defaultOccurredOn));
      setProofImages([]);
      setPhotoUploading(false);
      invalidateExpenseCaches(queryClient);
      handleSuccess(
        isEdit
          ? t("expenses:page.updatedToast")
          : t("expenses:page.createdToast"),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  const busy = saveMutation.isPending || photoUploading;

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit ? t("expenses:sheet.editTitle") : t("expenses:sheet.createTitle")
      }
      description={t("expenses:sheet.description")}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={onDelete}
            >
              {t("expenses:sheet.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="expense-form"
              disabled={busy}
            >
              {t("expenses:sheet.save")}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="expense-form"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          saveMutation.mutate(values);
        })}
      >
        <FieldGroup>
          <Controller
            control={form.control}
            name="occurredOn"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="expense-date">
                  {t("expenses:sheet.date")}
                </FieldLabel>
                <input
                  id="expense-date"
                  type="date"
                  className="h-9 rounded-md border border-input bg-background px-3 text-base md:text-sm"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="category"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>{t("expenses:sheet.category")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PROPERTY_EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {formatExpenseCategory(c)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="amountDigits"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="expense-amount">
                  {t("expenses:sheet.amount")}
                </FieldLabel>
                <IdrAmountInput
                  id="expense-amount"
                  value={field.value}
                  max={PROPERTY_EXPENSE_AMOUNT_IDR_MAX}
                  aria-invalid={fieldState.invalid}
                  onValueChange={field.onChange}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="unitId"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t("expenses:sheet.unit")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={UNIT_NONE}>
                        {t("expenses:sheet.unitNone")}
                      </SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name?.trim() ? u.name : u.code}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="note"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="expense-note">
                  {t("expenses:sheet.note")}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {t("expenses:sheet.noteRequiredOther")}
                  </span>
                </FieldLabel>
                <Textarea
                  id="expense-note"
                  rows={2}
                  maxLength={PROPERTY_EXPENSE_NOTE_MAX}
                  placeholder={t("expenses:sheet.notePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Field>
            <FieldLabel>
              {t("expenses:sheet.proofLabel")}
              <span className="font-normal text-muted-foreground">
                {" "}
                {t("expenses:sheet.proofOptional")}
              </span>
            </FieldLabel>
            <ArchiveProofField
              value={proofImages}
              max={PROPERTY_EXPENSE_PROOF_MAX}
              layout="row"
              onUploadingChange={setPhotoUploading}
              onChange={setProofImages}
              labels={{
                add: t("expenses:sheet.photos.add"),
                limit: t("expenses:sheet.photos.limit", {
                  max: PROPERTY_EXPENSE_PROOF_MAX,
                }),
                counter: t("expenses:sheet.photos.counter"),
                noPhotos: t("expenses:sheet.photos.noPhotos"),
                titleFallback: t("expenses:sheet.photos.titleFallback"),
                previousAria: t("expenses:sheet.photos.previousAria"),
                nextAria: t("expenses:sheet.photos.nextAria"),
                closeAria: t("expenses:sheet.photos.closeAria"),
                removeAria: t("expenses:sheet.photos.removeAria"),
                nothingToPreview: t("expenses:sheet.photos.nothingToPreview"),
              }}
            />
            <FieldDescription>{t("expenses:sheet.proofHint")}</FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveFormShell>
  );
}

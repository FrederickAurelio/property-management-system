/* anchor: Linear settings form, diverge: calendar block = reservation Stay chrome */
import { useMemo, useState } from "react";
import {
  CALENDAR_BLOCK_NOTE_MAX,
  CalendarBlockKind,
  UnitAvailabilityBlockReason,
  type StaffCalendarBlock,
  type StaffPropertyCalendar,
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
  createCalendarBlock,
  deleteCalendarBlock,
  handleError,
  handleSuccess,
  invalidatePropertyCalendarCaches,
  listAvailableUnits,
  staffUnitsAvailabilityQueryKey,
  updateCalendarBlock,
  applyApiFieldError,
} from "@/lib/api";
import { ChosenUnitField } from "@/pages/reservations/chosen-unit-field";
import type { ChosenUnit } from "@/pages/reservations/chosen-unit";
import { StayDateRangePicker } from "@/pages/reservations/stay-date-range-picker";
import { UnitInventoryPicker } from "@/pages/reservations/unit-inventory-picker";
import { formatBlockKind } from "./calendar-block-labels";
import { occupancyExtrasForUnit } from "./calendar-occupancy";

const KIND_OPTIONS = [
  CalendarBlockKind.MAINTENANCE,
  CalendarBlockKind.OWNER,
  CalendarBlockKind.HOLD,
  CalendarBlockKind.OTHER,
] as const;

const schema = z
  .object({
    unitId: z.string().min(1, "Unit is required"),
    kind: z.enum([
      CalendarBlockKind.MAINTENANCE,
      CalendarBlockKind.OWNER,
      CalendarBlockKind.HOLD,
      CalendarBlockKind.OTHER,
    ]),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    note: z.union([
      z.literal(""),
      z.string().trim().max(CALENDAR_BLOCK_NOTE_MAX),
    ]),
  })
  .superRefine((values, ctx) => {
    if (values.endDate <= values.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End must be after start",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function emptyFormValues(): FormValues {
  return {
    unitId: "",
    kind: CalendarBlockKind.MAINTENANCE,
    startDate: "",
    endDate: "",
    note: "",
  };
}

function chosenFromCalendar(
  calendar: StaffPropertyCalendar | undefined,
  unitId: string,
  propertyId: string,
  propertyName: string,
): ChosenUnit | null {
  if (!unitId) return null;
  const unit = calendar?.units.find((u) => u.id === unitId);
  if (!unit?.unitType) {
    return {
      propertyId,
      propertyName,
      unitTypeId: "",
      unitTypeName: "",
      unitId,
      unitCode: unit?.code ?? "Selected unit",
      unitName: unit?.name ?? null,
    };
  }
  return {
    propertyId,
    propertyName,
    unitTypeId: unit.unitType.id,
    unitTypeName: unit.unitType.name,
    unitId: unit.id,
    unitCode: unit.code,
    unitName: unit.name,
  };
}

type CalendarBlockSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  /** Current calendar payload — busy nights for date picker extras. */
  calendar?: StaffPropertyCalendar;
  /** Prefill dates + unit when creating from a row. */
  initialUnitId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  /** When set, edit mode. */
  block?: StaffCalendarBlock | null;
};

export function CalendarBlockSheet({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  calendar,
  initialUnitId = "",
  initialStartDate = "",
  initialEndDate = "",
  block = null,
}: CalendarBlockSheetProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(block);
  const [pickerOpen, setPickerOpen] = useState(false);
  const lockedUnitId = block?.unitId ?? initialUnitId;
  const [picked, setPicked] = useState<ChosenUnit | null>(() =>
    chosenFromCalendar(calendar, lockedUnitId, propertyId, propertyName),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      unitId: lockedUnitId,
      kind: block?.kind ?? CalendarBlockKind.MAINTENANCE,
      startDate: block?.startDate ?? initialStartDate,
      endDate: block?.endDate ?? initialEndDate,
      note: block?.note ?? "",
    },
  });

  const startDate = useWatch({ control: form.control, name: "startDate" });
  const endDate = useWatch({ control: form.control, name: "endDate" });
  const unitId = useWatch({ control: form.control, name: "unitId" });

  const chosen = picked;

  const datesReady =
    Boolean(startDate) && Boolean(endDate) && endDate > startDate;

  const unitAvailabilityQuery = useQuery({
    queryKey: staffUnitsAvailabilityQueryKey(chosen?.propertyId ?? "", {
      checkInDate: startDate,
      checkOutDate: endDate,
      unitTypeId: chosen?.unitTypeId,
      excludeBlockId: block?.id,
    }),
    queryFn: () =>
      listAvailableUnits(chosen!.propertyId, {
        checkInDate: startDate,
        checkOutDate: endDate,
        unitTypeId: chosen!.unitTypeId,
        excludeBlockId: block?.id,
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

  const extraOccupancyBlocks = useMemo(
    () => occupancyExtrasForUnit(calendar, chosen?.unitId ?? unitId),
    [calendar, chosen?.unitId, unitId],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (block) {
        return updateCalendarBlock(block.id, {
          unitId: values.unitId,
          kind: values.kind,
          startDate: values.startDate,
          endDate: values.endDate,
          note: values.note || null,
        });
      }
      return createCalendarBlock({
        propertyId,
        unitId: values.unitId,
        kind: values.kind,
        startDate: values.startDate,
        endDate: values.endDate,
        note: values.note || null,
      });
    },
    onSuccess: () => {
      form.reset(emptyFormValues());
      setPicked(null);
      setPickerOpen(false);
      invalidatePropertyCalendarCaches(queryClient);
      handleSuccess(isEdit ? "Block updated" : "Block created");
      onOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCalendarBlock(block!.id),
    onSuccess: () => {
      form.reset(emptyFormValues());
      setPicked(null);
      setPickerOpen(false);
      invalidatePropertyCalendarCaches(queryClient);
      handleSuccess("Block deleted");
      onOpenChange(false);
    },
    onError: (error) => {
      handleError(error);
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPicked(null);
      setPickerOpen(false);
    }
    onOpenChange(next);
  };

  return (
    <>
      <ResponsiveFormShell
        open={open && !pickerOpen}
        onOpenChange={(next) => {
          if (pickerOpen) return;
          handleOpenChange(next);
        }}
        title={isEdit ? "Edit block" : "New block"}
        description="Closes the unit for non-guest use. Does not create a reservation."
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending || saveMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="calendar-block-form"
                disabled={
                  saveMutation.isPending ||
                  deleteMutation.isPending ||
                  !chosen ||
                  dateOverlapConflict
                }
              >
                {isEdit ? "Save" : "Create block"}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="calendar-block-form"
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FieldGroup className="gap-4">
            <p className="text-sm font-medium text-foreground">Block</p>
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
                form.formState.errors.startDate ||
                form.formState.errors.endDate ||
                dateOverlapConflict,
              )}
            >
              <FieldLabel htmlFor="block-dates">Dates</FieldLabel>
              <StayDateRangePicker
                id="block-dates"
                copy="block"
                checkInDate={startDate}
                checkOutDate={endDate}
                unitId={chosen?.unitId}
                extraOccupancyBlocks={extraOccupancyBlocks}
                excludeOccupancyId={block?.id}
                invalid={Boolean(
                  form.formState.errors.startDate ||
                  form.formState.errors.endDate ||
                  dateOverlapConflict,
                )}
                onChange={({ checkInDate, checkOutDate }) => {
                  const complete = Boolean(checkInDate && checkOutDate);
                  form.setValue("startDate", checkInDate, {
                    shouldDirty: true,
                    shouldValidate: complete,
                  });
                  form.setValue("endDate", checkOutDate, {
                    shouldDirty: true,
                    shouldValidate: complete,
                  });
                }}
              />
              <FieldError
                errors={[
                  form.formState.errors.startDate,
                  form.formState.errors.endDate,
                  dateOverlapError,
                ]}
              />
            </Field>

            <Controller
              control={form.control}
              name="kind"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Kind</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {KIND_OPTIONS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {formatBlockKind(kind)}
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
              name="note"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Note (optional)</FieldLabel>
                  <Textarea
                    rows={2}
                    maxLength={CALENDAR_BLOCK_NOTE_MAX}
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

      {pickerOpen && (
        <UnitInventoryPicker
          open
          onOpenChange={setPickerOpen}
          checkInDate={startDate}
          checkOutDate={endDate}
          initialPropertyId={chosen?.propertyId ?? propertyId}
          initialPropertyName={chosen?.propertyName ?? propertyName}
          initialUnitTypeId={chosen?.unitTypeId ?? ""}
          initialUnitTypeName={chosen?.unitTypeName ?? ""}
          initialUnitId={chosen?.unitId ?? ""}
          onConfirm={(next) => {
            setPicked(next);
            form.setValue("unitId", next.unitId, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

/* anchor: Linear settings form, diverge: unit CRUD fields */
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_FLOOR_MAX,
  INVENTORY_NAME_MAX,
  UnitStatus,
  type StaffUnit,
} from "@cabin/api-contract";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
  createUnit,
  handleSuccess,
  syncUnitCaches,
  updateUnit,
} from "@/lib/api";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(INVENTORY_CODE_MIN, "Code is required")
    .max(INVENTORY_CODE_MAX)
    .regex(INVENTORY_CODE_PATTERN, "Use letters, numbers, _ or -"),
  name: z.union([z.literal(""), z.string().trim().max(INVENTORY_NAME_MAX)]),
  floor: z.union([z.literal(""), z.string().trim().max(INVENTORY_FLOOR_MAX)]),
  status: z.enum([
    UnitStatus.ACTIVE,
    UnitStatus.INACTIVE,
    UnitStatus.MAINTENANCE,
  ]),
  notes: z.union([z.literal(""), z.string().trim().max(4000)]),
});

type FormValues = z.infer<typeof schema>;

const emptyFormValues: FormValues = {
  code: "",
  name: "",
  floor: "",
  status: UnitStatus.ACTIVE,
  notes: "",
};

type UnitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unitTypeId: string;
  unit?: StaffUnit | null;
  readOnly?: boolean;
};

export function UnitFormDialog({
  open,
  onOpenChange,
  propertyId,
  unitTypeId,
  unit,
  readOnly = false,
}: UnitFormDialogProps) {
  const isEdit = Boolean(unit);
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
    resolver: zodResolver(schema as never),
    defaultValues: {
      code: "",
      name: "",
      floor: "",
      status: UnitStatus.ACTIVE,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset(
      unit
        ? {
            code: unit.code,
            name: unit.name ?? "",
            floor: unit.floor ?? "",
            status: unit.status,
            notes: unit.notes ?? "",
          }
        : {
            code: "",
            name: "",
            floor: "",
            status: UnitStatus.ACTIVE,
            notes: "",
          },
    );
  }, [open, unit, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (unit) {
        return updateUnit(unit.id, {
          code: values.code,
          name: values.name || null,
          floor: values.floor || null,
          status: values.status,
          notes: values.notes || null,
        });
      }
      return createUnit(propertyId, {
        unitTypeId,
        code: values.code,
        name: values.name || null,
        floor: values.floor || null,
        status: values.status,
        notes: values.notes || null,
      });
    },
    onSuccess: (saved) => {
      form.reset(emptyFormValues);
      syncUnitCaches(queryClient, saved, {
        bookabilityChanged: !unit || unit.status !== saved.status,
      });
      handleSuccess(unit ? "Unit updated" : "Unit created");
      onOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  function onSubmit(values: FormValues) {
    saveMutation.mutate(values);
  }

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={readOnly ? "View unit" : isEdit ? "Edit unit" : "Add unit"}
      description="Physical apartment — one calendar each."
      footer={
        readOnly ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </Button>
        ) : (
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
              form="unit-form"
              disabled={form.formState.isSubmitting || saveMutation.isPending}
            >
              {isEdit ? "Save" : "Create"}
            </Button>
          </>
        )
      }
    >
      <form
        id="unit-form"
        className="flex flex-col gap-4"
        onSubmit={readOnly ? undefined : form.handleSubmit(onSubmit)}
      >
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          <FieldGroup>
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="unit-code">Code</FieldLabel>
                  <Input
                    {...field}
                    id="unit-code"
                    aria-invalid={fieldState.invalid || undefined}
                    placeholder="B-0801"
                    autoComplete="off"
                    className="uppercase"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="unit-name">Display name</FieldLabel>
                  <Input
                    {...field}
                    id="unit-name"
                    aria-invalid={fieldState.invalid || undefined}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="floor"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="unit-floor">Floor</FieldLabel>
                    <Input
                      {...field}
                      id="unit-floor"
                      aria-invalid={fieldState.invalid || undefined}
                      autoComplete="off"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="status"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={field.value}
                      disabled={readOnly}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={fieldState.invalid || undefined}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={UnitStatus.ACTIVE}>
                            Active (bookable)
                          </SelectItem>
                          <SelectItem value={UnitStatus.INACTIVE}>
                            Inactive
                          </SelectItem>
                          <SelectItem value={UnitStatus.MAINTENANCE}>
                            Maintenance
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="notes"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="unit-notes">Internal notes</FieldLabel>
                  <Textarea
                    {...field}
                    id="unit-notes"
                    rows={3}
                    aria-invalid={fieldState.invalid || undefined}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </fieldset>
      </form>
    </ResponsiveFormShell>
  );
}

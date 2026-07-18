/* anchor: Linear settings form, diverge: unit CRUD mock fields */
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { handleSuccess } from "@/lib/api";
import type { Unit, UnitStatus } from "./inventory-types";
// MOCK — replace with API mutations (POST/PATCH /staff/units) when backend is wired.
import {
  InventoryConflictError,
  createUnit,
  updateUnit,
} from "./mock-inventory";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, _ or -"),
  name: z.union([z.literal(""), z.string().trim().max(128)]),
  floor: z.union([z.literal(""), z.string().trim().max(16)]),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]),
  notes: z.union([z.literal(""), z.string().trim().max(2000)]),
  isActive: z.enum(["true", "false"]),
});

type FormValues = z.infer<typeof schema>;

type UnitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unitTypeId: string;
  unit?: Unit | null;
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
  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
    resolver: zodResolver(schema as never),
    defaultValues: {
      code: "",
      name: "",
      floor: "",
      status: "ACTIVE",
      notes: "",
      isActive: "true",
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
            isActive: unit.isActive ? "true" : "false",
          }
        : {
            code: "",
            name: "",
            floor: "",
            status: "ACTIVE",
            notes: "",
            isActive: "true",
          },
    );
  }, [open, unit, form]);

  function onSubmit(values: FormValues) {
    try {
      const payload = {
        code: values.code,
        name: values.name || null,
        floor: values.floor || null,
        status: values.status as UnitStatus,
        notes: values.notes || null,
        isActive: values.isActive === "true",
      };
      if (unit) {
        // MOCK — local update; replace with PATCH /staff/units/:id.
        updateUnit(unit.id, payload);
        handleSuccess("Unit updated");
      } else {
        // MOCK — local create; replace with POST /staff/properties/:propertyId/units.
        createUnit(propertyId, unitTypeId, payload);
        handleSuccess("Unit created");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof InventoryConflictError) {
        // MOCK — map to ApiError field details when API is wired.
        form.setError("code", { message: error.message });
        return;
      }
      throw error;
    }
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
              disabled={form.formState.isSubmitting}
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
        <fieldset
          disabled={readOnly}
          className="m-0 min-w-0 border-0 p-0"
        >
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
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
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
            name="isActive"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel>Bookable</FieldLabel>
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
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
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

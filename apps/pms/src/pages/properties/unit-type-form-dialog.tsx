/* anchor: Linear settings form, diverge: unit type + beds + amenities per _docs */
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { handleSuccess } from "@/lib/api";
import { AmenitiesField } from "./amenities-field";
import { BedConfigField } from "./bed-config-field";
import {
  EMPTY_AMENITIES,
  type Amenities,
  type BedConfigRoom,
  type MediaItem,
  type UnitLayout,
  type UnitType,
} from "./inventory-types";
// MOCK — replace with API mutations (POST/PATCH /unit-types) when backend is wired.
import {
  InventoryConflictError,
  createUnitType,
  updateUnitType,
} from "./mock-inventory";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { SortableMediaField } from "@/components/media/sortable-media-field";

const bedKindSchema = z.enum([
  "SINGLE",
  "DOUBLE",
  "LARGE_DOUBLE",
  "QUEEN",
  "KING",
  "SOFA_BED",
  "OTHER",
]);

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, _ or -"),
    name: z.string().trim().min(2, "Name is required").max(128),
    layout: z.enum(["STUDIO", "APARTMENT", "CABIN", "OTHER"]),
    sizeSqm: z.string().trim(),
    bathroomCount: z.string().trim(),
    maxGuests: z.string().trim(),
    description: z.string().trim().max(2000),
    smokingAllowed: z.enum(["true", "false"]),
    isActive: z.enum(["true", "false"]),
    bedConfig: z.array(
      z.object({
        room: z.string().trim().min(1, "Room name required"),
        beds: z
          .array(
            z.object({
              type: bedKindSchema,
              count: z.number().int().min(1).max(10),
            }),
          )
          .min(1),
      }),
    ),
    amenities: z.object({
      highlights: z.array(z.string()),
      kitchen: z.array(z.string()),
      bathroom: z.array(z.string()),
      view: z.array(z.string()),
      facilities: z.array(z.string()),
    }),
    media: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(["IMAGE", "VIDEO"]),
        url: z.string(),
        name: z.string(),
        mimeType: z.string(),
      }),
    ),
  })
  .superRefine((values, ctx) => {
    if (
      values.sizeSqm &&
      (Number.isNaN(Number(values.sizeSqm)) || Number(values.sizeSqm) <= 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sizeSqm"],
        message: "Enter a positive number",
      });
    }
    const bathrooms = Number(values.bathroomCount);
    if (
      values.bathroomCount === "" ||
      Number.isNaN(bathrooms) ||
      !Number.isInteger(bathrooms) ||
      bathrooms < 0 ||
      bathrooms > 20
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bathroomCount"],
        message: "Enter 0–20",
      });
    }
    const guests = Number(values.maxGuests);
    if (
      values.maxGuests === "" ||
      Number.isNaN(guests) ||
      !Number.isInteger(guests) ||
      guests < 1 ||
      guests > 50
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxGuests"],
        message: "Enter 1–50",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const emptyDefaults: FormValues = {
  code: "",
  name: "",
  layout: "APARTMENT",
  sizeSqm: "",
  bathroomCount: "1",
  maxGuests: "2",
  description: "",
  smokingAllowed: "false",
  isActive: "true",
  bedConfig: [],
  amenities: structuredClone(EMPTY_AMENITIES),
  media: [],
};

type UnitTypeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unitType?: UnitType | null;
};

export function UnitTypeFormDialog({
  open,
  onOpenChange,
  propertyId,
  unitType,
}: UnitTypeFormDialogProps) {
  const isEdit = Boolean(unitType);
  // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset(
      unitType
        ? {
            code: unitType.code,
            name: unitType.name,
            layout: unitType.layout,
            sizeSqm: unitType.sizeSqm != null ? String(unitType.sizeSqm) : "",
            bathroomCount: String(unitType.bathroomCount),
            maxGuests: String(unitType.maxGuests),
            description: unitType.description ?? "",
            smokingAllowed: unitType.smokingAllowed ? "true" : "false",
            isActive: unitType.isActive ? "true" : "false",
            bedConfig: structuredClone(unitType.bedConfig),
            amenities: structuredClone(unitType.amenities),
            media: structuredClone(unitType.media),
          }
        : structuredClone(emptyDefaults),
    );
  }, [open, unitType, form]);

  function onSubmit(values: FormValues) {
    try {
      const bedroomCount =
        values.layout === "STUDIO" ? 0 : values.bedConfig.length;
      const payload = {
        code: values.code,
        name: values.name,
        layout: values.layout as UnitLayout,
        sizeSqm: values.sizeSqm ? Number(values.sizeSqm) : null,
        bedroomCount,
        bathroomCount: Number(values.bathroomCount),
        maxGuests: Number(values.maxGuests),
        description: values.description || null,
        smokingAllowed: values.smokingAllowed === "true",
        isActive: values.isActive === "true",
        bedConfig: values.bedConfig as BedConfigRoom[],
        amenities: values.amenities as Amenities,
        media: values.media as MediaItem[],
      };
      if (unitType) {
        // MOCK — local update; replace with PATCH /unit-types/:id.
        updateUnitType(unitType.id, payload);
        handleSuccess("Unit type updated");
      } else {
        // MOCK — local create; replace with POST /properties/:propertyId/unit-types.
        createUnitType(propertyId, payload);
        handleSuccess("Unit type created");
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

  const bedConfig = form.watch("bedConfig");
  const layout = form.watch("layout");
  const bedroomCountView =
    layout === "STUDIO" ? 0 : bedConfig.length;

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? "Edit unit type" : "Add unit type"}
      description="Shared specs — beds, size, amenities — for every unit of this kind."
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
            form="unit-type-form"
            disabled={form.formState.isSubmitting}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="unit-type-form"
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="type-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="type-name"
                  aria-invalid={fieldState.invalid || undefined}
                  autoComplete="off"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="code"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="type-code">Code</FieldLabel>
                <Input
                  {...field}
                  id="type-code"
                  aria-invalid={fieldState.invalid || undefined}
                  autoComplete="off"
                  className="uppercase"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="layout"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel>Layout</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="w-full"
                    aria-invalid={fieldState.invalid || undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="STUDIO">Studio</SelectItem>
                      <SelectItem value="APARTMENT">Apartment</SelectItem>
                      <SelectItem value="CABIN">Cabin</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="sizeSqm"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="type-size">Size (m²)</FieldLabel>
                  <Input
                    {...field}
                    id="type-size"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    aria-invalid={fieldState.invalid || undefined}
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="maxGuests"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="type-guests">Max guests</FieldLabel>
                  <Input
                    {...field}
                    id="type-guests"
                    type="number"
                    min={1}
                    aria-invalid={fieldState.invalid || undefined}
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Bedrooms</FieldLabel>
              <div className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-sm tabular-nums">
                {bedroomCountView}
              </div>
              <p className="text-xs text-muted-foreground">
                {layout === "STUDIO"
                  ? "Studios always count as 0 bedrooms"
                  : "From rooms in Rooms & beds below"}
              </p>
            </Field>
            <Controller
              control={form.control}
              name="bathroomCount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="type-bathrooms">Bathrooms</FieldLabel>
                  <Input
                    {...field}
                    id="type-bathrooms"
                    type="number"
                    min={0}
                    aria-invalid={fieldState.invalid || undefined}
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="smokingAllowed"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel>Smoking</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="false">Not allowed</SelectItem>
                        <SelectItem value="true">Allowed</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="isActive"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel>Active</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
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
          </div>
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="type-desc">Description</FieldLabel>
                <Textarea
                  {...field}
                  id="type-desc"
                  rows={3}
                  aria-invalid={fieldState.invalid || undefined}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>

        <Separator />

        <Controller
          control={form.control}
          name="media"
          render={({ field }) => (
            <SortableMediaField value={field.value} onChange={field.onChange} />
          )}
        />

        <Separator />

        <Controller
          control={form.control}
          name="bedConfig"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <BedConfigField value={field.value} onChange={field.onChange} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Separator />

        <Controller
          control={form.control}
          name="amenities"
          render={({ field }) => (
            <AmenitiesField value={field.value} onChange={field.onChange} />
          )}
        />
      </form>
    </ResponsiveFormShell>
  );
}

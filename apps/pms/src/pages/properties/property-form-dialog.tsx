/* anchor: Linear settings form, diverge: property CRUD mock fields */
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { handleSuccess } from "@/lib/api";
import {
  googleMapsUrl,
  type MediaItem,
  type Property,
} from "./inventory-types";
// MOCK — replace with API mutations (POST/PATCH /properties) when backend is wired.
import {
  InventoryConflictError,
  createProperty,
  updateProperty,
} from "./mock-inventory";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { CoverImageField } from "@/components/media/sortable-media-field";

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .max(32, "Max 32 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, _ or -"),
    name: z.string().trim().min(2, "Name is required").max(128),
    timezone: z.string().trim().min(1, "Timezone is required").max(64),
    city: z.union([z.literal(""), z.string().trim().max(128)]),
    countryCode: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .length(2, "Use a 2-letter code")
        .regex(/^[A-Za-z]{2}$/, "Use a 2-letter code"),
    ]),
    addressLine: z.union([z.literal(""), z.string().trim().max(255)]),
    latitude: z.string().trim(),
    longitude: z.string().trim(),
    googlePlaceId: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .min(10, "Place ID looks too short")
        .max(256)
        .regex(/^[\w-]+$/, "Use the Place ID only (e.g. ChIJ…)"),
    ]),
    checkInFrom: z.union([z.literal(""), z.string().trim().max(5)]),
    checkInUntil: z.union([z.literal(""), z.string().trim().max(5)]),
    checkOutFrom: z.union([z.literal(""), z.string().trim().max(5)]),
    checkOutUntil: z.union([z.literal(""), z.string().trim().max(5)]),
    isActive: z.enum(["true", "false"]),
    coverImage: z.custom<MediaItem | null>(),
  })
  .superRefine((values, ctx) => {
    const latRaw = values.latitude;
    const lngRaw = values.longitude;
    const latEmpty = latRaw === "";
    const lngEmpty = lngRaw === "";

    if (latEmpty && lngEmpty) {
      return;
    }
    if (latEmpty || lngEmpty) {
      ctx.addIssue({
        code: "custom",
        path: [latEmpty ? "latitude" : "longitude"],
        message: "Enter both latitude and longitude",
      });
      return;
    }

    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Enter a latitude between -90 and 90",
      });
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Enter a longitude between -180 and 180",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const emptyDefaults: FormValues = {
  code: "",
  name: "",
  timezone: "Asia/Jakarta",
  city: "",
  countryCode: "ID",
  addressLine: "",
  latitude: "",
  longitude: "",
  googlePlaceId: "",
  checkInFrom: "15:00",
  checkInUntil: "23:30",
  checkOutFrom: "08:00",
  checkOutUntil: "12:00",
  isActive: "true",
  coverImage: null,
};

type PropertyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
  readOnly?: boolean;
};

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  readOnly = false,
}: PropertyFormDialogProps) {
  const isEdit = Boolean(property);
  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
    resolver: zodResolver(schema as never),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset(
      property
        ? {
            code: property.code,
            name: property.name,
            timezone: property.timezone,
            city: property.city ?? "",
            countryCode: property.countryCode ?? "",
            addressLine: property.addressLine ?? "",
            latitude:
              property.latitude != null ? String(property.latitude) : "",
            longitude:
              property.longitude != null ? String(property.longitude) : "",
            googlePlaceId: property.googlePlaceId ?? "",
            checkInFrom: property.checkInFrom ?? "",
            checkInUntil: property.checkInUntil ?? "",
            checkOutFrom: property.checkOutFrom ?? "",
            checkOutUntil: property.checkOutUntil ?? "",
            isActive: property.isActive ? "true" : "false",
            coverImage: property.coverImage,
          }
        : structuredClone(emptyDefaults),
    );
  }, [open, property, form]);

  const [
    name,
    googlePlaceId,
    latitude,
    longitude,
    addressLine,
    city,
    countryCode,
  ] = useWatch({
    control: form.control,
    name: [
      "name",
      "googlePlaceId",
      "latitude",
      "longitude",
      "addressLine",
      "city",
      "countryCode",
    ],
  });

  const mapsHref = googleMapsUrl({
    googlePlaceId: googlePlaceId || null,
    name: name || null,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    addressLine: addressLine || null,
    city: city || null,
    countryCode: countryCode || null,
  });

  function onSubmit(values: FormValues) {
    try {
      const payload = {
        code: values.code,
        name: values.name,
        timezone: values.timezone,
        city: values.city || null,
        countryCode: values.countryCode || null,
        addressLine: values.addressLine || null,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null,
        googlePlaceId: values.googlePlaceId || null,
        checkInFrom: values.checkInFrom || null,
        checkInUntil: values.checkInUntil || null,
        checkOutFrom: values.checkOutFrom || null,
        checkOutUntil: values.checkOutUntil || null,
        coverImage: values.coverImage,
        isActive: values.isActive === "true",
      };
      if (property) {
        // MOCK — local update; replace with PATCH /properties/:id.
        updateProperty(property.id, payload);
        handleSuccess("Property updated");
      } else {
        // MOCK — local create; replace with POST /properties.
        createProperty(payload);
        handleSuccess("Property created");
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
      title={
        readOnly ? "View property" : isEdit ? "Edit property" : "Add property"
      }
      description="Place-level settings for inventory and check-in times."
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
              form="property-form"
              disabled={form.formState.isSubmitting}
            >
              {isEdit ? "Save" : "Create"}
            </Button>
          </>
        )
      }
    >
      <form
        id="property-form"
        className="flex flex-col gap-4"
        onSubmit={readOnly ? undefined : form.handleSubmit(onSubmit)}
      >
        <fieldset
          disabled={readOnly}
          className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="property-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="property-name"
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
                  <FieldLabel htmlFor="property-code">Code</FieldLabel>
                  <Input
                    {...field}
                    id="property-code"
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
              name="timezone"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="property-tz">Timezone</FieldLabel>
                  <Input
                    {...field}
                    id="property-tz"
                    aria-invalid={fieldState.invalid || undefined}
                    placeholder="Asia/Jakarta"
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="city"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-city">City</FieldLabel>
                    <Input
                      {...field}
                      id="property-city"
                      aria-invalid={fieldState.invalid || undefined}
                      autoComplete="off"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="countryCode"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-country">Country</FieldLabel>
                    <Input
                      {...field}
                      id="property-country"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="ID"
                      autoComplete="off"
                      className="uppercase"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="addressLine"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="property-address">Address</FieldLabel>
                  <Input
                    {...field}
                    id="property-address"
                    aria-invalid={fieldState.invalid || undefined}
                    autoComplete="off"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="googlePlaceId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="property-place-id">
                    Google Place ID
                  </FieldLabel>
                  <Input
                    {...field}
                    id="property-place-id"
                    aria-invalid={fieldState.invalid || undefined}
                    placeholder="ChIJ…"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    From Place ID Finder. Open in Maps uses this so Google shows
                    the real place name.
                  </p>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-lat">Latitude</FieldLabel>
                    <Input
                      {...field}
                      id="property-lat"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="-6.200000"
                      autoComplete="off"
                      className="tabular-nums"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-lng">Longitude</FieldLabel>
                    <Input
                      {...field}
                      id="property-lng"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="106.816666"
                      autoComplete="off"
                      className="tabular-nums"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lat/lng power our own map later (pins + property titles).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="checkInFrom"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-checkin-from">
                      Check-in from
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-checkin-from"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="15:00"
                      autoComplete="off"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="checkInUntil"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-checkin-until">
                      Check-in until
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-checkin-until"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="23:30"
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
                name="checkOutFrom"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-checkout-from">
                      Check-out from
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-checkout-from"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="08:00"
                      autoComplete="off"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="checkOutUntil"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-checkout-until">
                      Check-out until
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-checkout-until"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder="12:00"
                      autoComplete="off"
                    />
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
                  <FieldLabel>Active</FieldLabel>
                  <Select
                    value={field.value}
                    disabled={readOnly}
                    onValueChange={field.onChange}
                  >
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
          </FieldGroup>

          <Separator />
        </fieldset>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={!mapsHref}
          asChild={Boolean(mapsHref)}
        >
          {mapsHref ? (
            <a href={mapsHref} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              Open in Google Maps
            </a>
          ) : (
            <>
              <ExternalLinkIcon data-icon="inline-start" />
              Open in Google Maps
            </>
          )}
        </Button>

        <Controller
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <CoverImageField
              value={field.value}
              onChange={field.onChange}
              readOnly={readOnly}
            />
          )}
        />
      </form>
    </ResponsiveFormShell>
  );
}

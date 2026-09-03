/* anchor: Linear settings form, diverge: property CRUD fields */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  INVENTORY_ADDRESS_MAX,
  INVENTORY_CITY_MAX,
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_COUNTRY_CODE_LENGTH,
  INVENTORY_GOOGLE_PLACE_ID_MAX,
  INVENTORY_HHMM_PATTERN,
  INVENTORY_LAT_MAX,
  INVENTORY_LAT_MIN,
  INVENTORY_LNG_MAX,
  INVENTORY_LNG_MIN,
  INVENTORY_NAME_MAX,
  INVENTORY_NAME_MIN,
  INVENTORY_TIMEZONE_MAX,
  type MediaItem,
  type StaffProperty,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { ExternalLinkIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import {
  applyApiFieldError,
  createProperty,
  handleSuccess,
  syncPropertyCaches,
  updateProperty,
} from "@/lib/api";
import { googleMapsUrl } from "./inventory-types";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { SearchableSelect } from "@/components/form/searchable-select";
import { CoverImageField } from "@/components/media/sortable-media-field";
import {
  getCountryOptions,
  getTimezoneOptions,
  isValidCountryCode,
  isValidIanaTimezone,
} from "@/lib/geo-options";

function createPropertySchema(t: TFunction) {
  const hhmmOrEmpty = z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(
        INVENTORY_HHMM_PATTERN,
        t("inventory:properties.form.zod.hhmmPattern"),
      ),
  ]);

  return z
    .object({
      code: z
        .string()
        .trim()
        .min(
          INVENTORY_CODE_MIN,
          t("inventory:properties.form.zod.codeRequired"),
        )
        .max(
          INVENTORY_CODE_MAX,
          t("inventory:properties.form.zod.codeMax", {
            max: INVENTORY_CODE_MAX,
          }),
        )
        .regex(
          INVENTORY_CODE_PATTERN,
          t("inventory:properties.form.zod.codePattern"),
        ),
      name: z
        .string()
        .trim()
        .min(
          INVENTORY_NAME_MIN,
          t("inventory:properties.form.zod.nameRequired"),
        )
        .max(INVENTORY_NAME_MAX),
      timezone: z
        .string()
        .trim()
        .min(1, t("inventory:properties.form.zod.timezoneRequired"))
        .max(INVENTORY_TIMEZONE_MAX)
        .refine(isValidIanaTimezone, {
          message: t("inventory:properties.form.zod.timezoneInvalid"),
        }),
      city: z.union([z.literal(""), z.string().trim().max(INVENTORY_CITY_MAX)]),
      countryCode: z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .length(
            INVENTORY_COUNTRY_CODE_LENGTH,
            t("inventory:properties.form.zod.countryCodeInvalid"),
          )
          .regex(
            /^[A-Za-z]{2}$/,
            t("inventory:properties.form.zod.countryCodeInvalid"),
          )
          .refine((code) => isValidCountryCode(code), {
            message: t("inventory:properties.form.zod.countryCodeInvalid"),
          }),
      ]),
      addressLine: z.union([
        z.literal(""),
        z.string().trim().max(INVENTORY_ADDRESS_MAX),
      ]),
      latitude: z.string().trim(),
      longitude: z.string().trim(),
      googlePlaceId: z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .min(10, t("inventory:properties.form.zod.placeIdShort"))
          .max(INVENTORY_GOOGLE_PLACE_ID_MAX)
          .regex(/^[\w-]+$/, t("inventory:properties.form.zod.placeIdPattern")),
      ]),
      checkInFrom: hhmmOrEmpty,
      checkInUntil: hhmmOrEmpty,
      checkOutFrom: hhmmOrEmpty,
      checkOutUntil: hhmmOrEmpty,
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
          message: t("inventory:properties.form.zod.latLngBothRequired"),
        });
        return;
      }

      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (
        Number.isNaN(lat) ||
        lat < INVENTORY_LAT_MIN ||
        lat > INVENTORY_LAT_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["latitude"],
          message: t("inventory:properties.form.zod.latitudeRange", {
            min: INVENTORY_LAT_MIN,
            max: INVENTORY_LAT_MAX,
          }),
        });
      }
      if (
        Number.isNaN(lng) ||
        lng < INVENTORY_LNG_MIN ||
        lng > INVENTORY_LNG_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["longitude"],
          message: t("inventory:properties.form.zod.longitudeRange", {
            min: INVENTORY_LNG_MIN,
            max: INVENTORY_LNG_MAX,
          }),
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof createPropertySchema>>;

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

function formValuesFromProperty(
  property: StaffProperty | null | undefined,
): FormValues {
  if (!property) {
    return structuredClone(emptyDefaults);
  }
  return {
    code: property.code,
    name: property.name,
    timezone: property.timezone,
    city: property.city ?? "",
    countryCode: property.countryCode ?? "",
    addressLine: property.addressLine ?? "",
    latitude: property.latitude != null ? String(property.latitude) : "",
    longitude: property.longitude != null ? String(property.longitude) : "",
    googlePlaceId: property.googlePlaceId ?? "",
    checkInFrom: property.checkInFrom ?? "",
    checkInUntil: property.checkInUntil ?? "",
    checkOutFrom: property.checkOutFrom ?? "",
    checkOutUntil: property.checkOutUntil ?? "",
    isActive: property.isActive ? "true" : "false",
    coverImage: property.coverImage,
  };
}

type PropertyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: StaffProperty | null;
  readOnly?: boolean;
};

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  readOnly = false,
}: PropertyFormDialogProps) {
  const { t, i18n } = useTranslation(["inventory", "common"]);
  const geoLocale = i18n.language.startsWith("id") ? "id" : "en";
  const isEdit = Boolean(property);
  const queryClient = useQueryClient();
  const [mediaUploading, setMediaUploading] = useState(false);
  const schema = useMemo(() => createPropertySchema(t), [t]);
  const countryOptions = useMemo(
    () => getCountryOptions(geoLocale),
    [geoLocale],
  );
  const propertyTimezone = property?.timezone;
  const timezoneOptions = useMemo(
    () =>
      getTimezoneOptions(geoLocale, propertyTimezone ? [propertyTimezone] : []),
    [geoLocale, propertyTimezone],
  );
  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
    resolver: zodResolver(schema as never),
    defaultValues: formValuesFromProperty(property),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (values.coverImage?.url.startsWith("blob:")) {
        throw new Error(t("inventory:properties.form.coverImageUploading"));
      }
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
        return updateProperty(property.id, payload);
      }
      return createProperty(payload);
    },
    onSuccess: (saved) => {
      form.reset(structuredClone(emptyDefaults));
      setMediaUploading(false);
      syncPropertyCaches(queryClient, saved);
      handleSuccess(
        property
          ? t("inventory:properties.form.toastUpdated")
          : t("inventory:properties.form.toastCreated"),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

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
    saveMutation.mutate(values);
  }

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        readOnly
          ? t("inventory:properties.form.titleView")
          : isEdit
            ? t("inventory:properties.form.titleEdit")
            : t("inventory:properties.form.titleCreate")
      }
      description={t("inventory:properties.form.description")}
      footer={
        readOnly ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("inventory:properties.form.close")}
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
              {t("inventory:properties.form.cancel")}
            </Button>
            <Button
              type="submit"
              form="property-form"
              disabled={
                form.formState.isSubmitting ||
                saveMutation.isPending ||
                mediaUploading
              }
            >
              {isEdit
                ? t("inventory:properties.form.save")
                : t("inventory:properties.form.create")}
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
                  <FieldLabel htmlFor="property-name">
                    {t("inventory:properties.form.fields.name")}
                  </FieldLabel>
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
                  <FieldLabel htmlFor="property-code">
                    {t("inventory:properties.form.fields.code")}
                  </FieldLabel>
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
                  <FieldLabel htmlFor="property-tz">
                    {t("inventory:properties.form.fields.timezone")}
                  </FieldLabel>
                  <SearchableSelect
                    id="property-tz"
                    value={field.value}
                    onChange={field.onChange}
                    options={timezoneOptions}
                    placeholder={t(
                      "inventory:properties.form.fields.timezonePlaceholder",
                    )}
                    searchPlaceholder={t(
                      "inventory:properties.form.fields.timezoneSearchPlaceholder",
                    )}
                    emptyMessage={t(
                      "inventory:properties.form.fields.searchNoResults",
                    )}
                    disabled={readOnly}
                    invalid={fieldState.invalid}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("inventory:properties.form.fields.timezoneHint")}
                  </p>
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
                    <FieldLabel htmlFor="property-city">
                      {t("inventory:properties.form.fields.city")}
                    </FieldLabel>
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
                    <FieldLabel htmlFor="property-country">
                      {t("inventory:properties.form.fields.country")}
                    </FieldLabel>
                    <SearchableSelect
                      id="property-country"
                      value={field.value}
                      onChange={field.onChange}
                      options={countryOptions}
                      placeholder={t(
                        "inventory:properties.form.fields.countryPlaceholder",
                      )}
                      searchPlaceholder={t(
                        "inventory:properties.form.fields.countrySearchPlaceholder",
                      )}
                      emptyMessage={t(
                        "inventory:properties.form.fields.searchNoResults",
                      )}
                      allowEmpty
                      emptyLabel={t(
                        "inventory:properties.form.fields.countryEmpty",
                      )}
                      disabled={readOnly}
                      invalid={fieldState.invalid}
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
                  <FieldLabel htmlFor="property-address">
                    {t("inventory:properties.form.fields.address")}
                  </FieldLabel>
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
                    {t("inventory:properties.form.fields.googlePlaceId")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="property-place-id"
                    aria-invalid={fieldState.invalid || undefined}
                    placeholder={t(
                      "inventory:properties.form.fields.googlePlaceIdPlaceholder",
                    )}
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("inventory:properties.form.fields.googlePlaceIdHint")}
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
                    <FieldLabel htmlFor="property-lat">
                      {t("inventory:properties.form.fields.latitude")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-lat"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder={t(
                        "inventory:properties.form.fields.latitudePlaceholder",
                      )}
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
                    <FieldLabel htmlFor="property-lng">
                      {t("inventory:properties.form.fields.longitude")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="property-lng"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder={t(
                        "inventory:properties.form.fields.longitudePlaceholder",
                      )}
                      autoComplete="off"
                      className="tabular-nums"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("inventory:properties.form.fields.coordinatesHint")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="checkInFrom"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="property-checkin-from">
                      {t("inventory:properties.form.fields.checkInFrom")}
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
                      {t("inventory:properties.form.fields.checkInUntil")}
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
                      {t("inventory:properties.form.fields.checkOutFrom")}
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
                      {t("inventory:properties.form.fields.checkOutUntil")}
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
                  <FieldLabel>
                    {t("inventory:properties.form.fields.openForOps")}
                  </FieldLabel>
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
                        <SelectItem value="true">
                          {t("inventory:properties.form.fields.yes")}
                        </SelectItem>
                        <SelectItem value="false">
                          {t("inventory:properties.form.fields.no")}
                        </SelectItem>
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
              {t("inventory:properties.form.openInGoogleMaps")}
            </a>
          ) : (
            <>
              <ExternalLinkIcon data-icon="inline-start" />
              {t("inventory:properties.form.openInGoogleMaps")}
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
              onUploadingChange={setMediaUploading}
            />
          )}
        />
      </form>
    </ResponsiveFormShell>
  );
}

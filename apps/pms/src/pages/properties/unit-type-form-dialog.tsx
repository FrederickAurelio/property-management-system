/* anchor: Linear settings form, diverge: unit type + beds + amenities per _docs */
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BedKind,
  EMPTY_AMENITIES,
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_NAME_MAX,
  INVENTORY_NAME_MIN,
  MediaKind,
  UNIT_TYPE_DAILY_PRICE_IDR_MAX,
  UNIT_TYPE_MONTHLY_PRICE_IDR_MAX,
  UNIT_TYPE_YEARLY_PRICE_IDR_MAX,
  UnitLayout,
  type Amenities,
  type BedConfigRoom,
  type MediaItem,
  type StaffUnitType,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
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
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
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
import {
  applyApiFieldError,
  createUnitType,
  handleSuccess,
  syncUnitTypeCaches,
  updateUnitType,
} from "@/lib/api";
import { AmenitiesField } from "./amenities-field";
import { BedConfigField } from "./bed-config-field";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";
import { SortableMediaField } from "@/components/media/sortable-media-field";

const bedKindSchema = z.enum([
  BedKind.SINGLE,
  BedKind.DOUBLE,
  BedKind.LARGE_DOUBLE,
  BedKind.QUEEN,
  BedKind.KING,
  BedKind.SOFA_BED,
  BedKind.OTHER,
]);

function createUnitTypeSchema(t: TFunction) {
  return z
    .object({
      code: z
        .string()
        .trim()
        .min(INVENTORY_CODE_MIN, t("inventory:unitTypes.form.zod.codeRequired"))
        .max(INVENTORY_CODE_MAX)
        .regex(
          INVENTORY_CODE_PATTERN,
          t("inventory:unitTypes.form.zod.codePattern"),
        ),
      name: z
        .string()
        .trim()
        .min(INVENTORY_NAME_MIN, t("inventory:unitTypes.form.zod.nameRequired"))
        .max(INVENTORY_NAME_MAX),
      layout: z.enum([
        UnitLayout.STUDIO,
        UnitLayout.APARTMENT,
        UnitLayout.CABIN,
        UnitLayout.OTHER,
      ]),
      sizeSqm: z.string().trim(),
      bathroomCount: z.string().trim(),
      maxGuests: z.string().trim(),
      defaultPriceIdr: z.string().trim(),
      monthlyPriceIdr: z.string().trim(),
      yearlyPriceIdr: z.string().trim(),
      description: z.string().trim().max(4000),
      smokingAllowed: z.enum(["true", "false"]),
      isActive: z.enum(["true", "false"]),
      bedConfig: z.array(
        z.object({
          room: z
            .string()
            .trim()
            .min(1, t("inventory:unitTypes.form.zod.roomNameRequired")),
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
          kind: z.enum([MediaKind.IMAGE, MediaKind.VIDEO]),
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
          message: t("inventory:unitTypes.form.zod.positiveNumber"),
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
          message: t("inventory:unitTypes.form.zod.bathroomsRange"),
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
          message: t("inventory:unitTypes.form.zod.maxGuestsRange"),
        });
      }
      const price = Number(values.defaultPriceIdr);
      if (
        values.defaultPriceIdr === "" ||
        Number.isNaN(price) ||
        !Number.isInteger(price) ||
        price < 0 ||
        price > UNIT_TYPE_DAILY_PRICE_IDR_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["defaultPriceIdr"],
          message: t("inventory:unitTypes.form.zod.dailyPriceRange"),
        });
      }
      const monthly = Number(values.monthlyPriceIdr);
      if (
        values.monthlyPriceIdr === "" ||
        Number.isNaN(monthly) ||
        !Number.isInteger(monthly) ||
        monthly < 0 ||
        monthly > UNIT_TYPE_MONTHLY_PRICE_IDR_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["monthlyPriceIdr"],
          message: t("inventory:unitTypes.form.zod.monthlyPriceRange"),
        });
      }
      const yearly = Number(values.yearlyPriceIdr);
      if (
        values.yearlyPriceIdr === "" ||
        Number.isNaN(yearly) ||
        !Number.isInteger(yearly) ||
        yearly < 0 ||
        yearly > UNIT_TYPE_YEARLY_PRICE_IDR_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["yearlyPriceIdr"],
          message: t("inventory:unitTypes.form.zod.yearlyPriceRange"),
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof createUnitTypeSchema>>;

const emptyDefaults: FormValues = {
  code: "",
  name: "",
  layout: UnitLayout.APARTMENT,
  sizeSqm: "",
  bathroomCount: "1",
  maxGuests: "2",
  defaultPriceIdr: "",
  monthlyPriceIdr: "",
  yearlyPriceIdr: "",
  description: "",
  smokingAllowed: "false",
  isActive: "true",
  bedConfig: [],
  amenities: structuredClone(EMPTY_AMENITIES),
  media: [],
};

function formValuesFromUnitType(
  unitType: StaffUnitType | null | undefined,
): FormValues {
  if (!unitType) {
    return structuredClone(emptyDefaults);
  }
  return {
    code: unitType.code,
    name: unitType.name,
    layout: unitType.layout,
    sizeSqm: unitType.sizeSqm != null ? String(unitType.sizeSqm) : "",
    bathroomCount: String(unitType.bathroomCount),
    maxGuests: String(unitType.maxGuests),
    defaultPriceIdr: String(unitType.defaultPriceIdr),
    monthlyPriceIdr: String(unitType.monthlyPriceIdr),
    yearlyPriceIdr: String(unitType.yearlyPriceIdr),
    description: unitType.description ?? "",
    smokingAllowed: unitType.smokingAllowed ? "true" : "false",
    isActive: unitType.isActive ? "true" : "false",
    bedConfig: structuredClone(unitType.bedConfig),
    amenities: structuredClone(unitType.amenities),
    media: structuredClone(unitType.media),
  };
}

type UnitTypeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unitType?: StaffUnitType | null;
  readOnly?: boolean;
};

export function UnitTypeFormDialog({
  open,
  onOpenChange,
  propertyId,
  unitType,
  readOnly = false,
}: UnitTypeFormDialogProps) {
  const { t } = useTranslation(["inventory", "common"]);
  const isEdit = Boolean(unitType);
  const queryClient = useQueryClient();
  const [mediaUploading, setMediaUploading] = useState(false);
  const schema = useMemo(() => createUnitTypeSchema(t), [t]);
  // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: formValuesFromUnitType(unitType),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (values.media.some((item) => item.url.startsWith("blob:"))) {
        throw new Error(t("inventory:unitTypes.form.mediaUploadingError"));
      }
      const payload = {
        code: values.code,
        name: values.name,
        layout: values.layout,
        sizeSqm: values.sizeSqm ? Number(values.sizeSqm) : null,
        bathroomCount: Number(values.bathroomCount),
        maxGuests: Number(values.maxGuests),
        defaultPriceIdr: Number(values.defaultPriceIdr),
        monthlyPriceIdr: Number(values.monthlyPriceIdr),
        yearlyPriceIdr: Number(values.yearlyPriceIdr),
        description: values.description || null,
        smokingAllowed: values.smokingAllowed === "true",
        isActive: values.isActive === "true",
        bedConfig: values.bedConfig as BedConfigRoom[],
        amenities: values.amenities as Amenities,
        media: values.media as MediaItem[],
      };
      if (unitType) {
        return updateUnitType(unitType.id, payload);
      }
      return createUnitType(propertyId, payload);
    },
    onSuccess: (saved) => {
      form.reset(structuredClone(emptyDefaults));
      setMediaUploading(false);
      syncUnitTypeCaches(queryClient, saved);
      handleSuccess(
        unitType
          ? t("inventory:unitTypes.form.toastUpdated")
          : t("inventory:unitTypes.form.toastCreated"),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  function onSubmit(values: FormValues) {
    saveMutation.mutate(values);
  }

  const bedConfig = useWatch({ control: form.control, name: "bedConfig" });
  const layout = useWatch({ control: form.control, name: "layout" });
  const bedroomCountView =
    layout === UnitLayout.STUDIO ? 0 : (bedConfig?.length ?? 0);

  return (
    <ResponsiveFormShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        readOnly
          ? t("inventory:unitTypes.form.titleView")
          : isEdit
            ? t("inventory:unitTypes.form.titleEdit")
            : t("inventory:unitTypes.form.titleCreate")
      }
      description={t("inventory:unitTypes.form.description")}
      footer={
        readOnly ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("inventory:unitTypes.form.close")}
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
              {t("inventory:unitTypes.form.cancel")}
            </Button>
            <Button
              type="submit"
              form="unit-type-form"
              disabled={
                form.formState.isSubmitting ||
                saveMutation.isPending ||
                mediaUploading
              }
            >
              {isEdit
                ? t("inventory:unitTypes.form.save")
                : t("inventory:unitTypes.form.create")}
            </Button>
          </>
        )
      }
    >
      <form
        id="unit-type-form"
        className="flex flex-col gap-5"
        onSubmit={readOnly ? undefined : form.handleSubmit(onSubmit)}
      >
        <fieldset
          disabled={readOnly}
          className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
        >
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="type-name">
                    {t("inventory:unitTypes.form.fields.name")}
                  </FieldLabel>
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
                  <FieldLabel htmlFor="type-code">
                    {t("inventory:unitTypes.form.fields.code")}
                  </FieldLabel>
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
                  <FieldLabel>
                    {t("inventory:unitTypes.form.fields.layout")}
                  </FieldLabel>
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
                        <SelectItem value="STUDIO">
                          {t("inventory:status.layout.studio")}
                        </SelectItem>
                        <SelectItem value="APARTMENT">
                          {t("inventory:status.layout.apartment")}
                        </SelectItem>
                        <SelectItem value="CABIN">
                          {t("inventory:status.layout.cabin")}
                        </SelectItem>
                        <SelectItem value="OTHER">
                          {t("inventory:status.layout.other")}
                        </SelectItem>
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
                    <FieldLabel htmlFor="type-size">
                      {t("inventory:unitTypes.form.fields.size")}
                    </FieldLabel>
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
                    <FieldLabel htmlFor="type-guests">
                      {t("inventory:unitTypes.form.fields.maxGuests")}
                    </FieldLabel>
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
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">
                {t("inventory:unitTypes.form.fields.rackRatesTitle")}
              </p>
              <p className="-mt-1 text-xs text-muted-foreground">
                {t("inventory:unitTypes.form.fields.rackRatesHint")}
              </p>
              <Controller
                control={form.control}
                name="defaultPriceIdr"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="type-price">
                      {t("inventory:unitTypes.form.fields.daily")}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>
                          {t("inventory:unitTypes.form.fields.currencyPrefix")}
                        </InputGroupText>
                      </InputGroupAddon>
                      <IdrAmountInput
                        id="type-price"
                        data-slot="input-group-control"
                        placeholder="0"
                        className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent"
                        aria-invalid={fieldState.invalid || undefined}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>
                          {t("inventory:unitTypes.form.fields.perNight")}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="monthlyPriceIdr"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="type-price-monthly">
                        {t("inventory:unitTypes.form.fields.monthly")}
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>
                            {t(
                              "inventory:unitTypes.form.fields.currencyPrefix",
                            )}
                          </InputGroupText>
                        </InputGroupAddon>
                        <IdrAmountInput
                          id="type-price-monthly"
                          data-slot="input-group-control"
                          placeholder="0"
                          className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent"
                          aria-invalid={fieldState.invalid || undefined}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>
                            {t("inventory:unitTypes.form.fields.perMonth")}
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="yearlyPriceIdr"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="type-price-yearly">
                        {t("inventory:unitTypes.form.fields.yearly")}
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>
                            {t(
                              "inventory:unitTypes.form.fields.currencyPrefix",
                            )}
                          </InputGroupText>
                        </InputGroupAddon>
                        <IdrAmountInput
                          id="type-price-yearly"
                          data-slot="input-group-control"
                          placeholder="0"
                          className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent"
                          aria-invalid={fieldState.invalid || undefined}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>
                            {t("inventory:unitTypes.form.fields.perYear")}
                          </InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>
                  {t("inventory:unitTypes.form.fields.bedrooms")}
                </FieldLabel>
                <div className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-sm tabular-nums">
                  {bedroomCountView}
                </div>
                <p className="text-xs text-muted-foreground">
                  {layout === "STUDIO"
                    ? t("inventory:unitTypes.form.fields.bedroomsStudioHint")
                    : t(
                        "inventory:unitTypes.form.fields.bedroomsFromRoomsHint",
                      )}
                </p>
              </Field>
              <Controller
                control={form.control}
                name="bathroomCount"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="type-bathrooms">
                      {t("inventory:unitTypes.form.fields.bathrooms")}
                    </FieldLabel>
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
                    <FieldLabel>
                      {t("inventory:unitTypes.form.fields.smoking")}
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
                          <SelectItem value="false">
                            {t(
                              "inventory:unitTypes.form.fields.smokingNotAllowed",
                            )}
                          </SelectItem>
                          <SelectItem value="true">
                            {t(
                              "inventory:unitTypes.form.fields.smokingAllowed",
                            )}
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
                name="isActive"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel>
                      {t("inventory:unitTypes.form.fields.offeredForBooking")}
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
                            {t("inventory:unitTypes.form.fields.yes")}
                          </SelectItem>
                          <SelectItem value="false">
                            {t("inventory:unitTypes.form.fields.no")}
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
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="type-desc">
                    {t("inventory:unitTypes.form.fields.description")}
                  </FieldLabel>
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
        </fieldset>

        <Controller
          control={form.control}
          name="media"
          render={({ field }) => (
            <SortableMediaField
              value={field.value}
              onChange={field.onChange}
              readOnly={readOnly}
              onUploadingChange={setMediaUploading}
            />
          )}
        />

        <Separator />

        <Controller
          control={form.control}
          name="bedConfig"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <BedConfigField
                value={field.value}
                onChange={field.onChange}
                readOnly={readOnly}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Separator />

        <Controller
          control={form.control}
          name="amenities"
          render={({ field }) => (
            <AmenitiesField
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

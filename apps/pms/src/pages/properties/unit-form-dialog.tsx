/* anchor: Linear settings form, diverge: unit CRUD + iCal calendars */
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  INVENTORY_CODE_MAX,
  INVENTORY_CODE_MIN,
  INVENTORY_CODE_PATTERN,
  INVENTORY_FLOOR_MAX,
  INVENTORY_NAME_MAX,
  UNIT_ICAL_IMPORT_URL_MAX,
  UnitIcalFeedSource,
  UnitStatus,
  type StaffUnit,
  type StaffUnitIcalFeedInput,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  FieldDescription,
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
  handleError,
  handleSuccess,
  rotateUnitIcalToken,
  syncUnitCaches,
  updateUnit,
} from "@/lib/api";
import { ResponsiveFormShell } from "@/components/form/responsive-form-shell";

function createUnitSchema(t: TFunction) {
  const feedUrlSchema = z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(UNIT_ICAL_IMPORT_URL_MAX)
      .url(t("inventory:units.form.zod.urlInvalid")),
  ]);

  return z.object({
    code: z
      .string()
      .trim()
      .min(INVENTORY_CODE_MIN, t("inventory:units.form.zod.codeRequired"))
      .max(INVENTORY_CODE_MAX)
      .regex(INVENTORY_CODE_PATTERN, t("inventory:units.form.zod.codePattern")),
    name: z.union([z.literal(""), z.string().trim().max(INVENTORY_NAME_MAX)]),
    floor: z.union([z.literal(""), z.string().trim().max(INVENTORY_FLOOR_MAX)]),
    status: z.enum([
      UnitStatus.ACTIVE,
      UnitStatus.INACTIVE,
      UnitStatus.MAINTENANCE,
    ]),
    notes: z.union([z.literal(""), z.string().trim().max(4000)]),
    bookingComUrl: feedUrlSchema,
    airbnbUrl: feedUrlSchema,
    agodaUrl: feedUrlSchema,
  });
}

type FormValues = z.infer<ReturnType<typeof createUnitSchema>>;

const emptyFormValues: FormValues = {
  code: "",
  name: "",
  floor: "",
  status: UnitStatus.ACTIVE,
  notes: "",
  bookingComUrl: "",
  airbnbUrl: "",
  agodaUrl: "",
};

function feedUrlFromUnit(
  unit: StaffUnit | null | undefined,
  source: (typeof UnitIcalFeedSource)[keyof typeof UnitIcalFeedSource],
): string {
  return unit?.icalFeeds.find((f) => f.source === source)?.importUrl ?? "";
}

function feedErrorFromUnit(
  unit: StaffUnit | null | undefined,
  source: (typeof UnitIcalFeedSource)[keyof typeof UnitIcalFeedSource],
): string | null {
  return unit?.icalFeeds.find((f) => f.source === source)?.lastError ?? null;
}

function icalFeedsFromValues(values: FormValues): StaffUnitIcalFeedInput[] {
  return [
    {
      source: UnitIcalFeedSource.BOOKING_COM,
      importUrl: values.bookingComUrl.trim(),
    },
    {
      source: UnitIcalFeedSource.AIRBNB,
      importUrl: values.airbnbUrl.trim(),
    },
    {
      source: UnitIcalFeedSource.AGODA,
      importUrl: values.agodaUrl.trim(),
    },
  ];
}

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
  const { t } = useTranslation(["inventory", "common"]);
  const queryClient = useQueryClient();
  /** After create, keep dialog open on the saved row so staff can copy export URL. */
  const [createdUnit, setCreatedUnit] = useState<StaffUnit | null>(null);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  /** Local override after rotate when `unit` prop is still the pre-rotate row. */
  const [exportUrlOverride, setExportUrlOverride] = useState<string | null>(
    null,
  );
  const effectiveUnit = createdUnit ?? unit ?? null;
  const isEdit = Boolean(effectiveUnit);
  const exportUrl =
    exportUrlOverride ??
    createdUnit?.icalExportUrl ??
    unit?.icalExportUrl ??
    "";

  const schema = useMemo(() => createUnitSchema(t), [t]);
  const form = useForm<FormValues>({
    // Cast: @hookform/resolvers brands Zod minor as `0`; Zod 4.4 uses `4` (runtime OK).
    resolver: zodResolver(schema as never),
    defaultValues: emptyFormValues,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCreatedUnit(null);
      setRotateConfirmOpen(false);
      setExportUrlOverride(null);
    }
    onOpenChange(nextOpen);
  }

  useEffect(() => {
    if (!open || createdUnit) {
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
            bookingComUrl: feedUrlFromUnit(
              unit,
              UnitIcalFeedSource.BOOKING_COM,
            ),
            airbnbUrl: feedUrlFromUnit(unit, UnitIcalFeedSource.AIRBNB),
            agodaUrl: feedUrlFromUnit(unit, UnitIcalFeedSource.AGODA),
          }
        : emptyFormValues,
    );
  }, [open, unit, form, createdUnit]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const icalFeeds = icalFeedsFromValues(values);
      if (effectiveUnit) {
        return updateUnit(effectiveUnit.id, {
          code: values.code,
          name: values.name || null,
          floor: values.floor || null,
          status: values.status,
          notes: values.notes || null,
          icalFeeds,
        });
      }
      return createUnit(propertyId, {
        unitTypeId,
        code: values.code,
        name: values.name || null,
        floor: values.floor || null,
        status: values.status,
        notes: values.notes || null,
        icalFeeds,
      });
    },
    onSuccess: (saved) => {
      const creating = !unit && !createdUnit;
      syncUnitCaches(queryClient, saved, {
        bookabilityChanged:
          !effectiveUnit || effectiveUnit.status !== saved.status,
      });
      if (creating) {
        setCreatedUnit(saved);
        setExportUrlOverride(null);
        form.reset({
          code: saved.code,
          name: saved.name ?? "",
          floor: saved.floor ?? "",
          status: saved.status,
          notes: saved.notes ?? "",
          bookingComUrl: feedUrlFromUnit(saved, UnitIcalFeedSource.BOOKING_COM),
          airbnbUrl: feedUrlFromUnit(saved, UnitIcalFeedSource.AIRBNB),
          agodaUrl: feedUrlFromUnit(saved, UnitIcalFeedSource.AGODA),
        });
        handleSuccess(
          saved.icalExportUrl
            ? t("inventory:units.form.toastCreatedWithLink")
            : t("inventory:units.form.toastCreatedNoLink"),
        );
        return;
      }
      form.reset(emptyFormValues);
      setCreatedUnit(null);
      setExportUrlOverride(null);
      handleSuccess(t("inventory:units.form.toastUpdated"));
      handleOpenChange(false);
    },
    onError: (error) => {
      applyApiFieldError(error, form.setError);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveUnit) {
        throw new Error(t("inventory:units.form.errorUnitRequired"));
      }
      return rotateUnitIcalToken(effectiveUnit.id);
    },
    onSuccess: (saved) => {
      setRotateConfirmOpen(false);
      setExportUrlOverride(saved.icalExportUrl);
      if (createdUnit) {
        setCreatedUnit(saved);
      }
      syncUnitCaches(queryClient, saved, { bookabilityChanged: false });
      handleSuccess(t("inventory:units.form.toastRotated"));
    },
    onError: (error) => {
      handleError(error);
    },
  });

  function onSubmit(values: FormValues) {
    saveMutation.mutate(values);
  }

  async function copyExportUrl() {
    if (!exportUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(exportUrl);
      handleSuccess(t("inventory:units.form.toastLinkCopied"));
    } catch {
      handleError(new Error(t("inventory:units.form.errorCopyFailed")));
    }
  }

  return (
    <>
      <ResponsiveFormShell
        open={open}
        onOpenChange={handleOpenChange}
        title={
          readOnly
            ? t("inventory:units.form.titleView")
            : isEdit
              ? t("inventory:units.form.titleEdit")
              : t("inventory:units.form.titleCreate")
        }
        description={t("inventory:units.form.description")}
        footer={
          readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              {t("inventory:units.form.close")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                }}
              >
                {t("inventory:units.form.cancel")}
              </Button>
              <Button
                type="submit"
                form="unit-form"
                disabled={form.formState.isSubmitting || saveMutation.isPending}
              >
                {isEdit
                  ? t("inventory:units.form.save")
                  : t("inventory:units.form.create")}
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
                    <FieldLabel htmlFor="unit-code">
                      {t("inventory:units.form.fields.code")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="unit-code"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder={t(
                        "inventory:units.form.fields.codePlaceholder",
                      )}
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
                    <FieldLabel htmlFor="unit-name">
                      {t("inventory:units.form.fields.displayName")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="unit-name"
                      aria-invalid={fieldState.invalid || undefined}
                      placeholder={t(
                        "inventory:units.form.fields.displayNamePlaceholder",
                      )}
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
                      <FieldLabel htmlFor="unit-floor">
                        {t("inventory:units.form.fields.floor")}
                      </FieldLabel>
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
                      <FieldLabel>
                        {t("inventory:units.form.fields.status")}
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
                            <SelectItem value={UnitStatus.ACTIVE}>
                              {t("inventory:status.unit.activeBookable")}
                            </SelectItem>
                            <SelectItem value={UnitStatus.INACTIVE}>
                              {t("inventory:status.unit.inactive")}
                            </SelectItem>
                            <SelectItem value={UnitStatus.MAINTENANCE}>
                              {t("inventory:status.unit.maintenance")}
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
                    <FieldLabel htmlFor="unit-notes">
                      {t("inventory:units.form.fields.internalNotes")}
                    </FieldLabel>
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

              <div className="flex flex-col gap-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium">
                    {t("inventory:units.form.calendarsSectionTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("inventory:units.form.calendarsSectionDescription")}
                  </p>
                </div>

                {exportUrl ? (
                  <Field>
                    <FieldLabel htmlFor="unit-ical-export">
                      {t("inventory:units.form.exportLinkLabel")}
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="unit-ical-export"
                        value={exportUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t(
                          "inventory:units.form.copyExportLinkAria",
                        )}
                        onClick={() => {
                          void copyExportUrl();
                        }}
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                      {!readOnly && effectiveUnit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={t(
                            "inventory:units.form.rotateExportLinkAria",
                          )}
                          disabled={rotateMutation.isPending}
                          onClick={() => {
                            setRotateConfirmOpen(true);
                          }}
                        >
                          <RefreshCwIcon className="size-4" />
                        </Button>
                      )}
                    </div>
                    <FieldDescription>
                      {t("inventory:units.form.exportLinkHint")}
                    </FieldDescription>
                  </Field>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("inventory:units.form.exportLinkMissing")}
                  </p>
                )}

                <Controller
                  control={form.control}
                  name="bookingComUrl"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="unit-ical-booking">
                        {t("inventory:units.form.fields.bookingComUrl")}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="unit-ical-booking"
                        aria-invalid={fieldState.invalid || undefined}
                        placeholder={t(
                          "inventory:units.form.fields.urlPlaceholder",
                        )}
                        autoComplete="off"
                        className="font-mono text-xs"
                      />
                      <FieldError errors={[fieldState.error]} />
                      {feedErrorFromUnit(
                        effectiveUnit,
                        UnitIcalFeedSource.BOOKING_COM,
                      ) && (
                        <p className="text-xs text-destructive">
                          {t("inventory:units.form.lastSyncFailed", {
                            error: feedErrorFromUnit(
                              effectiveUnit,
                              UnitIcalFeedSource.BOOKING_COM,
                            ),
                          })}
                        </p>
                      )}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="airbnbUrl"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="unit-ical-airbnb">
                        {t("inventory:units.form.fields.airbnbUrl")}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="unit-ical-airbnb"
                        aria-invalid={fieldState.invalid || undefined}
                        placeholder={t(
                          "inventory:units.form.fields.urlPlaceholder",
                        )}
                        autoComplete="off"
                        className="font-mono text-xs"
                      />
                      <FieldError errors={[fieldState.error]} />
                      {feedErrorFromUnit(
                        effectiveUnit,
                        UnitIcalFeedSource.AIRBNB,
                      ) && (
                        <p className="text-xs text-destructive">
                          {t("inventory:units.form.lastSyncFailed", {
                            error: feedErrorFromUnit(
                              effectiveUnit,
                              UnitIcalFeedSource.AIRBNB,
                            ),
                          })}
                        </p>
                      )}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="agodaUrl"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="unit-ical-agoda">
                        {t("inventory:units.form.fields.agodaUrl")}
                      </FieldLabel>
                      <Input
                        {...field}
                        id="unit-ical-agoda"
                        aria-invalid={fieldState.invalid || undefined}
                        placeholder={t(
                          "inventory:units.form.fields.urlPlaceholder",
                        )}
                        autoComplete="off"
                        className="font-mono text-xs"
                      />
                      <FieldError errors={[fieldState.error]} />
                      {feedErrorFromUnit(
                        effectiveUnit,
                        UnitIcalFeedSource.AGODA,
                      ) && (
                        <p className="text-xs text-destructive">
                          {t("inventory:units.form.lastSyncFailed", {
                            error: feedErrorFromUnit(
                              effectiveUnit,
                              UnitIcalFeedSource.AGODA,
                            ),
                          })}
                        </p>
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>
          </fieldset>
        </form>
      </ResponsiveFormShell>

      <ConfirmDialog
        open={rotateConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (rotateMutation.isPending) {
            return;
          }
          setRotateConfirmOpen(nextOpen);
        }}
        title={t("inventory:units.form.rotateConfirmTitle")}
        description={t("inventory:units.form.rotateConfirmDescription")}
        confirmLabel={t("inventory:units.form.rotateConfirmLabel")}
        cancelLabel={t("inventory:units.form.rotateCancelLabel")}
        variant="destructive"
        confirmDisabled={rotateMutation.isPending}
        onConfirm={() => {
          rotateMutation.mutate();
        }}
      />
    </>
  );
}

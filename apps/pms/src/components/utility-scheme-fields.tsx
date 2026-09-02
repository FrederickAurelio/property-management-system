/* anchor: Linear-dense / Stripe-data settings form, diverge: indented add-on rows */
import {
  UTILITY_ADDON_CONSTANT_IDR_MAX,
  UTILITY_ADDON_MAX_PER_KIND,
  UTILITY_ADDON_PERCENT_MAX,
  UTILITY_METER_VALUE_MAX,
  UtilityAddonKind,
  UtilityKind,
} from "@cabin/api-contract";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DecimalAmountInput } from "@/components/form/decimal-amount-input";
import { IdrAmountInput } from "@/components/form/idr-amount-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type UtilitySchemeFormValues } from "@/components/utility-scheme-form";

const IDR_INPUT_IN_GROUP_CLASS =
  "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent";

function rootFieldError(error: unknown): { message?: string } | undefined {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return { message: (error as { message: string }).message };
  }
  return undefined;
}

function UtilityAddonRow({
  index,
  control,
  setValue,
  readOnly,
  idPrefix,
  onRemove,
}: {
  index: number;
  control: Control<UtilitySchemeFormValues>;
  setValue: UseFormSetValue<UtilitySchemeFormValues>;
  readOnly: boolean;
  idPrefix: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation(["inventory", "common"]);
  const kind = useWatch({
    control,
    name: `utilityAddons.${index}.kind`,
  });
  const currentValue = useWatch({
    control,
    name: `utilityAddons.${index}.value`,
  });
  const isPercent = kind === UtilityAddonKind.PERCENT;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Controller
        control={control}
        name={`utilityAddons.${index}.name`}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 flex-1"
            data-invalid={fieldState.invalid || undefined}
          >
            <FieldLabel htmlFor={`${idPrefix}-addon-name-${index}`}>
              {t("inventory:unitTypes.form.fields.addonName")}
            </FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-addon-name-${index}`}
              aria-invalid={fieldState.invalid || undefined}
              autoComplete="off"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name={`utilityAddons.${index}.kind`}
        render={({ field, fieldState }) => (
          <Field
            className="sm:w-44"
            data-invalid={fieldState.invalid || undefined}
          >
            <FieldLabel id={`${idPrefix}-addon-kind-${index}`}>
              {t("inventory:unitTypes.form.fields.addonKind")}
            </FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={field.value}
              aria-labelledby={`${idPrefix}-addon-kind-${index}`}
              onValueChange={(next) => {
                if (!next) {
                  return;
                }
                const nextKind =
                  next as UtilitySchemeFormValues["utilityAddons"][number]["kind"];
                field.onChange(nextKind);
                if (nextKind === UtilityAddonKind.PERCENT) {
                  const n = Number(currentValue);
                  if (
                    currentValue === "" ||
                    Number.isNaN(n) ||
                    n > UTILITY_ADDON_PERCENT_MAX
                  ) {
                    setValue(`utilityAddons.${index}.value`, "0", {
                      shouldDirty: true,
                    });
                  }
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem
                value={UtilityAddonKind.CONSTANT}
                className="min-h-11 flex-1 sm:min-h-8"
              >
                {t("inventory:unitTypes.form.fields.addonKindConstant")}
              </ToggleGroupItem>
              <ToggleGroupItem
                value={UtilityAddonKind.PERCENT}
                className="min-h-11 flex-1 sm:min-h-8"
              >
                {t("inventory:unitTypes.form.fields.addonKindPercent")}
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name={`utilityAddons.${index}.value`}
        render={({ field, fieldState }) => (
          <Field
            className="min-w-0 flex-1 sm:max-w-48"
            data-invalid={fieldState.invalid || undefined}
          >
            <FieldLabel htmlFor={`${idPrefix}-addon-value-${index}`}>
              {t("inventory:unitTypes.form.fields.addonValue")}
            </FieldLabel>
            <InputGroup>
              {!isPercent && (
                <InputGroupAddon>
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.currencyPrefix")}
                  </InputGroupText>
                </InputGroupAddon>
              )}
              <IdrAmountInput
                id={`${idPrefix}-addon-value-${index}`}
                data-slot="input-group-control"
                placeholder="0"
                className={IDR_INPUT_IN_GROUP_CLASS}
                aria-invalid={fieldState.invalid || undefined}
                max={
                  isPercent
                    ? UTILITY_ADDON_PERCENT_MAX
                    : UTILITY_ADDON_CONSTANT_IDR_MAX
                }
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
              {isPercent && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full sm:mb-0.5 sm:size-8 sm:min-h-8 sm:w-8"
          aria-label={t("inventory:unitTypes.form.fields.removeFee")}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}

function UtilityAddonList({
  utility,
  fields,
  control,
  setValue,
  readOnly,
  idPrefix,
  atCap,
  onAdd,
  onRemove,
}: {
  utility: (typeof UtilityKind)[keyof typeof UtilityKind];
  fields: Array<{
    id: string;
    utility: UtilitySchemeFormValues["utilityAddons"][number]["utility"];
  }>;
  control: Control<UtilitySchemeFormValues>;
  setValue: UseFormSetValue<UtilitySchemeFormValues>;
  readOnly: boolean;
  idPrefix: string;
  atCap: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation(["inventory", "common"]);
  const rows = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.utility === utility);

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <div className="flex flex-col gap-3 border-l border-border pl-4">
          {rows.map(({ field, index }) => (
            <UtilityAddonRow
              key={field.id}
              index={index}
              control={control}
              setValue={setValue}
              readOnly={readOnly}
              idPrefix={idPrefix}
              onRemove={() => {
                onRemove(index);
              }}
            />
          ))}
        </div>
      )}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-fit sm:min-h-7"
          disabled={atCap}
          onClick={onAdd}
        >
          <PlusIcon data-icon="inline-start" />
          {t("inventory:unitTypes.form.fields.addFee")}
        </Button>
      )}
    </div>
  );
}

export function UtilitySchemeFields({
  control,
  setValue,
  readOnly = false,
  idPrefix,
}: {
  control: Control<UtilitySchemeFormValues>;
  setValue: UseFormSetValue<UtilitySchemeFormValues>;
  readOnly?: boolean;
  idPrefix: string;
}) {
  const { t } = useTranslation(["inventory", "common"]);
  const {
    fields: addonFields,
    append: appendAddon,
    remove: removeAddon,
  } = useFieldArray({
    control,
    name: "utilityAddons",
  });
  const watchedAddons = useWatch({
    control,
    name: "utilityAddons",
  });
  const { errors } = useFormState({ control, name: "utilityAddons" });
  const elecAddonCount =
    watchedAddons?.filter((row) => row.utility === UtilityKind.ELECTRICITY)
      .length ?? 0;
  const waterAddonCount =
    watchedAddons?.filter((row) => row.utility === UtilityKind.WATER).length ??
    0;
  const utilityAddonsRootError = rootFieldError(errors.utilityAddons);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          {t("inventory:unitTypes.form.fields.utilityRatesTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("inventory:unitTypes.form.fields.utilityRatesHint")}
        </p>
      </div>

      <FieldSet className="gap-3">
        <FieldLegend variant="label">
          {t("inventory:unitTypes.form.fields.electricity")}
        </FieldLegend>
        <Controller
          control={control}
          name="electricityRateIdrPerKwh"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${idPrefix}-elec-rate`}>
                {t("inventory:unitTypes.form.fields.rate")}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.currencyPrefix")}
                  </InputGroupText>
                </InputGroupAddon>
                <IdrAmountInput
                  id={`${idPrefix}-elec-rate`}
                  data-slot="input-group-control"
                  placeholder="0"
                  className={IDR_INPUT_IN_GROUP_CLASS}
                  aria-invalid={fieldState.invalid || undefined}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.perKwh")}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="electricityMinKwh"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${idPrefix}-elec-min-kwh`}>
                {t("inventory:unitTypes.form.fields.electricityMinKwh")}
              </FieldLabel>
              <InputGroup>
                <DecimalAmountInput
                  id={`${idPrefix}-elec-min-kwh`}
                  data-slot="input-group-control"
                  placeholder="0"
                  className={IDR_INPUT_IN_GROUP_CLASS}
                  aria-invalid={fieldState.invalid || undefined}
                  max={UTILITY_METER_VALUE_MAX}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.kwhUnit")}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <UtilityAddonList
          utility={UtilityKind.ELECTRICITY}
          fields={addonFields}
          control={control}
          setValue={setValue}
          readOnly={readOnly}
          idPrefix={idPrefix}
          atCap={elecAddonCount >= UTILITY_ADDON_MAX_PER_KIND}
          onAdd={() => {
            appendAddon({
              utility: UtilityKind.ELECTRICITY,
              name: "",
              kind: UtilityAddonKind.CONSTANT,
              value: "0",
            });
          }}
          onRemove={removeAddon}
        />
      </FieldSet>

      <FieldSet className="gap-3">
        <FieldLegend variant="label">
          {t("inventory:unitTypes.form.fields.water")}
        </FieldLegend>
        <Controller
          control={control}
          name="waterRateIdrPerM3"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${idPrefix}-water-rate`}>
                {t("inventory:unitTypes.form.fields.rate")}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.currencyPrefix")}
                  </InputGroupText>
                </InputGroupAddon>
                <IdrAmountInput
                  id={`${idPrefix}-water-rate`}
                  data-slot="input-group-control"
                  placeholder="0"
                  className={IDR_INPUT_IN_GROUP_CLASS}
                  aria-invalid={fieldState.invalid || undefined}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.perM3")}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <UtilityAddonList
          utility={UtilityKind.WATER}
          fields={addonFields}
          control={control}
          setValue={setValue}
          readOnly={readOnly}
          idPrefix={idPrefix}
          atCap={waterAddonCount >= UTILITY_ADDON_MAX_PER_KIND}
          onAdd={() => {
            appendAddon({
              utility: UtilityKind.WATER,
              name: "",
              kind: UtilityAddonKind.CONSTANT,
              value: "0",
            });
          }}
          onRemove={removeAddon}
        />
      </FieldSet>

      {utilityAddonsRootError && (
        <Field data-invalid>
          <FieldError errors={[utilityAddonsRootError]} />
        </Field>
      )}

      <FieldSet className="gap-3">
        <FieldLegend variant="label">
          {t("inventory:unitTypes.form.fields.maintenance")}
        </FieldLegend>
        <Controller
          control={control}
          name="maintenanceFeeIdrPerMonth"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${idPrefix}-maint-fee`} className="sr-only">
                {t("inventory:unitTypes.form.fields.maintenance")}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.currencyPrefix")}
                  </InputGroupText>
                </InputGroupAddon>
                <IdrAmountInput
                  id={`${idPrefix}-maint-fee`}
                  data-slot="input-group-control"
                  placeholder="0"
                  className={IDR_INPUT_IN_GROUP_CLASS}
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
      </FieldSet>

      <FieldSet className="gap-3">
        <FieldLegend variant="label">
          {t("inventory:unitTypes.form.fields.adminFee")}
        </FieldLegend>
        <Controller
          control={control}
          name="adminFeeIdrPerMonth"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor={`${idPrefix}-admin-fee`} className="sr-only">
                {t("inventory:unitTypes.form.fields.adminFee")}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>
                    {t("inventory:unitTypes.form.fields.currencyPrefix")}
                  </InputGroupText>
                </InputGroupAddon>
                <IdrAmountInput
                  id={`${idPrefix}-admin-fee`}
                  data-slot="input-group-control"
                  placeholder="0"
                  className={IDR_INPUT_IN_GROUP_CLASS}
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
      </FieldSet>
    </div>
  );
}

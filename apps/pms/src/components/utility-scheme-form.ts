import {
  UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX,
  UNIT_TYPE_UTILITY_RATE_IDR_MAX,
  UTILITY_ADDON_CONSTANT_IDR_MAX,
  UTILITY_ADDON_MAX_PER_KIND,
  UTILITY_ADDON_NAME_MAX,
  UTILITY_ADDON_PERCENT_MAX,
  UTILITY_ADDON_PERCENT_MIN,
  UTILITY_METER_FRACTION_DIGITS,
  UTILITY_METER_VALUE_MAX,
  UtilityAddonKind,
  UtilityKind,
  type UtilitySchemeSnapshot,
} from "@cabin/api-contract";
import type { TFunction } from "i18next";
import { z } from "zod";

export type UtilitySchemeFormValues = {
  electricityRateIdrPerKwh: string;
  waterRateIdrPerM3: string;
  maintenanceFeeIdrPerMonth: string;
  electricityMinKwh: string;
  adminFeeIdrPerMonth: string;
  utilityAddons: Array<{
    utility: (typeof UtilityKind)[keyof typeof UtilityKind];
    name: string;
    kind: (typeof UtilityAddonKind)[keyof typeof UtilityAddonKind];
    value: string;
  }>;
};

export function utilitySchemeZodFields(t: TFunction) {
  return {
    electricityRateIdrPerKwh: z.string().trim(),
    waterRateIdrPerM3: z.string().trim(),
    maintenanceFeeIdrPerMonth: z.string().trim(),
    electricityMinKwh: z.string().trim(),
    adminFeeIdrPerMonth: z.string().trim(),
    utilityAddons: z.array(
      z
        .object({
          utility: z.enum([UtilityKind.ELECTRICITY, UtilityKind.WATER]),
          name: z
            .string()
            .trim()
            .min(1, t("inventory:unitTypes.form.zod.addonNameRequired"))
            .max(
              UTILITY_ADDON_NAME_MAX,
              t("inventory:unitTypes.form.zod.addonNameMax"),
            ),
          kind: z.enum([UtilityAddonKind.CONSTANT, UtilityAddonKind.PERCENT]),
          value: z.string().trim(),
        })
        .superRefine((row, ctx) => {
          const n = Number(row.value);
          if (row.kind === UtilityAddonKind.PERCENT) {
            if (
              row.value === "" ||
              Number.isNaN(n) ||
              !Number.isInteger(n) ||
              n < UTILITY_ADDON_PERCENT_MIN ||
              n > UTILITY_ADDON_PERCENT_MAX
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["value"],
                message: t("inventory:unitTypes.form.zod.addonPercentRange"),
              });
            }
            return;
          }
          if (
            row.value === "" ||
            Number.isNaN(n) ||
            !Number.isInteger(n) ||
            n < 0 ||
            n > UTILITY_ADDON_CONSTANT_IDR_MAX
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["value"],
              message: t("inventory:unitTypes.form.zod.addonConstantRange"),
            });
          }
        }),
    ),
  };
}

export function refineUtilitySchemeFormValues(
  values: UtilitySchemeFormValues,
  ctx: z.RefinementCtx,
  t: TFunction,
): void {
  const elec = Number(values.electricityRateIdrPerKwh);
  if (
    values.electricityRateIdrPerKwh === "" ||
    Number.isNaN(elec) ||
    !Number.isInteger(elec) ||
    elec < 0 ||
    elec > UNIT_TYPE_UTILITY_RATE_IDR_MAX
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["electricityRateIdrPerKwh"],
      message: t("inventory:unitTypes.form.zod.utilityRateRange"),
    });
  }
  const water = Number(values.waterRateIdrPerM3);
  if (
    values.waterRateIdrPerM3 === "" ||
    Number.isNaN(water) ||
    !Number.isInteger(water) ||
    water < 0 ||
    water > UNIT_TYPE_UTILITY_RATE_IDR_MAX
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["waterRateIdrPerM3"],
      message: t("inventory:unitTypes.form.zod.utilityRateRange"),
    });
  }
  const maint = Number(values.maintenanceFeeIdrPerMonth);
  if (
    values.maintenanceFeeIdrPerMonth === "" ||
    Number.isNaN(maint) ||
    !Number.isInteger(maint) ||
    maint < 0 ||
    maint > UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maintenanceFeeIdrPerMonth"],
      message: t("inventory:unitTypes.form.zod.maintenanceFeeRange"),
    });
  }
  const minKwh = Number(values.electricityMinKwh);
  const minKwhFraction = values.electricityMinKwh.split(".")[1];
  if (
    values.electricityMinKwh === "" ||
    values.electricityMinKwh === "." ||
    Number.isNaN(minKwh) ||
    minKwh < 0 ||
    minKwh > UTILITY_METER_VALUE_MAX ||
    (minKwhFraction != null &&
      minKwhFraction.length > UTILITY_METER_FRACTION_DIGITS)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["electricityMinKwh"],
      message: t("inventory:unitTypes.form.zod.electricityMinKwhRange"),
    });
  }
  const admin = Number(values.adminFeeIdrPerMonth);
  if (
    values.adminFeeIdrPerMonth === "" ||
    Number.isNaN(admin) ||
    !Number.isInteger(admin) ||
    admin < 0 ||
    admin > UNIT_TYPE_MAINTENANCE_FEE_IDR_MAX
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["adminFeeIdrPerMonth"],
      message: t("inventory:unitTypes.form.zod.maintenanceFeeRange"),
    });
  }
  const elecAddonCount = values.utilityAddons.filter(
    (row) => row.utility === UtilityKind.ELECTRICITY,
  ).length;
  const waterAddonCount = values.utilityAddons.filter(
    (row) => row.utility === UtilityKind.WATER,
  ).length;
  if (
    elecAddonCount > UTILITY_ADDON_MAX_PER_KIND ||
    waterAddonCount > UTILITY_ADDON_MAX_PER_KIND
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["utilityAddons"],
      message: t("inventory:unitTypes.form.zod.addonLimit"),
    });
  }
}

export function emptyUtilitySchemeFormValues(): UtilitySchemeFormValues {
  return {
    electricityRateIdrPerKwh: "0",
    waterRateIdrPerM3: "0",
    maintenanceFeeIdrPerMonth: "0",
    electricityMinKwh: "0",
    adminFeeIdrPerMonth: "0",
    utilityAddons: [],
  };
}

export function utilitySchemeFormValuesFromSnapshot(
  scheme: UtilitySchemeSnapshot,
): UtilitySchemeFormValues {
  return {
    electricityRateIdrPerKwh: String(scheme.electricityRateIdrPerKwh),
    waterRateIdrPerM3: String(scheme.waterRateIdrPerM3),
    maintenanceFeeIdrPerMonth: String(scheme.maintenanceFeeIdrPerMonth),
    electricityMinKwh: String(scheme.electricityMinKwh ?? 0),
    adminFeeIdrPerMonth: String(scheme.adminFeeIdrPerMonth ?? 0),
    utilityAddons: scheme.utilityAddons.map((addon) => ({
      utility: addon.utility,
      name: addon.name,
      kind: addon.kind,
      value: String(addon.value),
    })),
  };
}

export function utilitySchemeSnapshotFromFormValues(
  values: UtilitySchemeFormValues,
): UtilitySchemeSnapshot {
  const nextIndex: Record<string, number> = {
    [UtilityKind.ELECTRICITY]: 0,
    [UtilityKind.WATER]: 0,
  };
  return {
    electricityRateIdrPerKwh: Number(values.electricityRateIdrPerKwh),
    waterRateIdrPerM3: Number(values.waterRateIdrPerM3),
    maintenanceFeeIdrPerMonth: Number(values.maintenanceFeeIdrPerMonth),
    electricityMinKwh: Number(values.electricityMinKwh),
    adminFeeIdrPerMonth: Number(values.adminFeeIdrPerMonth),
    utilityAddons: values.utilityAddons.map((row) => {
      const sortOrder = nextIndex[row.utility] ?? 0;
      nextIndex[row.utility] = sortOrder + 1;
      return {
        utility: row.utility,
        name: row.name.trim(),
        kind: row.kind,
        value: Number(row.value),
        sortOrder,
      };
    }),
  };
}

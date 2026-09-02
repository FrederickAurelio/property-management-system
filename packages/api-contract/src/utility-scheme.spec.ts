import { describe, expect, it } from "vitest";
import {
  UtilityAddonKind,
  UtilityKind,
  lookupUtilityPeriodScheme,
  resolveUtilitySchemeSnapshot,
} from "./reservations.js";

const elecAddons = [
  {
    utility: UtilityKind.ELECTRICITY,
    name: "PJU",
    kind: UtilityAddonKind.PERCENT,
    value: 10,
    sortOrder: 0,
  },
];

describe("resolveUtilitySchemeSnapshot", () => {
  it("returns frozen reservation scheme when utilityAddons is non-empty", () => {
    expect(
      resolveUtilitySchemeSnapshot(
        {
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: elecAddons,
        },
        {
          electricityMinKwh: 99,
          adminFeeIdrPerMonth: 1,
          utilityAddons: [],
        },
      ),
    ).toEqual({
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 52,
      adminFeeIdrPerMonth: 6_500,
      utilityAddons: elecAddons,
    });
  });

  it("falls back to unit type when snapshot add-ons are empty", () => {
    expect(
      resolveUtilitySchemeSnapshot(
        {
          electricityMinKwh: 0,
          adminFeeIdrPerMonth: 0,
          utilityAddons: [],
        },
        {
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: elecAddons,
        },
      ),
    ).toEqual({
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 52,
      adminFeeIdrPerMonth: 6_500,
      utilityAddons: elecAddons,
    });
  });

  it("keeps non-zero reservation min kWh and admin when snapshot add-ons empty", () => {
    expect(
      resolveUtilitySchemeSnapshot(
        {
          electricityMinKwh: 40,
          adminFeeIdrPerMonth: 5_000,
          utilityAddons: [],
        },
        {
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: elecAddons,
        },
      ),
    ).toEqual({
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 40,
      adminFeeIdrPerMonth: 5_000,
      utilityAddons: elecAddons,
    });
  });

  it("returns reservation zeros when unit type is missing", () => {
    expect(
      resolveUtilitySchemeSnapshot({
        electricityMinKwh: 0,
        adminFeeIdrPerMonth: 0,
        utilityAddons: [],
      }),
    ).toEqual({
      electricityRateIdrPerKwh: 0,
      waterRateIdrPerM3: 0,
      maintenanceFeeIdrPerMonth: 0,
      electricityMinKwh: 0,
      adminFeeIdrPerMonth: 0,
      utilityAddons: [],
    });
  });

  it("keeps reservation rates on the stay-level snapshot", () => {
    expect(
      resolveUtilitySchemeSnapshot(
        {
          electricityRateIdrPerKwh: 1750,
          waterRateIdrPerM3: 7000,
          maintenanceFeeIdrPerMonth: 50_000,
          electricityMinKwh: 52,
          adminFeeIdrPerMonth: 6_500,
          utilityAddons: elecAddons,
        },
        {
          electricityRateIdrPerKwh: 1850,
          electricityMinKwh: 99,
          adminFeeIdrPerMonth: 1,
          utilityAddons: [],
        },
      ),
    ).toMatchObject({
      electricityRateIdrPerKwh: 1750,
      waterRateIdrPerM3: 7000,
      maintenanceFeeIdrPerMonth: 50_000,
    });
  });
});

describe("lookupUtilityPeriodScheme", () => {
  const fallback = resolveUtilitySchemeSnapshot({
    electricityRateIdrPerKwh: 1750,
    electricityMinKwh: 52,
    adminFeeIdrPerMonth: 6_500,
    utilityAddons: elecAddons,
  });

  it("returns the matching month card", () => {
    const june = {
      ...fallback,
      chargeYearMonth: "2026-06",
      electricityRateIdrPerKwh: 1850,
    };
    expect(
      lookupUtilityPeriodScheme(
        [{ ...fallback, chargeYearMonth: "2026-05" }, june],
        "2026-06",
        fallback,
      ).electricityRateIdrPerKwh,
    ).toBe(1850);
  });

  it("clones fallback when the month is missing", () => {
    const found = lookupUtilityPeriodScheme([], "2026-06", fallback);
    expect(found.electricityRateIdrPerKwh).toBe(1750);
    found.electricityRateIdrPerKwh = 1;
    expect(fallback.electricityRateIdrPerKwh).toBe(1750);
  });
});

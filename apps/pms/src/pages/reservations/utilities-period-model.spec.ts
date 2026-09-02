import {
  UtilityAddonKind,
  UtilityKind,
  type UtilitySchemeSnapshot,
} from "@cabin/api-contract";
import { describe, expect, it } from "vitest";
import {
  addPeriod,
  applyPeriodScheme,
  deletePeriod,
  flattenPeriods,
  patchPeriod,
  periodKindPreview,
  periodSubtotalIdr,
  seedPeriods,
  type SeedUtilitiesInput,
} from "./utilities-period-model";

function keys(): () => string {
  let n = 0;
  return () => `k${++n}`;
}

function fallbackScheme(
  overrides: Partial<UtilitySchemeSnapshot> = {},
): UtilitySchemeSnapshot {
  return {
    electricityRateIdrPerKwh: 0,
    waterRateIdrPerM3: 0,
    maintenanceFeeIdrPerMonth: 50_000,
    electricityMinKwh: 0,
    adminFeeIdrPerMonth: 6_500,
    utilityAddons: [],
    ...overrides,
  };
}

function seed(
  input: Partial<SeedUtilitiesInput> & { checkInDate?: string } = {},
) {
  return seedPeriods(
    {
      checkInDate: "2026-05-10",
      fallbackScheme: fallbackScheme(),
      ...input,
    },
    { createKey: keys() },
  );
}

describe("seedPeriods", () => {
  it("seeds one draft period for a new stay", () => {
    const periods = seed();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      startDate: "2026-05-10",
      endDate: "2026-06-01",
      chargeYearMonth: "2026-06",
      amountDigits: "50000",
      adminDigits: "6500",
      elecStart: { meterDigits: "" },
      elecEnd: { meterDigits: "" },
    });
  });

  it("seeds the first draft from the stay fallback, not a later type edit", () => {
    const periods = seed({
      fallbackScheme: fallbackScheme({ electricityRateIdrPerKwh: 1750 }),
    });
    expect(periods[0]?.scheme.electricityRateIdrPerKwh).toBe(1750);
    expect(periods[0]?.amountDigits).toBe("50000");
  });

  it("matches stored period schemes by billed month", () => {
    const may = fallbackScheme({ electricityRateIdrPerKwh: 1750 });
    const june = fallbackScheme({ electricityRateIdrPerKwh: 1850 });
    const periods = seed({
      fallbackScheme: fallbackScheme({ electricityRateIdrPerKwh: 9999 }),
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 1000,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 1100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-07-01",
          meterValue: 1200,
        },
      ],
      utilityPeriodSchemes: [
        { chargeYearMonth: "2026-06", ...may },
        { chargeYearMonth: "2026-07", ...june },
      ],
    });
    expect(periods).toHaveLength(2);
    expect(periods[0]?.scheme.electricityRateIdrPerKwh).toBe(1750);
    expect(periods[1]?.scheme.electricityRateIdrPerKwh).toBe(1850);
  });

  it("does not prefill maintenance when opening meters already exist", () => {
    const periods = seed({
      utilityReadings: [
        {
          id: "e0",
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          id: "w0",
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
      ],
    });
    expect(periods).toHaveLength(1);
    expect(periods[0]?.elecStart.meterDigits).toBe("100");
    expect(periods[0]?.waterStart.meterDigits).toBe("10");
    expect(periods[0]?.endDate).toBe("2026-06-01");
    expect(periods[0]?.elecEnd.meterDigits).toBe("");
    expect(periods[0]?.amountDigits).toBe("");
    expect(periods[0]?.adminDigits).toBe("");
  });

  it("zips remaining readings into chained periods", () => {
    const periods = seed({
      utilityReadings: [
        {
          id: "e0",
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          id: "e1",
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 150.5,
        },
        {
          id: "e2",
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-07-01",
          meterValue: 200,
        },
        {
          id: "w0",
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
        {
          id: "w1",
          utility: UtilityKind.WATER,
          readingDate: "2026-06-01",
          meterValue: 12,
        },
        {
          id: "w2",
          utility: UtilityKind.WATER,
          readingDate: "2026-07-01",
          meterValue: 14,
        },
      ],
      maintenanceCharges: [
        { id: "m0", chargeDate: "2026-06-01", amountIdr: 50_000 },
        { id: "m1", chargeDate: "2026-07-01", amountIdr: 50_000 },
      ],
    });
    expect(periods).toHaveLength(2);
    expect(periods[0]?.startDate).toBe("2026-05-10");
    expect(periods[0]?.endDate).toBe("2026-06-01");
    expect(periods[0]?.elecEnd.meterDigits).toBe("150.5");
    expect(periods[1]?.startDate).toBe("2026-06-01");
    expect(periods[1]?.elecStart.meterDigits).toBe("150.5");
    expect(periods[1]?.endDate).toBe("2026-07-01");
    expect(periods[1]?.elecEnd.meterDigits).toBe("200");
    expect(periods[1]?.chargeYearMonth).toBe("2026-07");
  });

  it("uses electricity date when elec and water end dates differ", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 1,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 2,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 8,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-06-03",
          meterValue: 9,
        },
      ],
    });
    expect(periods).toHaveLength(1);
    expect(periods[0]?.endDate).toBe("2026-06-01");
    expect(periods[0]?.waterEnd.meterDigits).toBe("9");
  });

  it("adds extra periods for leftover maintenance months", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 120,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-06-01",
          meterValue: 11,
        },
      ],
      maintenanceCharges: [
        { chargeDate: "2026-06-01", amountIdr: 40_000 },
        { chargeDate: "2026-07-01", amountIdr: 41_000 },
      ],
    });
    expect(periods).toHaveLength(2);
    expect(periods[1]?.elecEnd.meterDigits).toBe("");
    expect(periods[1]?.endDate).toBe("2026-07-01");
    expect(periods[1]?.chargeYearMonth).toBe("2026-07");
    expect(periods[1]?.amountDigits).toBe("41000");
    expect(periods[1]?.elecStart.meterDigits).toBe("120");
  });
});

describe("flattenPeriods", () => {
  it("emits opening + each end and skips empty meters", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 150,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
      ],
      maintenanceCharges: [{ chargeDate: "2026-06-01", amountIdr: 50_000 }],
    });
    const flat = flattenPeriods(periods);
    expect(flat.electricityReadings.map((r) => r.readingDate)).toEqual([
      "2026-05-10",
      "2026-06-01",
    ]);
    expect(flat.waterReadings.map((r) => r.readingDate)).toEqual([
      "2026-05-10",
    ]);
    expect(flat.maintenanceCharges).toEqual([
      { chargeDate: "2026-06-01", amountIdr: 50_000 },
    ]);
    expect(flat.adminCharges).toEqual([]);
    expect(flat.periodSchemes).toEqual([
      expect.objectContaining({
        chargeYearMonth: "2026-06",
        maintenanceFeeIdrPerMonth: 50_000,
      }),
    ]);
  });

  it("writes the same end date onto both meter kinds", () => {
    const periods = seed();
    const patched = patchPeriod(periods, 0, {
      elecStart: { meterDigits: "10", proofImages: [] },
      waterStart: { meterDigits: "1", proofImages: [] },
      elecEnd: { meterDigits: "12", proofImages: [] },
      waterEnd: { meterDigits: "2", proofImages: [] },
    });
    const flat = flattenPeriods(patched);
    expect(flat.electricityReadings[1]?.readingDate).toBe("2026-06-01");
    expect(flat.waterReadings[1]?.readingDate).toBe("2026-06-01");
  });
});

describe("addPeriod / deletePeriod / patchPeriod", () => {
  it("copies previous end meters onto the next period start and end prefill", () => {
    const first = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 150,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-06-01",
          meterValue: 12,
        },
      ],
    });
    const next = addPeriod(first, {
      scheme: fallbackScheme(),
      createKey: () => "new",
    });
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      key: "new",
      startDate: "2026-06-01",
      endDate: "2026-07-01",
      chargeYearMonth: "2026-07",
      amountDigits: "50000",
      adminDigits: "6500",
      elecStart: { meterDigits: "150" },
      elecEnd: { meterDigits: "150", proofImages: [] },
      waterStart: { meterDigits: "12" },
      scheme: expect.objectContaining({ electricityRateIdrPerKwh: 0 }),
    });
  });

  it("copies the live unit-type scheme onto a new period only", () => {
    const first = seed({
      fallbackScheme: fallbackScheme({ electricityRateIdrPerKwh: 1750 }),
    });
    const next = addPeriod(first, {
      scheme: fallbackScheme({
        electricityRateIdrPerKwh: 1850,
        maintenanceFeeIdrPerMonth: 60_000,
      }),
      createKey: () => "new",
    });
    expect(next[0]?.scheme.electricityRateIdrPerKwh).toBe(1750);
    expect(next[1]?.scheme.electricityRateIdrPerKwh).toBe(1850);
    expect(next[1]?.amountDigits).toBe("60000");
  });

  it("keeps opening meters when deleting the first period", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 150,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-07-01",
          meterValue: 200,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-06-01",
          meterValue: 12,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-07-01",
          meterValue: 14,
        },
      ],
    });
    const next = deletePeriod(periods, 0);
    expect(next).toHaveLength(1);
    expect(next[0]?.startDate).toBe("2026-05-10");
    expect(next[0]?.elecStart.meterDigits).toBe("100");
    expect(next[0]?.endDate).toBe("2026-07-01");
    expect(next[0]?.elecEnd.meterDigits).toBe("200");
  });

  it("rechains starts after deleting a middle period", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 150,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-07-01",
          meterValue: 200,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-08-01",
          meterValue: 250,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-05-10",
          meterValue: 10,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-06-01",
          meterValue: 12,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-07-01",
          meterValue: 14,
        },
        {
          utility: UtilityKind.WATER,
          readingDate: "2026-08-01",
          meterValue: 16,
        },
      ],
    });
    const next = deletePeriod(periods, 1);
    expect(next).toHaveLength(2);
    expect(next[1]?.startDate).toBe("2026-06-01");
    expect(next[1]?.elecStart.meterDigits).toBe("150");
    expect(next[1]?.endDate).toBe("2026-08-01");
    expect(next[1]?.elecEnd.meterDigits).toBe("250");
  });

  it("keeps at least one period", () => {
    const periods = seed();
    expect(deletePeriod(periods, 0)).toEqual(periods);
  });

  it("updates the next period start when an end meter changes", () => {
    const periods = addPeriod(seed(), { createKey: () => "p2" });
    const next = patchPeriod(periods, 0, {
      elecEnd: { meterDigits: "333", proofImages: [] },
      endDate: "2026-06-15",
    });
    expect(next[1]?.startDate).toBe("2026-06-15");
    expect(next[1]?.elecStart.meterDigits).toBe("333");
    expect(next[1]?.endDate).toBe("2026-07-01");
  });
});

describe("admin charges + kind preview", () => {
  it("zips and flattens admin digits like maintenance", () => {
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 1000,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 1023,
        },
      ],
      maintenanceCharges: [{ chargeDate: "2026-06-01", amountIdr: 50_000 }],
      adminCharges: [{ chargeDate: "2026-06-01", amountIdr: 6_500 }],
    });
    expect(periods[0]?.adminDigits).toBe("6500");
    expect(flattenPeriods(periods).adminCharges).toEqual([
      { chargeDate: "2026-06-01", amountIdr: 6_500 },
    ]);
  });

  it("periodKindPreview bills min kWh and add-ons; meters stay actual", () => {
    const addons = [
      {
        utility: UtilityKind.ELECTRICITY,
        name: "PJU",
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        sortOrder: 0,
      },
      {
        utility: UtilityKind.ELECTRICITY,
        name: "Admin PLN",
        kind: UtilityAddonKind.CONSTANT,
        value: 5_000,
        sortOrder: 1,
      },
    ];
    const start = { meterDigits: "1000", proofImages: [] };
    const end = { meterDigits: "1023", proofImages: [] };
    const preview = periodKindPreview(
      start,
      end,
      "2026-05-10",
      "2026-06-01",
      1700,
      addons,
      { minBilledUnits: 52 },
    );
    expect(preview.usage).toBe(23);
    expect(preview.billedUnits).toBe(52);
    expect(preview.minApplied).toBe(true);
    const usageRp = Math.floor(52 * 1700);
    expect(preview.usageAmountIdr).toBe(usageRp);
    expect(preview.kindTotalIdr).toBe(
      usageRp + Math.floor((usageRp * 10) / 100) + 5_000,
    );
    expect(end.meterDigits).toBe("1023");

    const period = applyPeriodScheme(
      seed({
        utilityReadings: [
          {
            utility: UtilityKind.ELECTRICITY,
            readingDate: "2026-05-10",
            meterValue: 1000,
          },
          {
            utility: UtilityKind.ELECTRICITY,
            readingDate: "2026-06-01",
            meterValue: 1023,
          },
        ],
        maintenanceCharges: [{ chargeDate: "2026-06-01", amountIdr: 50_000 }],
        adminCharges: [{ chargeDate: "2026-06-01", amountIdr: 6_500 }],
      })[0]!,
      {
        electricityRateIdrPerKwh: 1700,
        waterRateIdrPerM3: 0,
        electricityMinKwh: 52,
        maintenanceFeeIdrPerMonth: 50_000,
        adminFeeIdrPerMonth: 6_500,
        utilityAddons: addons,
      },
    );
    expect(periodSubtotalIdr(period)).toBe(
      (preview.kindTotalIdr ?? 0) + 50_000 + 6_500,
    );
  });

  it("keeps May preview at 1750 when June is 1850", () => {
    const may = fallbackScheme({ electricityRateIdrPerKwh: 1750 });
    const june = fallbackScheme({ electricityRateIdrPerKwh: 1850 });
    const periods = seed({
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-05-10",
          meterValue: 1000,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-06-01",
          meterValue: 1100,
        },
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: "2026-07-01",
          meterValue: 1200,
        },
      ],
      maintenanceCharges: [
        { chargeDate: "2026-06-01", amountIdr: 50_000 },
        { chargeDate: "2026-07-01", amountIdr: 50_000 },
      ],
      utilityPeriodSchemes: [
        { chargeYearMonth: "2026-06", ...may },
        { chargeYearMonth: "2026-07", ...june },
      ],
    });
    expect(periodSubtotalIdr(periods[0]!)).toBe(
      Math.floor(100 * 1750) + 50_000,
    );
    expect(periodSubtotalIdr(periods[1]!)).toBe(
      Math.floor(100 * 1850) + 50_000,
    );
    const flat = flattenPeriods(periods);
    expect(
      flat.periodSchemes.map((row) => row.electricityRateIdrPerKwh),
    ).toEqual([1750, 1850]);
  });
});

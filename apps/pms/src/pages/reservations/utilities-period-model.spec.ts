import { UtilityKind } from "@cabin/api-contract";
import { describe, expect, it } from "vitest";
import {
  addPeriod,
  deletePeriod,
  flattenPeriods,
  patchPeriod,
  seedPeriods,
  type SeedUtilitiesInput,
} from "./utilities-period-model";

function keys(): () => string {
  let n = 0;
  return () => `k${++n}`;
}

function seed(
  input: Partial<SeedUtilitiesInput> & { checkInDate?: string } = {},
) {
  return seedPeriods(
    {
      checkInDate: "2026-05-10",
      maintenanceFeeIdrPerMonth: 50_000,
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
      elecStart: { meterDigits: "" },
      elecEnd: { meterDigits: "" },
    });
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
      maintenanceFeeIdrPerMonth: 50_000,
      createKey: () => "new",
    });
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      key: "new",
      startDate: "2026-06-01",
      endDate: "2026-07-01",
      chargeYearMonth: "2026-07",
      amountDigits: "50000",
      elecStart: { meterDigits: "150" },
      elecEnd: { meterDigits: "150", proofImages: [] },
      waterStart: { meterDigits: "12" },
    });
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

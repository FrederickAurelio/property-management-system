import { describe, expect, it } from "vitest";
import {
  activePresetId,
  defaultMonthToDate,
  rangeForPreset,
} from "./reports-period";

describe("reports-period presets", () => {
  const today = "2026-08-10";

  it("MTD ends on injected today", () => {
    expect(defaultMonthToDate(today)).toEqual({
      from: "2026-08-01",
      to: "2026-08-10",
    });
  });

  it("activePresetId detects MTD for fixed today", () => {
    const r = rangeForPreset("mtd", today);
    expect(activePresetId(r.from, r.to, today)).toBe("mtd");
  });

  it("custom range is not a preset", () => {
    expect(activePresetId("2026-08-02", "2026-08-05", today)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { ymdInclusiveToUtcHalfOpen } from "./reports-period.js";
import {
  DEFAULT_PROPERTY_TIMEZONE,
  todayYmdInTimezone,
  ymdInTimezone,
} from "./reservations.js";

describe("todayYmdInTimezone / ymdInTimezone", () => {
  it("Jakarta date at UTC evening boundary", () => {
    const instant = new Date("2026-08-09T18:00:00.000Z");
    expect(todayYmdInTimezone("Asia/Jakarta", instant)).toBe("2026-08-10");
    expect(ymdInTimezone(instant, "Asia/Jakarta")).toBe("2026-08-10");
  });

  it("falls back to UTC ISO slice for invalid IANA", () => {
    const instant = new Date("2026-08-10T12:00:00.000Z");
    expect(todayYmdInTimezone("Not/AZone", instant)).toBe("2026-08-10");
  });

  it("DEFAULT_PROPERTY_TIMEZONE is Asia/Jakarta", () => {
    expect(DEFAULT_PROPERTY_TIMEZONE).toBe("Asia/Jakarta");
  });
});

describe("ymdInclusiveToUtcHalfOpen", () => {
  it("America/New_York single day (EDT)", () => {
    const { start, endExclusive } = ymdInclusiveToUtcHalfOpen(
      "2026-07-04",
      "2026-07-04",
      "America/New_York",
    );
    expect(start.toISOString()).toBe("2026-07-04T04:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-07-05T04:00:00.000Z");
  });
});

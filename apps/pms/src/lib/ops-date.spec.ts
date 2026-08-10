import { describe, expect, it } from "vitest";
import {
  calendarOpsProps,
  opsTodayYmd,
  resolvePropertyTimezone,
} from "./ops-date";

describe("resolvePropertyTimezone", () => {
  it("returns property timezone or Jakarta fallback", () => {
    const props = [{ id: "p1", timezone: "Asia/Makassar" }];
    expect(resolvePropertyTimezone(props, "p1")).toBe("Asia/Makassar");
    expect(resolvePropertyTimezone(props, "missing")).toBe("Asia/Jakarta");
  });
});

describe("opsTodayYmd", () => {
  it("uses injected now", () => {
    const instant = new Date("2026-08-09T18:00:00.000Z");
    expect(opsTodayYmd("Asia/Jakarta", instant)).toBe("2026-08-10");
  });
});

describe("calendarOpsProps", () => {
  it("returns timeZone and a Date for today", () => {
    const props = calendarOpsProps("Asia/Makassar");
    expect(props.timeZone).toBe("Asia/Makassar");
    expect(props.today).toBeInstanceOf(Date);
  });
});

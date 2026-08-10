import { describe, expect, it } from "vitest";
import { formatMovementCreatedAt } from "./reservation-format";

describe("formatMovementCreatedAt", () => {
  const iso = "2026-08-10T14:30:00.000Z";

  it("formats in property timezone", () => {
    const formatted = formatMovementCreatedAt(iso, "Asia/Jakarta");
    expect(formatted).toMatch(/2026/);
    expect(formatted.length).toBeGreaterThan(8);
  });

  it("does not throw on invalid IANA timezone", () => {
    expect(() => formatMovementCreatedAt(iso, "Not/AZone")).not.toThrow();
    const formatted = formatMovementCreatedAt(iso, "Not/AZone");
    expect(formatted).toMatch(/2026/);
  });

  it("returns raw iso for unparseable input", () => {
    expect(formatMovementCreatedAt("not-a-date", "Asia/Jakarta")).toBe(
      "not-a-date",
    );
  });
});

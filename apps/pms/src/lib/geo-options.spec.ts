import { describe, expect, it } from "vitest";
import {
  getCountryOptions,
  getTimezoneOptions,
  isValidCountryCode,
  isValidIanaTimezone,
} from "./geo-options";

describe("geo-options", () => {
  it("validates IANA timezone", () => {
    expect(isValidIanaTimezone("Asia/Jakarta")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });

  it("validates ISO country code", () => {
    expect(isValidCountryCode("ID")).toBe(true);
    expect(isValidCountryCode("XX")).toBe(false);
  });

  it("pins Indonesia first in country list", () => {
    const options = getCountryOptions("en");
    expect(options[0]?.value).toBe("ID");
    expect(options[0]?.label).toContain("Indonesia");
  });

  it("pins Indonesia timezones first", () => {
    const options = getTimezoneOptions("en");
    expect(options[0]?.value).toBe("Asia/Jakarta");
    expect(options.some((o) => o.value === "Asia/Makassar")).toBe(true);
    expect(options.some((o) => o.value === "Asia/Jayapura")).toBe(true);
  });

  it("includes legacy timezone not in supported list", () => {
    const options = getTimezoneOptions("en", ["Legacy/Zone"]);
    expect(options[0]?.value).toBe("Legacy/Zone");
  });
});

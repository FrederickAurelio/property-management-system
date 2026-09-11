import { describe, expect, it } from "vitest";
import {
  columnOverlayStyle,
  dayIndexFromClientX,
  dragOverlayStyle,
} from "./calendar-layout";

describe("dayIndexFromClientX", () => {
  const left = 100;
  const width = 1400;
  const days = 14;

  it("clamps to the first and last columns", () => {
    expect(dayIndexFromClientX(left, left, width, days)).toBe(0);
    expect(dayIndexFromClientX(left - 20, left, width, days)).toBe(0);
    expect(dayIndexFromClientX(left + width, left, width, days)).toBe(13);
    expect(dayIndexFromClientX(left + width + 50, left, width, days)).toBe(13);
  });

  it("maps the middle of a column to that index", () => {
    const col = width / days;
    expect(dayIndexFromClientX(left + col * 3.5, left, width, days)).toBe(3);
    expect(dayIndexFromClientX(left + col * 13.01, left, width, days)).toBe(13);
  });

  it("returns 0 when the track has no width or days", () => {
    expect(dayIndexFromClientX(150, left, 0, days)).toBe(0);
    expect(dayIndexFromClientX(150, left, width, 0)).toBe(0);
  });
});

describe("columnOverlayStyle", () => {
  it("returns percent boxes for a half-open span", () => {
    expect(columnOverlayStyle(0, 1, 14)).toEqual({
      left: `${(0 / 14) * 100}%`,
      width: `${(1 / 14) * 100}%`,
    });
    expect(columnOverlayStyle(2, 5, 10)).toEqual({
      left: "20%",
      width: "30%",
    });
  });

  it("returns null for empty or inverted spans", () => {
    expect(columnOverlayStyle(3, 3, 14)).toBeNull();
    expect(columnOverlayStyle(5, 2, 14)).toBeNull();
    expect(columnOverlayStyle(0, 1, 0)).toBeNull();
  });
});

describe("dragOverlayStyle", () => {
  const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];

  it("covers inclusive hover in either drag direction", () => {
    expect(
      dragOverlayStyle(
        { anchorYmd: "2026-09-02", hoverYmd: "2026-09-04" },
        days,
      ),
    ).toEqual({ left: "25%", width: "75%" });
    expect(
      dragOverlayStyle(
        { anchorYmd: "2026-09-04", hoverYmd: "2026-09-02" },
        days,
      ),
    ).toEqual({ left: "25%", width: "75%" });
  });

  it("returns null when a drag day is outside the window", () => {
    expect(
      dragOverlayStyle(
        { anchorYmd: "2026-08-31", hoverYmd: "2026-09-02" },
        days,
      ),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { ReservationSource } from "@cabin/api-contract";
import {
  otaRefreshImportsChecklist,
  peerOtaSources,
} from "./ota-remind";

describe("peerOtaSources", () => {
  it("excludes booking source when confirming an OTA stay", () => {
    expect(peerOtaSources(ReservationSource.BOOKING_COM)).toEqual([
      ReservationSource.AIRBNB,
      ReservationSource.AGODA,
    ]);
  });

  it("lists all OTA channels for walk-in", () => {
    expect(peerOtaSources(ReservationSource.MANUAL)).toEqual([
      ReservationSource.BOOKING_COM,
      ReservationSource.AIRBNB,
      ReservationSource.AGODA,
    ]);
  });
});

describe("otaRefreshImportsChecklist", () => {
  it("confirm on Booking.com omits Booking.com from peer steps", () => {
    const { steps } = otaRefreshImportsChecklist({
      trigger: "confirm",
      bookingSource: ReservationSource.BOOKING_COM,
    });
    const joined = steps.join("\n");
    expect(joined).toContain("Booking.com already has this guest");
    expect(joined).toContain("Airbnb:");
    expect(joined).toContain("Agoda:");
    expect(joined).not.toContain("Booking.com: Sync calendars");
  });

  it("walk-in lists all three OTA refresh steps", () => {
    const { title, steps } = otaRefreshImportsChecklist({
      trigger: "walk-in",
    });
    expect(title).toBe("Refresh other OTAs");
    expect(steps.join("\n")).toContain("Booking.com: Sync calendars");
    expect(steps.join("\n")).toContain("Airbnb:");
    expect(steps.join("\n")).toContain("Agoda:");
  });

  it("block-create title mentions block", () => {
    const { title } = otaRefreshImportsChecklist({ trigger: "block-create" });
    expect(title).toContain("Block");
  });

  it("stay-update title and lists all three OTA refresh steps", () => {
    const { title, steps } = otaRefreshImportsChecklist({
      trigger: "stay-update",
    });
    expect(title).toBe("Stay changed — refresh OTAs");
    const joined = steps.join("\n");
    expect(joined).toContain("old dates/unit");
    expect(joined).toContain("Booking.com: Sync calendars");
    expect(joined).toContain("Airbnb:");
    expect(joined).toContain("Agoda:");
  });
});

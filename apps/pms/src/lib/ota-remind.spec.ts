import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReservationSource } from "@cabin/api-contract";
import i18n from "@/i18n";
import {
  otaRefreshImportsChecklist,
  otaUpdateChecklist,
  peerOtaSources,
} from "./ota-remind";

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

afterAll(async () => {
  await i18n.changeLanguage("en");
});

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

  it("translates title and steps to Indonesian when locale switches", async () => {
    await i18n.changeLanguage("id");
    try {
      const { title, steps } = otaRefreshImportsChecklist({
        trigger: "walk-in",
      });
      expect(title).toBe("Refresh OTA lain");
      expect(steps.join("\n")).toContain(
        "OTA belum tahu soal stay ini sampai mereka menarik kalender kita.",
      );
    } finally {
      await i18n.changeLanguage("en");
    }
  });
});

describe("otaUpdateChecklist", () => {
  it("cancel reason returns title and steps mentioning the channel", () => {
    const { title, steps } = otaUpdateChecklist(
      ReservationSource.BOOKING_COM,
      "cancel",
    );
    expect(title).toBe("Cancel on Booking.com too");
    expect(steps).toHaveLength(3);
    expect(steps.join("\n")).toContain("Booking.com");
  });

  it("dates-or-unit reason appends peer refresh steps and footer", () => {
    const { title, steps } = otaUpdateChecklist(
      ReservationSource.AIRBNB,
      "dates-or-unit",
    );
    expect(title).toBe("Update Airbnb too");
    const joined = steps.join("\n");
    expect(joined).toContain("Booking.com: Sync calendars");
    expect(joined).toContain("Agoda:");
    expect(joined).not.toContain("Airbnb: Calendar → Availability");
    expect(joined).toContain("Auto sync can take hours");
  });
});

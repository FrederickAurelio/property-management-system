import { describe, expect, it } from "vitest";
import {
  MoneyGapKind,
  ReservationStatus,
  isOpenBalanceChase,
  moneyGapKind,
  refundDueIdr,
} from "./reservations.js";

describe("moneyGapKind", () => {
  const total = 1_000_000;

  it("is due when guest still owes", () => {
    expect(
      moneyGapKind({
        status: ReservationStatus.CHECKED_IN,
        totalAmountIdr: total,
        paidAmountIdr: 200_000,
      }),
    ).toBe(MoneyGapKind.due);
  });

  it("treats live excess as credit, checkout excess as refund", () => {
    const excess = {
      totalAmountIdr: total,
      paidAmountIdr: 1_200_000,
    };
    expect(refundDueIdr(total, 1_200_000)).toBe(200_000);
    expect(
      moneyGapKind({ status: ReservationStatus.CONFIRMED, ...excess }),
    ).toBe(MoneyGapKind.credit);
    expect(
      moneyGapKind({ status: ReservationStatus.CHECKED_IN, ...excess }),
    ).toBe(MoneyGapKind.credit);
    expect(
      moneyGapKind({ status: ReservationStatus.CHECKED_OUT, ...excess }),
    ).toBe(MoneyGapKind.refund);
  });

  it("closes cancelled stays even when excess remains", () => {
    expect(
      moneyGapKind({
        status: ReservationStatus.CANCELLED,
        totalAmountIdr: total,
        paidAmountIdr: 1_200_000,
      }),
    ).toBe(MoneyGapKind.closed);
  });

  it("is settled when paid matches total", () => {
    expect(
      moneyGapKind({
        status: ReservationStatus.CHECKED_IN,
        totalAmountIdr: total,
        paidAmountIdr: total,
      }),
    ).toBe(MoneyGapKind.settled);
  });
});

describe("isOpenBalanceChase", () => {
  it("chases due any live status, refund only after checkout", () => {
    expect(
      isOpenBalanceChase({
        status: ReservationStatus.CHECKED_IN,
        totalAmountIdr: 1_000_000,
        paidAmountIdr: 100_000,
      }),
    ).toBe(true);
    expect(
      isOpenBalanceChase({
        status: ReservationStatus.CHECKED_IN,
        totalAmountIdr: 1_000_000,
        paidAmountIdr: 1_200_000,
      }),
    ).toBe(false);
    expect(
      isOpenBalanceChase({
        status: ReservationStatus.CHECKED_OUT,
        totalAmountIdr: 1_000_000,
        paidAmountIdr: 1_200_000,
      }),
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  accrueRentIdr,
  yearMonthOverlapsInclusiveRange,
} from './reports-period.js';

describe('accrueRentIdr', () => {
  it('floors rent × clip / stay', () => {
    expect(accrueRentIdr(1_000_000, 10, 3)).toBe(300_000);
    expect(accrueRentIdr(100, 3, 1)).toBe(33);
  });

  it('returns 0 for non-positive inputs', () => {
    expect(accrueRentIdr(0, 10, 3)).toBe(0);
    expect(accrueRentIdr(100, 0, 3)).toBe(0);
    expect(accrueRentIdr(100, 10, 0)).toBe(0);
  });
});

describe('yearMonthOverlapsInclusiveRange', () => {
  it('includes a month that the range touches', () => {
    expect(
      yearMonthOverlapsInclusiveRange('2026-07', '2026-07-28', '2026-08-03'),
    ).toBe(true);
    expect(
      yearMonthOverlapsInclusiveRange('2026-07', '2026-07-01', '2026-07-31'),
    ).toBe(true);
  });

  it('excludes months the range does not touch', () => {
    expect(
      yearMonthOverlapsInclusiveRange('2026-07', '2026-08-01', '2026-08-07'),
    ).toBe(false);
  });
});

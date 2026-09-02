import {
  formatStatementDateShort,
  parseBillingNoForStatement,
  parseStatementIsoDate,
  parseUnitCodeForStatement,
  utilityStatementAmountDueIdr,
} from './utility-statement-layout.js';

describe('utility-statement-layout', () => {
  it('splits BCN-1101 into prefix, floor, and room boxes', () => {
    expect(parseUnitCodeForStatement('BCN-1101')).toEqual({
      prefix: 'BCN',
      floor: '11',
      room: '01',
    });
  });

  it('splits billing no into id, year, and month cells', () => {
    expect(parseBillingNoForStatement('US-CMTJH8SP-2026-10')).toEqual({
      idPart: 'US-CMTJH8SP',
      year: '2026',
      month: '10',
    });
  });

  it('due is utilities subtotal plus admin only', () => {
    expect(
      utilityStatementAmountDueIdr({
        periodSubtotalIdr: 1_309_577,
        adminAmountIdr: 3_000,
      }),
    ).toBe(1_312_577);
  });

  it('parses ISO dates as UTC noon so the calendar day is stable', () => {
    expect(parseStatementIsoDate('2026-09-17')).toEqual(
      new Date(Date.UTC(2026, 8, 17, 12, 0, 0)),
    );
    expect(formatStatementDateShort('2026-09-02')).toBe('02/09/26');
  });
});

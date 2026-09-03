import { UtilityKind } from '@cabin/api-contract';
import { reconstructUtilityPeriods } from './utility-statement-period.js';

describe('reconstructUtilityPeriods', () => {
  it('returns [] when there is no saved utility data', () => {
    expect(
      reconstructUtilityPeriods({
        checkInDate: '2026-05-10',
        utilityReadings: [],
        maintenanceCharges: [],
        adminCharges: [],
      }),
    ).toEqual([]);
  });

  it('keeps one period when only an opening meter exists', () => {
    const periods = reconstructUtilityPeriods({
      checkInDate: '2026-05-10',
      utilityReadings: [
        {
          utility: UtilityKind.ELECTRICITY,
          readingDate: '2026-05-10',
          meterValue: 1000,
        },
      ],
      maintenanceCharges: [],
      adminCharges: [],
    });
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      startDate: '2026-05-10',
      endDate: '2026-06-01',
      elecStart: 1000,
      elecEnd: null,
    });
  });
});
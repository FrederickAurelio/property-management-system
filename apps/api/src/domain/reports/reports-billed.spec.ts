import { UtilityKind } from '@cabin/api-contract';
import { sumBilledUtilitiesInRange } from './reports-billed';
import { emptyBilledTotals } from './reports-assemble';

describe('sumBilledUtilitiesInRange', () => {
  const fallback = {
    electricityRateIdrPerKwh: 1000,
    waterRateIdrPerM3: 500,
    maintenanceFeeIdrPerMonth: 0,
    electricityMinKwh: 0,
    adminFeeIdrPerMonth: 0,
    utilityAddons: [],
  };

  it('includes reconstructed periods whose month overlaps the range', () => {
    const totals = sumBilledUtilitiesInRange(
      [
        {
          checkInDate: '2026-06-01',
          utilityReadings: [
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-06-01',
              meterValue: 10,
            },
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-07-01',
              meterValue: 20,
            },
          ],
          maintenanceCharges: [{ chargeDate: '2026-06-01', amountIdr: 75_000 }],
          adminCharges: [{ chargeDate: '2026-06-01', amountIdr: 10_000 }],
          periodSchemes: [],
          fallbackScheme: fallback,
        },
      ],
      '2026-06-01',
      '2026-06-30',
    );
    expect(totals.electricityIdr).toBe(10_000);
    expect(totals.maintenanceIdr).toBe(75_000);
    expect(totals.adminIdr).toBe(10_000);
    expect(totals.waterIdr).toBe(0);
  });

  it('excludes billed months outside the range', () => {
    const totals = sumBilledUtilitiesInRange(
      [
        {
          checkInDate: '2026-06-01',
          utilityReadings: [
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-06-01',
              meterValue: 10,
            },
            {
              utility: UtilityKind.ELECTRICITY,
              readingDate: '2026-07-01',
              meterValue: 20,
            },
          ],
          maintenanceCharges: [{ chargeDate: '2026-06-01', amountIdr: 75_000 }],
          adminCharges: [],
          periodSchemes: [],
          fallbackScheme: fallback,
        },
      ],
      '2026-08-01',
      '2026-08-31',
    );
    expect(totals).toEqual(emptyBilledTotals());
  });
});

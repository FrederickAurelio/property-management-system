import { buildUnitIcs } from './ical-export.js';
import type { IcalBusyRange } from './ical-busy.js';

describe('buildUnitIcs', () => {
  it('emits busy stay and block events without guest PII', () => {
    const ranges: IcalBusyRange[] = [
      {
        uid: 'stay-abc@cabin-pms',
        startYmd: '2026-07-28',
        endYmd: '2026-07-31',
        kind: 'stay',
      },
      {
        uid: 'block-xyz@cabin-pms',
        startYmd: '2026-08-01',
        endYmd: '2026-08-03',
        kind: 'block',
      },
    ];
    const ics = buildUnitIcs('unit1', ranges);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Busy');
    expect(ics).toContain('SUMMARY:Blocked');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260728');
    expect(ics).toContain('DTEND;VALUE=DATE:20260731');
    expect(ics).not.toContain('Budi');
    expect(ics).not.toContain('guest');
  });
});

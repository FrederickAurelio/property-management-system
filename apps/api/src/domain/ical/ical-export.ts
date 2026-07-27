import type { IcalBusyRange } from './ical-busy.js';

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Build RFC5545 VCALENDAR — busy DATE events only (no PII). */
export function buildUnitIcs(unitId: string, ranges: IcalBusyRange[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cabin PMS//iCal Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Cabin unit ${unitId}`,
  ];

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  for (const range of ranges) {
    const summary = range.kind === 'block' ? 'Blocked' : 'Busy';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(range.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${range.startYmd.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${range.endYmd.replace(/-/g, '')}`,
      `SUMMARY:${escapeText(summary)}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

import { icalExportTokenMatches } from './ical-export-token';

describe('icalExportTokenMatches', () => {
  const stored = 'a'.repeat(48);

  it('accepts the stored token', () => {
    expect(icalExportTokenMatches(stored, stored)).toBe(true);
  });

  it('rejects a different token of the same length', () => {
    expect(icalExportTokenMatches('b'.repeat(48), stored)).toBe(false);
  });

  it('rejects missing unit (undefined stored) without throwing', () => {
    expect(icalExportTokenMatches(stored, undefined)).toBe(false);
    expect(icalExportTokenMatches('', undefined)).toBe(false);
  });
});

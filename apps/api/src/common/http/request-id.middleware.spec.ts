import { sanitizeRequestId } from './request-id.middleware';

describe('sanitizeRequestId', () => {
  it('accepts a UUID', () => {
    expect(sanitizeRequestId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    );
  });

  it('rejects empty, oversized, or junk charset', () => {
    expect(sanitizeRequestId('')).toBeUndefined();
    expect(sanitizeRequestId('   ')).toBeUndefined();
    expect(sanitizeRequestId('a'.repeat(65))).toBeUndefined();
    expect(sanitizeRequestId('not a uuid')).toBeUndefined();
    expect(sanitizeRequestId('id\nlevel=99')).toBeUndefined();
  });
});

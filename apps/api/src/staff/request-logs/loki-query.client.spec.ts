import { asLokiLine, asLokiNsTs } from './loki-query.client';

describe('asLokiNsTs', () => {
  it('keeps string nanoseconds', () => {
    expect(asLokiNsTs('1755312000000000000')).toBe('1755312000000000000');
  });

  it('coerces finite numbers', () => {
    expect(asLokiNsTs(1_755_312_000_000)).toBe('1755312000000');
  });

  it('drops junk', () => {
    expect(asLokiNsTs(undefined)).toBeNull();
    expect(asLokiNsTs('')).toBeNull();
  });
});

describe('asLokiLine', () => {
  it('keeps strings including empty', () => {
    expect(asLokiLine('{"ok":true}')).toBe('{"ok":true}');
    expect(asLokiLine('')).toBe('');
  });

  it('drops non-strings', () => {
    expect(asLokiLine(12)).toBeNull();
  });
});

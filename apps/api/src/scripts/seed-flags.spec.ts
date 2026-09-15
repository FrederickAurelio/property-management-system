import { isEnvFlagOn } from './seed-flags';

describe('isEnvFlagOn', () => {
  it.each(['1', 'true', 'TRUE', ' yes '] as const)('treats %j as on', (raw) => {
    expect(isEnvFlagOn(raw)).toBe(true);
  });

  it.each([undefined, '', '0', 'false', 'no'] as const)(
    'treats %j as off',
    (raw) => {
      expect(isEnvFlagOn(raw)).toBe(false);
    },
  );
});

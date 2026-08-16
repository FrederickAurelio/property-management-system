import { lokiBaseUrl, shouldPushRequestLogsToLoki } from './loki-url';

describe('lokiBaseUrl', () => {
  it('strips a trailing slash', () => {
    expect(lokiBaseUrl({ LOKI_URL: 'http://127.0.0.1:3100/' })).toBe(
      'http://127.0.0.1:3100',
    );
  });

  it('defaults to loopback Loki', () => {
    expect(lokiBaseUrl({})).toBe('http://127.0.0.1:3100');
  });
});

describe('shouldPushRequestLogsToLoki', () => {
  it('never pushes in tests', () => {
    expect(
      shouldPushRequestLogsToLoki({
        NODE_ENV: 'test',
        LOKI_URL: 'http://127.0.0.1:3100',
      }),
    ).toBe(false);
  });

  it('pushes on host Nest', () => {
    expect(
      shouldPushRequestLogsToLoki({
        NODE_ENV: 'development',
        LOKI_URL: 'http://127.0.0.1:3100',
      }),
    ).toBe(true);
  });

  it('pushes from cabin-api to docker Loki', () => {
    expect(
      shouldPushRequestLogsToLoki({
        NODE_ENV: 'production',
        LOKI_URL: 'http://loki:3100',
      }),
    ).toBe(true);
  });
});

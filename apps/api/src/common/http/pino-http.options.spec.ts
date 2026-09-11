import { pinoHttpOptions } from './pino-http.options.js';

describe('pinoHttpOptions', () => {
  it('redacts cookies, authorization, and credential body fields', () => {
    const opts = pinoHttpOptions();
    const paths =
      (opts.redact as { paths?: string[] } | undefined)?.paths ?? [];
    expect(paths).toEqual(
      expect.arrayContaining([
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["set-cookie"]',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
      ]),
    );
  });
});

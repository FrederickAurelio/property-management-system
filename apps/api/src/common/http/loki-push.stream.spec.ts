import {
  createLokiPushStream,
  type LokiPushStreamOptions,
} from './loki-push.stream';

describe('createLokiPushStream', () => {
  it('posts NDJSON lines to Loki with service=api', async () => {
    const posted: Array<{ url: string; body: string }> = [];
    const post: NonNullable<LokiPushStreamOptions['post']> = (input, init) => {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      posted.push({
        url: href,
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    const stream = createLokiPushStream({
      post,
      flushMs: 0,
      now: () => 1_755_312_000_000,
    });

    stream.write(
      `${JSON.stringify({
        time: 1_755_312_000_000,
        req: { method: 'GET', url: '/staff/auth/session' },
        res: { statusCode: 200 },
      })}\n`,
    );
    stream.end();

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]?.url).toContain('/loki/api/v1/push');
    const payload = JSON.parse(posted[0]?.body ?? '{}') as {
      streams: Array<{ stream: Record<string, string>; values: unknown[] }>;
    };
    expect(payload.streams[0]?.stream).toEqual({
      service: 'api',
    });
    expect(payload.streams[0]?.values).toHaveLength(1);
  });

  it('skips Nest boot lines without req/res', async () => {
    const posted: Array<{ url: string; body: string }> = [];
    const post: NonNullable<LokiPushStreamOptions['post']> = (input, init) => {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      posted.push({
        url: href,
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    const stream = createLokiPushStream({
      post,
      flushMs: 0,
    });
    stream.write(
      `${JSON.stringify({ msg: 'Nest application successfully started' })}\n`,
    );
    stream.end();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(posted).toHaveLength(0);
  });

  it('treats Loki HTTP errors as a failed push without throwing', async () => {
    const errors: string[] = [];
    const post: NonNullable<LokiPushStreamOptions['post']> = () =>
      Promise.resolve(new Response('nope', { status: 400 }));

    const stream = createLokiPushStream({
      post,
      flushMs: 0,
      onPushError: (reason) => {
        errors.push(reason);
      },
    });
    stream.write(
      `${JSON.stringify({
        req: { method: 'GET', url: '/staff/auth/session' },
        res: { statusCode: 200 },
      })}\n`,
    );
    stream.end();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(errors.some((reason) => reason.includes('400'))).toBe(true);
  });
});

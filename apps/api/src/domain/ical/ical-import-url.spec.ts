import {
  assertIcalImportUrlShape,
  assertSafeIcalImportUrl,
  fetchIcsText,
  ICS_BODY_MAX_BYTES,
  UnsafeIcalImportUrlError,
  type IcalDnsLookup,
} from './ical-import-url';

const PUBLIC_LOOKUP: IcalDnsLookup = () =>
  Promise.resolve([{ address: '93.184.216.34', family: 4 }]);

describe('assertIcalImportUrlShape', () => {
  it('allows https OTA hosts', () => {
    expect(
      assertIcalImportUrlShape('https://calendar.airbnb.com/calendar.ics')
        .hostname,
    ).toBe('calendar.airbnb.com');
  });

  it('rejects loopback, metadata, and private literals', () => {
    const blocked = [
      'http://127.0.0.1/secret.ics',
      'http://0.0.0.1/feed.ics',
      'http://2130706433/feed.ics',
      'http://localhost/x.ics',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/feed.ics',
      'http://192.168.1.9/feed.ics',
      'http://[::1]/feed.ics',
      'http://[::ffff:127.0.0.1]/feed.ics',
      'http://metadata.google.internal/',
    ];
    for (const url of blocked) {
      expect(() => assertIcalImportUrlShape(url)).toThrow(
        UnsafeIcalImportUrlError,
      );
    }
  });

  it('rejects non-http schemes and embedded credentials', () => {
    expect(() => assertIcalImportUrlShape('file:///etc/passwd')).toThrow(
      UnsafeIcalImportUrlError,
    );
    expect(() =>
      assertIcalImportUrlShape('https://user:pass@example.com/x.ics'),
    ).toThrow(UnsafeIcalImportUrlError);
  });
});

describe('assertSafeIcalImportUrl', () => {
  it('rejects when DNS returns a private address', async () => {
    const lookup: IcalDnsLookup = () =>
      Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
    await expect(
      assertSafeIcalImportUrl('https://evil.example/feed.ics', lookup),
    ).rejects.toBeInstanceOf(UnsafeIcalImportUrlError);
  });

  it('allows a hostname that resolves only to a public address', async () => {
    await expect(
      assertSafeIcalImportUrl('https://example.com/airbnb.ics', PUBLIC_LOOKUP),
    ).resolves.toMatchObject({ hostname: 'example.com' });
  });
});

describe('fetchIcsText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not fetch a private URL', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await expect(
      fetchIcsText('http://127.0.0.1/secret.ics', AbortSignal.timeout(1000)),
    ).rejects.toBeInstanceOf(UnsafeIcalImportUrlError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a redirect onto a private IP', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 302,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location' ? 'http://169.254.169.254/' : null,
      },
      text: () => Promise.resolve(''),
    } as unknown as Response);

    await expect(
      fetchIcsText(
        'https://example.com/airbnb.ics',
        AbortSignal.timeout(1000),
        PUBLIC_LOOKUP,
      ),
    ).rejects.toBeInstanceOf(UnsafeIcalImportUrlError);
  });

  it('rejects an oversized Content-Length', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-length'
            ? String(ICS_BODY_MAX_BYTES + 1)
            : null,
      },
      text: () => Promise.resolve('BEGIN:VCALENDAR'),
    } as unknown as Response);

    await expect(
      fetchIcsText(
        'https://example.com/airbnb.ics',
        AbortSignal.timeout(1000),
        PUBLIC_LOOKUP,
      ),
    ).rejects.toThrow(/size limit/i);
  });

  it('returns the ICS body for a public host', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve('BEGIN:VCALENDAR'),
    } as unknown as Response);

    await expect(
      fetchIcsText(
        'https://example.com/airbnb.ics',
        AbortSignal.timeout(1000),
        PUBLIC_LOOKUP,
      ),
    ).resolves.toBe('BEGIN:VCALENDAR');
  });
});

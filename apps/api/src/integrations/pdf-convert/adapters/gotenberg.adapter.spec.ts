import { ServiceUnavailableException } from '@nestjs/common';
import { ApiErrorCode } from '@cabin/api-contract';
import { GotenbergPdfConvertAdapter } from './gotenberg.adapter.js';

describe('GotenbergPdfConvertAdapter', () => {
  const adapter = new GotenbergPdfConvertAdapter();
  const prevUrl = process.env.GOTENBERG_URL;
  const xlsx = Buffer.from('xlsx-bytes');

  afterEach(() => {
    if (prevUrl === undefined) {
      delete process.env.GOTENBERG_URL;
    } else {
      process.env.GOTENBERG_URL = prevUrl;
    }
    jest.restoreAllMocks();
  });

  function expectPdfUnavailable(error: unknown): void {
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const response = (error as ServiceUnavailableException).getResponse();
    expect(response).toMatchObject({
      code: ApiErrorCode.PDF_UNAVAILABLE,
    });
  }

  it('throws 503 when GOTENBERG_URL is missing', async () => {
    delete process.env.GOTENBERG_URL;

    await adapter.convertXlsxToPdf(xlsx).then(
      () => {
        throw new Error('expected unavailable');
      },
      (error: unknown) => {
        expectPdfUnavailable(error);
      },
    );
  });

  it('throws 503 when fetch fails', async () => {
    process.env.GOTENBERG_URL = 'http://127.0.0.1:3001';
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    await adapter.convertXlsxToPdf(xlsx).then(
      () => {
        throw new Error('expected unavailable');
      },
      (error: unknown) => {
        expectPdfUnavailable(error);
      },
    );
  });

  it('throws 503 when Gotenberg returns non-OK', async () => {
    process.env.GOTENBERG_URL = 'http://127.0.0.1:3001';
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('busy', { status: 503 }));

    await adapter.convertXlsxToPdf(xlsx).then(
      () => {
        throw new Error('expected unavailable');
      },
      (error: unknown) => {
        expectPdfUnavailable(error);
      },
    );
  });

  it('returns PDF bytes on 200', async () => {
    process.env.GOTENBERG_URL = 'http://127.0.0.1:3001';
    const pdf = Buffer.from('%PDF-1.4 fake');
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pdf, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );

    const out = await adapter.convertXlsxToPdf(xlsx);
    expect(out.equals(pdf)).toBe(true);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('exportFormFields')).toBe('false');
    expect((init?.body as FormData).get('skipEmptyPages')).toBe('true');
    expect((init?.body as FormData).get('magnification')).toBe('1');
    expect((init?.body as FormData).get('pageLayout')).toBe('1');
    expect((init?.body as FormData).get('singlePageSheets')).toBe('true');
  });
});

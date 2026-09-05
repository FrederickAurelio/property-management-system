import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiErrorCode } from '@cabin/api-contract';
import type { PdfConvertPort } from '../pdf-convert.port.js';

const GOTENBERG_TIMEOUT_MS = 30_000;
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function pdfUnavailable(): never {
  throw new ServiceUnavailableException({
    message: 'PDF export is unavailable.',
    code: ApiErrorCode.PDF_UNAVAILABLE,
  });
}

function gotenbergBaseUrl(): string {
  const url = process.env.GOTENBERG_URL?.trim();
  if (!url) {
    pdfUnavailable();
  }
  return url.replace(/\/+$/, '');
}

@Injectable()
export class GotenbergPdfConvertAdapter implements PdfConvertPort {
  async convertXlsxToPdf(xlsx: Buffer): Promise<Buffer> {
    const url = `${gotenbergBaseUrl()}/forms/libreoffice/convert`;
    const form = new FormData();
    form.append(
      'files',
      new File([new Uint8Array(xlsx)], 'statement.xlsx', { type: XLSX_MIME }),
    );
    // Honor xlsx pageSetup (compact custom page + tight margins). singlePageSheets
    // ignores paper size and flushes the sheet to the page edge, clipping borders.
    form.append('exportFormFields', 'false');
    form.append('skipEmptyPages', 'true');
    // Trim the PDF page to the sheet print area (compact bill, not full A4).
    // LibreOffice ignores custom paperWidth/Height in xlsx; this is the reliable knob.
    form.append('singlePageSheets', 'true');
    // PDF viewer: fit page + single-page layout so browser Print uses the full sheet.
    form.append('magnification', '1');
    form.append('pageLayout', '1');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(GOTENBERG_TIMEOUT_MS),
      });
    } catch {
      pdfUnavailable();
    }

    if (!response.ok) {
      pdfUnavailable();
    }

    try {
      const bytes = await response.arrayBuffer();
      return Buffer.from(bytes);
    } catch {
      pdfUnavailable();
    }
  }
}

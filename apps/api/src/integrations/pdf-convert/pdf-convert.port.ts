export const PDF_CONVERT = Symbol('PDF_CONVERT');

/** Capability port — Gotenberg (or a later vendor) lives only in adapters. */
export interface PdfConvertPort {
  convertXlsxToPdf(xlsx: Buffer): Promise<Buffer>;
}

import { Module } from '@nestjs/common';
import { GotenbergPdfConvertAdapter } from './adapters/gotenberg.adapter.js';
import { PDF_CONVERT } from './pdf-convert.port.js';

@Module({
  providers: [{ provide: PDF_CONVERT, useClass: GotenbergPdfConvertAdapter }],
  exports: [PDF_CONVERT],
})
export class PdfConvertModule {}

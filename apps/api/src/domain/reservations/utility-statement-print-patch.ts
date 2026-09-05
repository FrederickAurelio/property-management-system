import JSZip from 'jszip';
import type { StatementPaperTwips } from './utility-statement-print-size.js';

const UTILITY_STATEMENT_SHEET_XML = 'xl/worksheets/sheet1.xml';

/**
 * exceljs drops print metadata LibreOffice needs for faithful compact-bill PDFs:
 * - no `<printOptions headings="0" gridLines="0"/>` when grid lines are off (virgin template has explicit zeros)
 * - `pageSetUpPr` loses `autoPageBreaks="1"` (only writes `fitToPage`)
 * - custom `paperWidth` / `paperHeight` (twips) for content-sized pages
 *
 * Patch the emitted worksheet XML only — bill layout/cells stay untouched.
 */
export async function patchUtilityStatementXlsxPrintSetup(
  xlsx: Buffer,
  paper?: StatementPaperTwips,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  const sheetFile = zip.file(UTILITY_STATEMENT_SHEET_XML);
  if (!sheetFile) {
    return xlsx;
  }
  const xml = patchSheetPrintXml(await sheetFile.async('string'), paper);
  zip.file(UTILITY_STATEMENT_SHEET_XML, xml);
  return Buffer.from(
    await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
  );
}

function patchSheetPrintXml(
  xml: string,
  paper?: StatementPaperTwips,
): string {
  let out = xml;

  if (out.includes('<pageSetUpPr')) {
    out = out.replace(
      /<pageSetUpPr[^>]*\/>/,
      '<pageSetUpPr autoPageBreaks="0" fitToPage="0"/>',
    );
  } else if (out.includes('<sheetPr>')) {
    out = out.replace(
      '<sheetPr>',
      '<sheetPr><pageSetUpPr autoPageBreaks="0" fitToPage="0"/>',
    );
  }

  if (!out.includes('<printOptions')) {
    out = out.replace(
      '<pageMargins',
      '<printOptions headings="0" gridLines="0"/><pageMargins',
    );
  }

  if (paper) {
    out = out.replace(
      /<pageSetup\b([^>]*)\/>/,
      (_match, attrs: string) => {
        let next = attrs
          .replace(/\s+paperSize="[^"]*"/, '')
          .replace(/\s+fitToWidth="[^"]*"/, '')
          .replace(/\s+fitToHeight="[^"]*"/, '')
          .replace(/\s+scale="[^"]*"/, '');
        return `<pageSetup${next} paperSize="0" scale="100" paperWidth="${paper.widthTwips}" paperHeight="${paper.heightTwips}"/>`;
      },
    );
  } else {
    // Legacy path: drop fixed scale when fit-to-page is still on.
    out = out.replace(/(<pageSetup\b[^>]*)\s+scale="100"/, '$1');
  }

  return out;
}

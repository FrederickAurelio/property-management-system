import JSZip from 'jszip';
import { patchUtilityStatementXlsxPrintSetup } from './utility-statement-print-patch.js';

async function sheetXml(xlsx: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(xlsx);
  const sheet = zip.file('xl/worksheets/sheet1.xml');
  if (!sheet) {
    throw new Error('missing sheet1.xml');
  }
  return sheet.async('string');
}

describe('utility-statement-print-patch', () => {
  it('adds printOptions and autoPageBreaks and drops fixed scale', async () => {
    const before = Buffer.from(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><pageMargins left="0.7"/><pageSetup paperSize="9" scale="100" fitToWidth="1" fitToHeight="1"/></worksheet>`,
    );
    const zip = new JSZip();
    zip.file('xl/worksheets/sheet1.xml', before);
    const xlsx = Buffer.from(
      await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    );

    const patched = await patchUtilityStatementXlsxPrintSetup(xlsx);
    const xml = await sheetXml(patched);

    expect(xml).toContain(
      '<pageSetUpPr autoPageBreaks="1" fitToPage="1"/>',
    );
    expect(xml).toContain('<printOptions headings="0" gridLines="0"/>');
    expect(xml).not.toContain('scale="100"');
  });
});

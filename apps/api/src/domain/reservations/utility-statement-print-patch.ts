import JSZip from 'jszip';

const UTILITY_STATEMENT_SHEET_XML = 'xl/worksheets/sheet1.xml';

/**
 * exceljs drops print metadata LibreOffice needs for faithful A4 paper/PDF output:
 * - no `<printOptions headings="0" gridLines="0"/>` when grid lines are off (virgin template has explicit zeros)
 * - `pageSetUpPr` loses `autoPageBreaks="1"` (only writes `fitToPage`)
 * - `scale="100"` alongside fit-to-page can make Calc ignore shrink-to-fit on some builds
 *
 * Patch the emitted worksheet XML only — bill layout/cells stay untouched.
 */
export async function patchUtilityStatementXlsxPrintSetup(
  xlsx: Buffer,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  const sheetFile = zip.file(UTILITY_STATEMENT_SHEET_XML);
  if (!sheetFile) {
    return xlsx;
  }
  const xml = patchSheetPrintXml(await sheetFile.async('string'));
  zip.file(UTILITY_STATEMENT_SHEET_XML, xml);
  return Buffer.from(
    await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
  );
}

function patchSheetPrintXml(xml: string): string {
  let out = xml;

  if (out.includes('<pageSetUpPr')) {
    out = out.replace(
      /<pageSetUpPr[^>]*\/>/,
      '<pageSetUpPr autoPageBreaks="1" fitToPage="1"/>',
    );
  } else if (out.includes('<sheetPr>')) {
    out = out.replace(
      '<sheetPr>',
      '<sheetPr><pageSetUpPr autoPageBreaks="1" fitToPage="1"/>',
    );
  }

  if (!out.includes('<printOptions')) {
    out = out.replace(
      '<pageMargins',
      '<printOptions headings="0" gridLines="0"/><pageMargins',
    );
  }

  // Fit-to-page mode: drop fixed scale so LibreOffice honors fitToWidth/fitToHeight.
  out = out.replace(/(<pageSetup\b[^>]*)\s+scale="100"/, '$1');

  return out;
}

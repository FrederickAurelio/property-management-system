import { UtilityAddonKind } from '@cabin/api-contract';
import {
  UTILITY_ADDON_ROW_LAYOUT,
  UTILITY_STATEMENT_AMOUNT_COLUMN,
  UTILITY_STATEMENT_FOOTER_LABELS,
  UTILITY_STATEMENT_HEADER_CELLS,
  UTILITY_STATEMENT_NAMES,
  UTILITY_STATEMENT_NOTE_SNIPPETS,
  UTILITY_STATEMENT_PRINT_MARGINS_IN,
  UTILITY_STATEMENT_SECTION_LABELS,
} from './utility-statement-cells.js';
import {
  expandUtilityStatementAddonRows,
  fillUtilityStatementWorkbook,
  findRowByUniqueLabel,
  findRowContainingLabel,
  findStatementPrintLastRow,
  namedCell,
  openUtilityStatementWorkbook,
  writeUtilityStatementFooter,
  writeUtilityStatementNamedFields,
  type UtilityStatementFillInput,
} from './utility-statement-fill.js';
import { patchUtilityStatementXlsxPrintSetup } from './utility-statement-print-patch.js';
import JSZip from 'jszip';

function cellString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'richText' in value) {
    const rich = value as { richText: ReadonlyArray<{ text: string }> };
    return rich.richText.map((part) => part.text).join('');
  }
  return '';
}

function exampleInput(
  overrides: Partial<UtilityStatementFillInput> = {},
): UtilityStatementFillInput {
  const usageRp = Math.floor(52 * 1700);
  const pju = Math.floor((usageRp * 10) / 100);
  const constant = 5_000;
  const elecKindTotal = usageRp + pju + constant;
  return {
    guestName: 'Ada Lovelace',
    guestPhone: '08123456789',
    unitCode: 'BCN-1101',
    periodStart: '2026-05-10',
    periodEnd: '2026-06-01',
    billingNo: 'US-RES1TEST-2026-06',
    statementDate: '2026-09-02',
    maintenanceAmountIdr: 50_000,
    elecStartKwh: 1000,
    elecEndKwh: 1023,
    elecActualUsage: 23,
    elecBilledKwh: 52,
    elecRate: 1700,
    elecUsageAmountIdr: usageRp,
    elecKindTotalIdr: elecKindTotal,
    elecAddonLines: [
      {
        name: 'PJU',
        kind: UtilityAddonKind.PERCENT,
        value: 10,
        amountIdr: pju,
      },
      {
        name: 'Admin PLN',
        kind: UtilityAddonKind.CONSTANT,
        value: 5_000,
        amountIdr: constant,
      },
    ],
    waterStartM3: 0,
    waterEndM3: 0,
    waterUsage: 0,
    waterRate: 7_000,
    waterUsageAmountIdr: 0,
    waterKindTotalIdr: 0,
    waterAddonLines: [],
    periodSubtotalIdr: elecKindTotal + 50_000,
    adminAmountIdr: 6_500,
    dueAmountIdr: elecKindTotal + 50_000 + 6_500,
    bankName: 'BANK RAKYAT INDONESIA (BRI)',
    accountName: 'PERUMNAS PROJECT SUKARAMAI',
    accountNumber: '036701001560300',
    ...overrides,
  };
}

describe('utility-statement exceljs fill', () => {
  it('writes named header/meters before insert; footer L after addon expand', async () => {
    const input = exampleInput();
    const wb = await openUtilityStatementWorkbook();

    writeUtilityStatementNamedFields(wb, input);

    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.guestName).value).toBe(
      'Ada Lovelace',
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.guestPhone).value).toBe(
      '08123456789',
    );
    const sheetAfterHeader = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitPrefix).value,
    ).toBe('BCN');
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitFloor).value,
    ).toBe('11');
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitRoom).value,
    ).toBe('01');
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingId).value,
    ).toBe('US-RES1TEST');
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingYear)
        .value,
    ).toBe('2026');
    expect(
      sheetAfterHeader.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingMonth)
        .value,
    ).toBe('06');
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.periodStart).value).toEqual(
      new Date(Date.UTC(2026, 4, 10, 12, 0, 0)),
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.periodEnd).value).toEqual(
      new Date(Date.UTC(2026, 5, 1, 12, 0, 0)),
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.statementDate).value).toBe(
      '01/06/26',
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecStartKwh).value).toBe(
      1000,
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecEndKwh).value).toBe(1023);
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecActualUsage).value).toBe(
      23,
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecBilledKwh).value).toBe(52);
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecChargeKwh).value).toBe(52);
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecRate).value).toBe(1700);
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecRate).numFmt).toBe(
      '#,##0',
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.waterRate).value).toBe(7_000);
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.waterRate).numFmt).toBe(
      '#,##0',
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.elecUsageAmount).value).toBe(
      Math.floor(52 * 1700),
    );
    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.maintenanceAmount).value).toBe(
      50_000,
    );

    expandUtilityStatementAddonRows(wb, input);
    writeUtilityStatementFooter(wb, input);

    const sheet = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
    const usageRp = Math.floor(52 * 1700);
    const elecKindTotal = usageRp + Math.floor((usageRp * 10) / 100) + 5_000;

    const periodRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.periodSubtotal,
    );
    const adminRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.admin,
    );
    const dueRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.due,
    );

    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${periodRow}`).value,
    ).toBe(elecKindTotal + 50_000);
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${adminRow}`).value,
    ).toBe(6_500);
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${dueRow}`).value,
    ).toBe(elecKindTotal + 50_000 + 6_500);

    const pjuRow = findRowByUniqueLabel(sheet, 'PJU');
    const constantRow = findRowByUniqueLabel(sheet, 'Admin PLN');
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${pjuRow}`).value,
    ).toBe(Math.floor((usageRp * 10) / 100));
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${constantRow}`).value,
    ).toBe(5_000);
    expect(
      sheet.getCell(`${UTILITY_ADDON_ROW_LAYOUT.rateCol}${pjuRow}`).value,
    ).toBe(0.1);
    expect(
      sheet.getCell(`${UTILITY_ADDON_ROW_LAYOUT.kindCol}${pjuRow}`).value ??
        null,
    ).toBeNull();
    expect(sheet.getCell(`J${dueRow}`).value).toBe(':');
    expect(sheet.getCell(`K${dueRow}`).value).toBe('Rp');
    expect(sheet.getCell(`L${dueRow}`).isMerged).toBe(false);
  });

  it('matches original statement presentation after fill', async () => {
    const input = exampleInput();
    const wb = await fillUtilityStatementWorkbook(input);
    const sheet = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
    const listrik = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_SECTION_LABELS.electricity,
    );
    expect(listrik).toBe(13);
    expect(sheet.getRow(listrik).hidden).toBeFalsy();
    expect(sheet.getRow(listrik + 1).hidden).toBeFalsy();
    expect(sheet.getRow(listrik + 2).hidden).toBeFalsy();
    expect(sheet.getRow(listrik + 3).hidden).toBe(true);
    expect(sheet.getRow(listrik + 4).hidden).toBe(true);

    expect(namedCell(wb, UTILITY_STATEMENT_NAMES.waterRate).font?.name).toBe(
      'Calibri',
    );
    const virgin = await openUtilityStatementWorkbook();
    const virginSheet = virgin.getWorksheet('Sheet1') ?? virgin.worksheets[0];
    expect(sheet.getColumn('G').width).toBe(virginSheet.getColumn('G').width);
    expect(sheet.getColumn('I').width).toBe(virginSheet.getColumn('I').width);
    expect(sheet.getColumn('M').width).toBe(virginSheet.getColumn('M').width);
    expect(sheet.getRow(3).height).toBe(23.25);
    expect(sheet.getCell('G3').font).toMatchObject({
      name: 'Calibri',
      size: 18,
      bold: true,
      underline: true,
    });
    expect(sheet.getCell('I9').value ?? null).toBeNull();
    expect(sheet.getCell('K9').value ?? null).toBeNull();

    const rekRow = findRowByUniqueLabel(sheet, 'No. Rek');
    expect(sheet.getCell(`F${rekRow}`).isMerged).toBe(true);
    expect(sheet.getCell(`D${rekRow}`).border?.bottom?.style).toBe('medium');
    expect(sheet.getCell(`J${rekRow}`).border?.right?.style).toBe('medium');

    const caraRow = findRowContainingLabel(
      sheet,
      UTILITY_STATEMENT_NOTE_SNIPPETS.caraPembayaran,
    );
    expect(sheet.getCell(`D${caraRow}`).border?.top?.style).toBe('medium');
    expect(sheet.getCell(`D${caraRow}`).border?.left?.style).toBe('medium');

    const jatuhRow = findRowContainingLabel(
      sheet,
      UTILITY_STATEMENT_NOTE_SNIPPETS.jatuhTempo,
    );
    const jatuhValue = cellString(sheet.getCell(`B${jatuhRow}`).value);
    expect(jatuhValue).toContain('Tanggal Jatuh tempo');

    const catatanRow = findRowContainingLabel(
      sheet,
      UTILITY_STATEMENT_NOTE_SNIPPETS.catatan,
    );
    expect(sheet.getCell(`B${catatanRow}`).font).toMatchObject({
      name: 'Calibri',
      size: 9,
      underline: true,
    });

    const disconnectRow = findRowContainingLabel(
      sheet,
      UTILITY_STATEMENT_NOTE_SNIPPETS.disconnect,
    );
    const disconnectValue = cellString(
      sheet.getCell(`B${disconnectRow}`).value,
    );
    expect(disconnectValue).toContain('Apabila penghuni belum melunasi');
    expect(sheet.getCell(`B${disconnectRow}`).font?.name).toBe('Calibri');
    expect(sheet.getCell(`B${disconnectRow}`).font?.bold).toBe(true);

    const dueRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.due,
    );
    expect(sheet.getCell(`D${dueRow}`).isMerged).toBe(true);
    expect(sheet.getCell(`D${dueRow}`).font?.name).toBe('Calibri');
    expect(sheet.getCell(`D${dueRow}`).value).toBe(
      UTILITY_STATEMENT_FOOTER_LABELS.due,
    );
    expect(sheet.getCell(`J${dueRow}`).value).toBe(':');
    expect(sheet.getCell(`K${dueRow}`).value).toBe('Rp');
    expect(sheet.getCell(`L${dueRow}`).value).toBe(
      input.periodSubtotalIdr + input.adminAmountIdr,
    );
    expect(sheet.getCell(`L${dueRow}`).isMerged).toBe(false);
    expect(sheet.getCell(`L${dueRow}`).numFmt).toBe('#,##0.00');
    expect(sheet.getCell(`L${dueRow}`).font).toMatchObject({
      name: 'Calibri',
      size: 12,
      bold: true,
    });
    expect(sheet.getCell(`L${dueRow}`).alignment?.horizontal).toBe('center');
    expect(sheet.pageSetup.fitToPage).toBe(true);
    expect(sheet.pageSetup.fitToHeight).toBe(1);
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.showGridLines).toBe(false);
    expect(sheet.pageSetup.showRowColHeaders).toBe(false);
    const lastPrintRow = findStatementPrintLastRow(sheet);
    const lastNoteRow = findRowContainingLabel(
      sheet,
      UTILITY_STATEMENT_NOTE_SNIPPETS.unpaidIfNoProof,
    );
    expect(lastPrintRow).toBeGreaterThan(lastNoteRow);
    expect(sheet.pageSetup.printArea).toBe(`A2:M${lastPrintRow}`);
    expect(sheet.pageSetup.margins?.left).toBe(
      UTILITY_STATEMENT_PRINT_MARGINS_IN.left,
    );
    expect(sheet.pageSetup.margins?.right).toBe(
      UTILITY_STATEMENT_PRINT_MARGINS_IN.right,
    );
    expect(sheet.pageSetup.margins?.top).toBe(
      UTILITY_STATEMENT_PRINT_MARGINS_IN.top,
    );
    expect(sheet.pageSetup.margins?.bottom).toBe(
      UTILITY_STATEMENT_PRINT_MARGINS_IN.bottom,
    );

    const patchedXml = await (async () => {
      const zip = await JSZip.loadAsync(
        await patchUtilityStatementXlsxPrintSetup(
          Buffer.from(await wb.xlsx.writeBuffer()),
        ),
      );
      const sheetFile = zip.file('xl/worksheets/sheet1.xml');
      return sheetFile ? await sheetFile.async('string') : '';
    })();
    expect(patchedXml).toContain('<printOptions headings="0" gridLines="0"/>');
    expect(patchedXml).toContain(
      '<pageSetUpPr autoPageBreaks="1" fitToPage="1"/>',
    );
  });

  it('writes Cara Pembayaran F cells from input', async () => {
    const input = exampleInput({
      bankName: 'BCA',
      accountName: 'PT CABIN',
      accountNumber: '1234567890',
    });
    const wb = await fillUtilityStatementWorkbook(input);
    const sheet = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
    const bankRow = findRowContainingLabel(sheet, 'Nama Bank');
    const nameRow = findRowContainingLabel(sheet, 'A.N');
    const rekRow = findRowByUniqueLabel(sheet, 'No. Rek');
    expect(sheet.getCell(`F${bankRow}`).value).toBe('BCA');
    expect(sheet.getCell(`F${nameRow}`).value).toBe('PT CABIN');
    expect(sheet.getCell(`F${rekRow}`).value).toBe('1234567890');
    expect(sheet.getCell(`F${rekRow}`).isMerged).toBe(true);
  });

  it('period subtotal excludes admin', async () => {
    const usageRp = Math.floor(52 * 1700);
    const elecKindTotal = usageRp + Math.floor((usageRp * 10) / 100) + 5_000;
    const input = exampleInput({
      adminAmountIdr: 99_000,
      periodSubtotalIdr: elecKindTotal + 50_000,
    });
    const wb = await openUtilityStatementWorkbook();
    writeUtilityStatementNamedFields(wb, input);
    expandUtilityStatementAddonRows(wb, input);
    writeUtilityStatementFooter(wb, input);
    const sheet = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
    const periodRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.periodSubtotal,
    );
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${periodRow}`).value,
    ).toBe(elecKindTotal + 50_000);
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${periodRow}`).value,
    ).not.toBe(elecKindTotal + 50_000 + 99_000);
    const dueRow = findRowByUniqueLabel(
      sheet,
      UTILITY_STATEMENT_FOOTER_LABELS.due,
    );
    expect(
      sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${dueRow}`).value,
    ).toBe(elecKindTotal + 50_000 + 99_000);
  });
});

import { Workbook, type Cell, type CellValue, type Worksheet } from 'exceljs';
import { UtilityAddonKind, type UtilityAddonLine } from '@cabin/api-contract';
import {
  UTILITY_ADDON_ROW_LAYOUT,
  UTILITY_STATEMENT_AMOUNT_COLUMN,
  UTILITY_STATEMENT_DUE_NUM_FMT,
  UTILITY_STATEMENT_FOOTER_LABELS,
  UTILITY_STATEMENT_HEADER_CELLS,
  UTILITY_STATEMENT_NAMES,
  UTILITY_STATEMENT_NOTE_SNIPPETS,
  UTILITY_STATEMENT_PAYMENT_LABELS,
  UTILITY_STATEMENT_PRINT_MARGINS_IN,
  UTILITY_STATEMENT_RATE_NUM_FMT,
  UTILITY_STATEMENT_SECTION_LABELS,
  UTILITY_STATEMENT_SHEET,
} from './utility-statement-cells.js';
import {
  formatBillingNoDisplay,
  formatStatementDateShort,
  formatStatementPeriodRange,
  parseUnitCodeForStatement,
  utilityStatementAmountDueIdr,
} from './utility-statement-layout.js';
import { patchUtilityStatementXlsxPrintSetup } from './utility-statement-print-patch.js';
import {
  measureStatementPrintContentInches,
  statementPaperTwipsForContent,
} from './utility-statement-print-size.js';
import { utilityStatementTemplatePath } from './utility-statement-path.js';

export type UtilityStatementFillInput = {
  guestName: string;
  guestPhone: string;
  unitCode: string;
  periodStart: string;
  periodEnd: string;
  billingNo: string;
  statementDate: string;
  maintenanceAmountIdr: number;
  elecStartKwh: number;
  elecEndKwh: number;
  elecActualUsage: number;
  /** Scheme min kWh — shown on the statement when billed usage exceeds actual. */
  elecMinKwh: number;
  elecBilledKwh: number;
  elecRate: number;
  elecUsageAmountIdr: number;
  elecKindTotalIdr: number;
  elecAddonLines: ReadonlyArray<UtilityAddonLine>;
  waterStartM3: number;
  waterEndM3: number;
  waterUsage: number;
  waterRate: number;
  waterUsageAmountIdr: number;
  waterKindTotalIdr: number;
  waterAddonLines: ReadonlyArray<UtilityAddonLine>;
  periodSubtotalIdr: number;
  adminAmountIdr: number;
  dueAmountIdr: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
};

const A1_IN_RANGE = /\$([A-Z]+)\$(\d+)/;

function sheetOf(wb: Workbook): Worksheet {
  const sheet = wb.getWorksheet(UTILITY_STATEMENT_SHEET) ?? wb.worksheets[0];
  if (!sheet) {
    throw new Error('utility-statement.xlsx has no worksheet');
  }
  return sheet;
}

function namedRangeA1(
  wb: Workbook,
  name: string,
): {
  col: string;
  row: number;
} {
  const ranges = wb.definedNames.getRanges(name).ranges;
  const raw = ranges[0];
  if (!raw) {
    throw new Error(`Defined name ${name} has no range`);
  }
  const match = A1_IN_RANGE.exec(raw.replace(/'/g, ''));
  if (!match) {
    throw new Error(`Defined name ${name} range is not a cell: ${raw}`);
  }
  return { col: match[1], row: Number(match[2]) };
}

export function namedCell(wb: Workbook, name: string): Cell {
  const { col, row } = namedRangeA1(wb, name);
  return sheetOf(wb).getCell(`${col}${row}`);
}

export function namedRowNumber(wb: Workbook, name: string): number {
  return namedRangeA1(wb, name).row;
}

function writeNamed(wb: Workbook, name: string, value: CellValue): void {
  namedCell(wb, name).value = value;
}

/** Write an amount without touching the template font / alignment / numFmt. */
export function writeIdrAmount(cell: Cell, value: number): void {
  cell.value = value;
}

function writeNamedIdrAmount(wb: Workbook, name: string, value: number): void {
  writeIdrAmount(namedCell(wb, name), value);
}

function writeNamedRate(wb: Workbook, name: string, value: number): void {
  const cell = namedCell(wb, name);
  cell.value = value;
  cell.numFmt = UTILITY_STATEMENT_RATE_NUM_FMT;
}

function cellText(value: CellValue): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('result' in value && value.result != null) {
      return cellText(value.result);
    }
  }
  return '';
}

export function findRowByUniqueLabel(sheet: Worksheet, label: string): number {
  let found: number | null = null;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cellText(cell.value) !== label) {
        return;
      }
      if (found != null && found !== row.number) {
        throw new Error(`Label ${label} is not unique`);
      }
      found = row.number;
    });
  });
  if (found == null) {
    throw new Error(`Label ${label} not found`);
  }
  return found;
}

export function findRowContainingLabel(
  sheet: Worksheet,
  snippet: string,
): number {
  let found: number | null = null;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!cellText(cell.value).includes(snippet)) {
        return;
      }
      if (found != null && found !== row.number) {
        throw new Error(`Snippet ${snippet} is not unique`);
      }
      found = row.number;
    });
  });
  if (found == null) {
    throw new Error(`Snippet ${snippet} not found`);
  }
  return found;
}

function writeAddonRow(
  sheet: Worksheet,
  rowNumber: number,
  line: UtilityAddonLine,
): void {
  const row = sheet.getRow(rowNumber);
  row.getCell(UTILITY_ADDON_ROW_LAYOUT.nameCol).value = line.name;
  // Leave E empty so long names overflow instead of clipping at the colon.
  row.getCell('E').value = null;
  if (line.kind === UtilityAddonKind.PERCENT) {
    row.getCell(UTILITY_ADDON_ROW_LAYOUT.kindCol).value = null;
    const rateCell = row.getCell(UTILITY_ADDON_ROW_LAYOUT.rateCol);
    rateCell.value = line.value / 100;
    rateCell.numFmt = '0%';
  } else {
    row.getCell(UTILITY_ADDON_ROW_LAYOUT.kindCol).value = 'konstan';
    row.getCell(UTILITY_ADDON_ROW_LAYOUT.rateCol).value = null;
  }
  writeIdrAmount(
    row.getCell(UTILITY_ADDON_ROW_LAYOUT.amountCol),
    line.amountIdr,
  );
}

/**
 * Expand/shrink the virgin sibling block at `anchorRow`.
 * `siblingCount` is rows from the anchor up to (not including) the subtotal.
 * Returns net row delta (inserted − deleted).
 */
export function expandAddonBlock(
  sheet: Worksheet,
  anchorRow: number,
  siblingCount: number,
  lines: ReadonlyArray<UtilityAddonLine>,
): number {
  const need = lines.length;
  const have = siblingCount;
  const extra = need - have;
  if (extra > 0) {
    sheet.duplicateRow(anchorRow, extra, true);
  } else if (extra < 0) {
    sheet.spliceRows(anchorRow + need, -extra);
  }
  for (let i = 0; i < need; i++) {
    writeAddonRow(sheet, anchorRow + i, lines[i]);
  }
  return extra;
}

export async function openUtilityStatementWorkbook(): Promise<Workbook> {
  const wb = new Workbook();
  await wb.xlsx.readFile(utilityStatementTemplatePath());
  return wb;
}

function writeHeaderBoxes(
  wb: Workbook,
  input: UtilityStatementFillInput,
): void {
  const sheet = sheetOf(wb);
  const unit = parseUnitCodeForStatement(input.unitCode);
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitPrefix).value = unit.prefix;
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitFloor).value = unit.floor;
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.unitRoom).value = unit.room;

  const periodRow = namedRowNumber(wb, UTILITY_STATEMENT_NAMES.periodStart);
  layoutStatementPeriodRow(
    sheet,
    periodRow,
    input.periodStart,
    input.periodEnd,
  );

  const billingRow = namedRowNumber(wb, UTILITY_STATEMENT_NAMES.billingNo);
  layoutStatementBillingNoRow(sheet, billingRow, input.billingNo);

  sheet.getCell('I9').value = null;
  sheet.getCell('J9').value = null;
  sheet.getCell('K9').value = null;
  sheet.getCell('L9').value = null;
}

/** Merge D:H so Periode reads `dd-mm-yy - dd-mm-yy` without column gaps. */
function layoutStatementPeriodRow(
  sheet: Worksheet,
  rowNumber: number,
  periodStart: string,
  periodEnd: string,
): void {
  const periodCell = sheet.getCell(`D${rowNumber}`);
  const periodFont = cloneFont(periodCell);
  tryUnmerge(sheet, `F${rowNumber}:H${rowNumber}`);
  tryUnmerge(sheet, `D${rowNumber}:H${rowNumber}`);
  for (const col of ['E', 'F', 'G', 'H'] as const) {
    sheet.getCell(`${col}${rowNumber}`).value = null;
  }
  sheet.mergeCells(`D${rowNumber}:H${rowNumber}`);
  periodCell.value = formatStatementPeriodRange(periodStart, periodEnd);
  if (periodFont) {
    periodCell.font = periodFont;
  }
}

/** Merge D:H so No. Billing reads `US-… / YYYY / MM` without slash gaps. */
function layoutStatementBillingNoRow(
  sheet: Worksheet,
  rowNumber: number,
  billingNo: string,
): void {
  const billingCell = sheet.getCell(`D${rowNumber}`);
  const billingFont = cloneFont(billingCell);
  tryUnmerge(sheet, `D${rowNumber}:H${rowNumber}`);
  for (const col of ['E', 'F', 'G', 'H'] as const) {
    sheet.getCell(`${col}${rowNumber}`).value = null;
  }
  sheet.mergeCells(`D${rowNumber}:H${rowNumber}`);
  billingCell.value = formatBillingNoDisplay(billingNo);
  if (billingFont) {
    billingCell.font = billingFont;
  }
}

/** Step 1–2: HEADER + meters + rates via defined names (before any insert). */
export function writeUtilityStatementNamedFields(
  wb: Workbook,
  input: UtilityStatementFillInput,
): void {
  writeNamed(wb, UTILITY_STATEMENT_NAMES.guestName, input.guestName);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.guestPhone, input.guestPhone);
  writeHeaderBoxes(wb, input);
  writeNamed(
    wb,
    UTILITY_STATEMENT_NAMES.statementDate,
    formatStatementDateShort(input.periodEnd),
  );
  writeNamedIdrAmount(
    wb,
    UTILITY_STATEMENT_NAMES.maintenanceAmount,
    input.maintenanceAmountIdr,
  );
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecStartKwh, input.elecStartKwh);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecEndKwh, input.elecEndKwh);
  writeNamed(
    wb,
    UTILITY_STATEMENT_NAMES.elecActualUsage,
    input.elecActualUsage,
  );
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecMinKwh, input.elecMinKwh);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecBilledKwh, input.elecBilledKwh);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecChargeKwh, input.elecBilledKwh);
  writeNamedRate(wb, UTILITY_STATEMENT_NAMES.elecRate, input.elecRate);
  writeNamedIdrAmount(
    wb,
    UTILITY_STATEMENT_NAMES.elecUsageAmount,
    input.elecUsageAmountIdr,
  );
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterStartM3, input.waterStartM3);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterEndM3, input.waterEndM3);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterUsage, input.waterUsage);
  writeNamedRate(wb, UTILITY_STATEMENT_NAMES.waterRate, input.waterRate);
  writeNamedIdrAmount(
    wb,
    UTILITY_STATEMENT_NAMES.waterUsageAmount,
    input.waterUsageAmountIdr,
  );
}

/** True when the scheme defines a minimum kWh row on the statement. */
export function electricityMinRowApplies(input: {
  elecMinKwh: number;
}): boolean {
  return input.elecMinKwh > 0;
}
export function expandUtilityStatementAddonRows(
  wb: Workbook,
  input: Pick<
    UtilityStatementFillInput,
    | 'elecAddonLines'
    | 'waterAddonLines'
    | 'elecKindTotalIdr'
    | 'waterKindTotalIdr'
  >,
): void {
  const sheet = sheetOf(wb);
  const elecAnchor = namedRowNumber(
    wb,
    UTILITY_STATEMENT_NAMES.elecAddonAnchorRow,
  );
  const elecSubtotal = namedRowNumber(wb, UTILITY_STATEMENT_NAMES.elecSubtotal);
  const waterAnchor = namedRowNumber(
    wb,
    UTILITY_STATEMENT_NAMES.waterAddonAnchorRow,
  );
  const waterSubtotal = namedRowNumber(
    wb,
    UTILITY_STATEMENT_NAMES.waterSubtotal,
  );
  const elecSiblings = elecSubtotal - elecAnchor;
  const waterSiblings = waterSubtotal - waterAnchor;

  const elecDelta = expandAddonBlock(
    sheet,
    elecAnchor,
    elecSiblings,
    input.elecAddonLines,
  );
  writeIdrAmount(
    sheet.getCell(
      `${UTILITY_STATEMENT_AMOUNT_COLUMN}${elecAnchor + input.elecAddonLines.length}`,
    ),
    input.elecKindTotalIdr,
  );

  const waterAnchorShifted = waterAnchor + elecDelta;
  expandAddonBlock(
    sheet,
    waterAnchorShifted,
    waterSiblings,
    input.waterAddonLines,
  );
  writeIdrAmount(
    sheet.getCell(
      `${UTILITY_STATEMENT_AMOUNT_COLUMN}${waterAnchorShifted + input.waterAddonLines.length}`,
    ),
    input.waterKindTotalIdr,
  );
}

/** Step 4: scan unique footer labels; write column L. */
export function writeUtilityStatementFooter(
  wb: Workbook,
  input: Pick<
    UtilityStatementFillInput,
    'periodSubtotalIdr' | 'adminAmountIdr' | 'dueAmountIdr'
  >,
): void {
  const sheet = sheetOf(wb);
  const periodRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.periodSubtotal,
  );
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${periodRow}`),
    input.periodSubtotalIdr,
  );

  const adminRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.admin,
  );
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${adminRow}`),
    input.adminAmountIdr,
  );

  const dueRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.due,
  );
  layoutDueAmountRow(
    sheet,
    dueRow,
    utilityStatementAmountDueIdr({
      periodSubtotalIdr: input.periodSubtotalIdr,
      adminAmountIdr: input.adminAmountIdr,
    }),
  );
}

function cloneFont(cell: Cell): Cell['font'] | undefined {
  return cell.font ? { ...cell.font } : undefined;
}

/**
 * Full "adalah" in D:I so H's colon cannot clip it to "adal:".
 * Colon stays Calibri in J; Rp / amount keep template chrome.
 */
function layoutDueAmountRow(
  sheet: Worksheet,
  rowNumber: number,
  amount: number,
): void {
  const dueCell = sheet.getCell(`D${rowNumber}`);
  const dueFont = cloneFont(dueCell);
  const colonFont =
    cloneFont(sheet.getCell(`J${rowNumber}`)) ??
    cloneFont(sheet.getCell(`H${rowNumber}`));
  tryUnmerge(sheet, `D${rowNumber}:J${rowNumber}`);
  tryUnmerge(sheet, `D${rowNumber}:I${rowNumber}`);
  tryUnmerge(sheet, `D${rowNumber}:G${rowNumber}`);
  for (const col of ['E', 'F', 'G', 'H', 'I'] as const) {
    sheet.getCell(`${col}${rowNumber}`).value = null;
  }
  sheet.mergeCells(`D${rowNumber}:I${rowNumber}`);
  dueCell.value = UTILITY_STATEMENT_FOOTER_LABELS.due;
  if (dueFont) {
    dueCell.font = dueFont;
  }
  const colonCell = sheet.getCell(`J${rowNumber}`);
  colonCell.value = ':';
  if (colonFont) {
    colonCell.font = colonFont;
  }
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${rowNumber}`),
    amount,
  );
  tryUnmerge(sheet, `L${rowNumber}:M${rowNumber}`);
  sheet.getCell(`M${rowNumber}`).value = null;
  const amountCell = sheet.getCell(
    `${UTILITY_STATEMENT_AMOUNT_COLUMN}${rowNumber}`,
  );
  amountCell.numFmt = UTILITY_STATEMENT_DUE_NUM_FMT;
}

function tryUnmerge(sheet: Worksheet, range: string): void {
  try {
    sheet.unMergeCells(range);
  } catch {
    // not merged
  }
}

/** Cara Pembayaran values in F — look up by label after add-on row shifts. */
export function writeUtilityStatementPayment(
  sheet: Worksheet,
  input: Pick<
    UtilityStatementFillInput,
    'bankName' | 'accountName' | 'accountNumber'
  >,
): void {
  writePaymentValue(
    sheet,
    UTILITY_STATEMENT_PAYMENT_LABELS.bankName,
    input.bankName,
  );
  writePaymentValue(
    sheet,
    UTILITY_STATEMENT_PAYMENT_LABELS.accountName,
    input.accountName,
  );
  writePaymentValue(
    sheet,
    UTILITY_STATEMENT_PAYMENT_LABELS.accountNumber,
    input.accountNumber,
  );
}

function writePaymentValue(
  sheet: Worksheet,
  snippet: string,
  value: string,
): void {
  const row = findRowContainingLabel(sheet, snippet);
  sheet.getCell(`F${row}`).value = value;
}

/** Compact spacer after the due line, before Catatan / jatuh tempo notes. */
const UTILITY_STATEMENT_FOOTER_SECTION_GAP_PT = 8;
/** Compact spacer around the Cara Pembayaran box (above and below). */
const UTILITY_STATEMENT_PAYMENT_BOX_GAP_PT = 6;
/** Single-line Catatan header — default row height leaves a loose gap to the bullet. */
const UTILITY_STATEMENT_CATATAN_HEADER_ROW_PT = 11;

/**
 * Collapse one or more empty template rows into a single short spacer row.
 */
function collapseRowGap(
  sheet: Worksheet,
  afterRow: number,
  beforeRow: number,
  spacerHeightPt: number,
): void {
  const gapCount = beforeRow - afterRow - 1;
  if (gapCount <= 0) {
    return;
  }

  if (gapCount === 1) {
    const spacer = sheet.getRow(afterRow + 1);
    spacer.hidden = false;
    spacer.height = spacerHeightPt;
    return;
  }

  for (let row = afterRow + 1; row < beforeRow - 1; row++) {
    sheet.getRow(row).hidden = true;
  }
  const spacer = sheet.getRow(beforeRow - 1);
  spacer.hidden = false;
  spacer.height = spacerHeightPt;
}

/**
 * Virgin template leaves full-height empty rows around the footer notes block and
 * payment box. Tighten to compact spacers so PDF/print matches a dense bill.
 */
function applyFooterNotesSpacing(sheet: Worksheet): void {
  const dueRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.due,
  );
  const catatanRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.catatan,
  );
  const jatuhRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.jatuhTempo,
  );
  const boxStartRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.caraPembayaran,
  );
  const boxEndRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_PAYMENT_LABELS.accountNumber,
  );
  const closingNotesRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.disconnect,
  );

  collapseRowGap(
    sheet,
    dueRow,
    catatanRow,
    UTILITY_STATEMENT_FOOTER_SECTION_GAP_PT,
  );
  sheet.getRow(catatanRow).height = UTILITY_STATEMENT_CATATAN_HEADER_ROW_PT;

  collapseRowGap(
    sheet,
    jatuhRow,
    boxStartRow,
    UTILITY_STATEMENT_PAYMENT_BOX_GAP_PT,
  );
  collapseRowGap(
    sheet,
    boxEndRow,
    closingNotesRow,
    UTILITY_STATEMENT_PAYMENT_BOX_GAP_PT,
  );
}

function restoreAccountNumberMerge(sheet: Worksheet): void {
  const rekRow = findRowByUniqueLabel(sheet, 'No. Rek');
  if (sheet.getCell(`F${rekRow}`).isMerged) {
    return;
  }
  tryUnmerge(sheet, `F${rekRow}:I${rekRow}`);
  const account = sheet.getCell(`F${rekRow}`).value;
  for (const col of ['G', 'H', 'I'] as const) {
    sheet.getCell(`${col}${rekRow}`).value = null;
  }
  sheet.getCell(`F${rekRow}`).value = account;
  sheet.mergeCells(`F${rekRow}:I${rekRow}`);
}

/** Compact bill — page size is patched to content width/height (not A4). */
function fitStatementToOnePage(sheet: Worksheet): void {
  const lastPrintRow = findStatementPrintLastRow(sheet);
  const { pageSetup } = sheet;
  pageSetup.fitToPage = false;
  pageSetup.scale = 100;
  pageSetup.orientation = 'portrait';
  pageSetup.printArea = `A2:M${lastPrintRow}`;
  pageSetup.margins = {
    left: UTILITY_STATEMENT_PRINT_MARGINS_IN.left,
    right: UTILITY_STATEMENT_PRINT_MARGINS_IN.right,
    top: UTILITY_STATEMENT_PRINT_MARGINS_IN.top,
    bottom: UTILITY_STATEMENT_PRINT_MARGINS_IN.bottom,
    header: UTILITY_STATEMENT_PRINT_MARGINS_IN.header,
    footer: UTILITY_STATEMENT_PRINT_MARGINS_IN.footer,
  };
  pageSetup.horizontalCentered = false;
  pageSetup.verticalCentered = false;
  pageSetup.showGridLines = false;
  pageSetup.showRowColHeaders = false;
}

export function utilityStatementPaperTwips(sheet: Worksheet): {
  widthTwips: number;
  heightTwips: number;
} {
  const lastPrintRow = findStatementPrintLastRow(sheet);
  const content = measureStatementPrintContentInches(sheet, lastPrintRow);
  return statementPaperTwipsForContent(content);
}

function outerFrameBottomStyle(
  sheet: Worksheet,
  row: number,
): string | undefined {
  return (
    sheet.getCell(`A${row}`).border?.bottom?.style ??
    sheet.getCell(`M${row}`).border?.bottom?.style
  );
}

/**
 * Last row for `printArea` — through the outer-frame closure row (medium bottom
 * on A/M), not only the last note line. Template uses A2:M51; stopping at the
 * note row (50) clips that closure border in LibreOffice PDF / paper print.
 */
export function findStatementPrintLastRow(sheet: Worksheet): number {
  const lastNoteRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.unpaidIfNoProof,
  );
  const closureRow = lastNoteRow + 1;
  const bottom = outerFrameBottomStyle(sheet, closureRow);
  if (bottom === 'medium' || bottom === 'double') {
    return closureRow;
  }
  return lastNoteRow;
}

function applyElectricityMeterRows(
  sheet: Worksheet,
  input: Pick<UtilityStatementFillInput, 'elecMinKwh'>,
): void {
  const listrik = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_SECTION_LABELS.electricity,
  );
  sheet.getRow(listrik).hidden = false;
  sheet.getRow(listrik + 1).hidden = false;
  sheet.getRow(listrik + 2).hidden = false;

  const minRow = listrik + 3;
  const spareRow = listrik + 4;
  const gapRow = listrik + 5;
  const showMin = electricityMinRowApplies(input);

  sheet.getRow(minRow).hidden = !showMin;
  sheet.getRow(spareRow).hidden = true;
  sheet.getRow(gapRow).hidden = true;

  if (showMin) {
    sheet.getCell(`F${minRow}`).value = input.elecMinKwh;
    sheet.getCell(`G${minRow}`).value = 'kWh';
    sheet.getCell(`H${minRow}`).value = null;
    sheet.getCell(`I${minRow}`).value = null;
    sheet.getCell(`J${minRow}`).value = null;
  }
}

export async function fillUtilityStatementWorkbook(
  input: UtilityStatementFillInput,
): Promise<Workbook> {
  const wb = await openUtilityStatementWorkbook();
  const sheet = sheetOf(wb);
  writeUtilityStatementNamedFields(wb, input);
  applyElectricityMeterRows(sheet, input);
  expandUtilityStatementAddonRows(wb, input);
  writeUtilityStatementFooter(wb, input);
  writeUtilityStatementPayment(sheet, input);
  restoreAccountNumberMerge(sheet);
  applyFooterNotesSpacing(sheet);
  fitStatementToOnePage(sheet);
  return wb;
}

export async function fillUtilityStatementXlsx(
  input: UtilityStatementFillInput,
): Promise<Buffer> {
  const wb = await fillUtilityStatementWorkbook(input);
  const sheet = sheetOf(wb);
  const paper = utilityStatementPaperTwips(sheet);
  const out = await wb.xlsx.writeBuffer();
  return patchUtilityStatementXlsxPrintSetup(Buffer.from(out), paper);
}

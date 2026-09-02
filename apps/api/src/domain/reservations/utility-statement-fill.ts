import {
  Workbook,
  type Borders,
  type Cell,
  type CellValue,
  type Worksheet,
} from 'exceljs';
import { UtilityAddonKind, type UtilityAddonLine } from '@cabin/api-contract';
import {
  UTILITY_ADDON_ROW_LAYOUT,
  UTILITY_STATEMENT_AMOUNT_COLUMN,
  UTILITY_STATEMENT_FOOTER_LABELS,
  UTILITY_STATEMENT_HEADER_CELLS,
  UTILITY_STATEMENT_IDR_NUM_FMT,
  UTILITY_STATEMENT_NAMES,
  UTILITY_STATEMENT_NOTE_SNIPPETS,
  UTILITY_STATEMENT_RATE_NUM_FMT,
  UTILITY_STATEMENT_SECTION_LABELS,
  UTILITY_STATEMENT_SHEET,
} from './utility-statement-cells.js';
import {
  formatStatementDateShort,
  parseBillingNoForStatement,
  parseStatementIsoDate,
  parseUnitCodeForStatement,
} from './utility-statement-layout.js';
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

function cloneCellChrome(cell: Cell): {
  font?: Cell['font'];
  border?: Cell['border'];
  fill?: Cell['fill'];
} {
  return {
    font: cell.font ? { ...cell.font } : undefined,
    border: cell.border
      ? (JSON.parse(JSON.stringify(cell.border)) as Cell['border'])
      : undefined,
    fill: cell.fill
      ? (JSON.parse(JSON.stringify(cell.fill)) as Cell['fill'])
      : undefined,
  };
}

function assignIsolatedStyle(
  cell: Cell,
  extras: {
    numFmt: string;
    alignment: NonNullable<Cell['alignment']>;
  },
): void {
  cell.style = {
    ...cloneCellChrome(cell),
    numFmt: extras.numFmt,
    alignment: extras.alignment,
  };
}

/** Standard IDR amount cell — thousands separators, right-aligned in column L. */
export function writeIdrAmount(cell: Cell, value: number): void {
  cell.value = value;
  assignIsolatedStyle(cell, {
    numFmt: UTILITY_STATEMENT_IDR_NUM_FMT,
    alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
  });
}

function writeRateAmount(cell: Cell, value: number): void {
  cell.value = value;
  assignIsolatedStyle(cell, {
    numFmt: UTILITY_STATEMENT_RATE_NUM_FMT,
    alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
  });
}

function writeTextLeft(cell: Cell, value: CellValue, wrapText = false): void {
  cell.value = value;
  assignIsolatedStyle(cell, {
    numFmt: '@',
    alignment: { vertical: 'middle', horizontal: 'left', wrapText },
  });
}

function writeTextCenter(cell: Cell, value: CellValue): void {
  cell.value = value;
  assignIsolatedStyle(cell, {
    numFmt: '@',
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false },
  });
}

function tryUnmerge(sheet: Worksheet, range: string): void {
  try {
    sheet.unMergeCells(range);
  } catch {
    // not merged
  }
}

function writeNamedIdrAmount(wb: Workbook, name: string, value: number): void {
  writeIdrAmount(namedCell(wb, name), value);
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
  writeTextLeft(row.getCell(UTILITY_ADDON_ROW_LAYOUT.nameCol), line.name);
  // Leave E empty so long names overflow instead of clipping at the colon.
  row.getCell('E').value = null;
  if (line.kind === UtilityAddonKind.PERCENT) {
    row.getCell(UTILITY_ADDON_ROW_LAYOUT.kindCol).value = null;
    const rateCell = row.getCell(UTILITY_ADDON_ROW_LAYOUT.rateCol);
    rateCell.value = line.value / 100;
    assignIsolatedStyle(rateCell, {
      numFmt: '0%',
      alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
    });
  } else {
    writeTextCenter(row.getCell(UTILITY_ADDON_ROW_LAYOUT.kindCol), 'konstan');
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

  const billing = parseBillingNoForStatement(input.billingNo);
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingId).value =
    billing.idPart;
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingYear).value =
    billing.year;
  sheet.getCell(UTILITY_STATEMENT_HEADER_CELLS.billingMonth).value =
    billing.month;
  sheet.getCell('I9').value = null;
  sheet.getCell('J9').value = null;
  sheet.getCell('K9').value = null;
  sheet.getCell('L9').value = null;
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
    UTILITY_STATEMENT_NAMES.periodStart,
    parseStatementIsoDate(input.periodStart),
  );
  writeNamed(
    wb,
    UTILITY_STATEMENT_NAMES.periodEnd,
    parseStatementIsoDate(input.periodEnd),
  );
  writeTextLeft(
    namedCell(wb, UTILITY_STATEMENT_NAMES.statementDate),
    formatStatementDateShort(input.statementDate),
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
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecBilledKwh, input.elecBilledKwh);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.elecChargeKwh, input.elecBilledKwh);
  writeRateAmount(
    namedCell(wb, UTILITY_STATEMENT_NAMES.elecRate),
    input.elecRate,
  );
  writeNamedIdrAmount(
    wb,
    UTILITY_STATEMENT_NAMES.elecUsageAmount,
    input.elecUsageAmountIdr,
  );
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterStartM3, input.waterStartM3);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterEndM3, input.waterEndM3);
  writeNamed(wb, UTILITY_STATEMENT_NAMES.waterUsage, input.waterUsage);
  writeRateAmount(
    namedCell(wb, UTILITY_STATEMENT_NAMES.waterRate),
    input.waterRate,
  );
  writeNamedIdrAmount(
    wb,
    UTILITY_STATEMENT_NAMES.waterUsageAmount,
    input.waterUsageAmountIdr,
  );
}

/** Step 3: duplicate addon anchors; do not use footer names after this. */
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
  writeTextLeft(
    sheet.getCell(`D${periodRow}`),
    UTILITY_STATEMENT_FOOTER_LABELS.periodSubtotal,
  );
  writeTextCenter(sheet.getCell(`K${periodRow}`), ':');
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${periodRow}`),
    input.periodSubtotalIdr,
  );

  const adminRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.admin,
  );
  writeTextLeft(
    sheet.getCell(`D${adminRow}`),
    UTILITY_STATEMENT_FOOTER_LABELS.admin,
  );
  writeTextCenter(sheet.getCell(`K${adminRow}`), ':');
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${adminRow}`),
    input.adminAmountIdr,
  );

  const dueRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_FOOTER_LABELS.due,
  );
  styleDueAmountRow(sheet, dueRow, input.dueAmountIdr);
}

function styleDueAmountRow(
  sheet: Worksheet,
  rowNumber: number,
  amount: number,
): void {
  tryUnmerge(sheet, `D${rowNumber}:J${rowNumber}`);
  tryUnmerge(sheet, `D${rowNumber}:G${rowNumber}`);
  tryUnmerge(sheet, `D${rowNumber}:I${rowNumber}`);
  for (const col of ['E', 'F', 'G', 'H', 'I']) {
    sheet.getCell(`${col}${rowNumber}`).value = null;
  }
  sheet.mergeCells(`D${rowNumber}:I${rowNumber}`);
  writeTextLeft(
    sheet.getCell(`D${rowNumber}`),
    UTILITY_STATEMENT_FOOTER_LABELS.due,
  );
  writeTextCenter(sheet.getCell(`J${rowNumber}`), ':');
  writeTextLeft(sheet.getCell(`K${rowNumber}`), 'Rp');
  writeIdrAmount(
    sheet.getCell(`${UTILITY_STATEMENT_AMOUNT_COLUMN}${rowNumber}`),
    amount,
  );
}

function restoreMeterBlockVisibility(sheet: Worksheet): void {
  const listrik = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_SECTION_LABELS.electricity,
  );
  sheet.getRow(listrik).hidden = false;
  sheet.getRow(listrik + 1).hidden = false;
  sheet.getRow(listrik + 2).hidden = false;
  sheet.getRow(listrik + 3).hidden = true;
  sheet.getRow(listrik + 4).hidden = true;
}

const MEDIUM_EDGE = { style: 'medium' as const };
const DOUBLE_EDGE = { style: 'double' as const };

function setIsolatedBorder(cell: Cell, border: Partial<Borders>): void {
  const cloned = JSON.parse(JSON.stringify(border)) as Partial<Borders>;
  cell.style = {
    ...cloneCellChrome(cell),
    numFmt: cell.numFmt ?? '@',
    alignment: cell.alignment ?? {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: false,
    },
    border: cloned,
  };
}

function clearInnerBorder(cell: Cell): void {
  cell.border = {};
}

function relocateNoteToContentColumn(
  sheet: Worksheet,
  snippet: string,
): number {
  const rowNumber = findRowContainingLabel(sheet, snippet);
  const fromB = cellText(sheet.getCell(`B${rowNumber}`).value);
  const fromD = cellText(sheet.getCell(`D${rowNumber}`).value);
  const text = fromD.includes(snippet) ? fromD : fromB;
  tryUnmerge(sheet, `D${rowNumber}:L${rowNumber}`);
  writeTextLeft(sheet.getCell(`D${rowNumber}`), text, true);
  sheet.getCell(`B${rowNumber}`).value = null;
  clearInnerBorder(sheet.getCell(`B${rowNumber}`));
  for (const col of ['C', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    const cell = sheet.getCell(`${col}${rowNumber}`);
    if (cellText(cell.value) === text) {
      cell.value = null;
    }
    clearInnerBorder(cell);
  }
  sheet.mergeCells(`D${rowNumber}:L${rowNumber}`);
  if (text.length > 70) {
    sheet.getRow(rowNumber).height = 32;
  }
  setIsolatedBorder(sheet.getCell(`A${rowNumber}`), { left: MEDIUM_EDGE });
  setIsolatedBorder(sheet.getCell(`M${rowNumber}`), { right: MEDIUM_EDGE });
  return rowNumber;
}

function paintPaymentBox(
  sheet: Worksheet,
  titleRow: number,
  lastRow: number,
): void {
  const boxCols = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
  if (titleRow > 1) {
    for (const col of boxCols) {
      const above = sheet.getCell(`${col}${titleRow - 1}`);
      if (above.border?.bottom) {
        const next = { ...(above.border ?? {}) };
        delete next.bottom;
        setIsolatedBorder(above, next);
      }
    }
  }
  for (let rowNumber = titleRow; rowNumber <= lastRow; rowNumber++) {
    clearInnerBorder(sheet.getCell(`C${rowNumber}`));
    const isTitle = rowNumber === titleRow;
    const isLast = rowNumber === lastRow;
    for (const col of boxCols) {
      const left = col === 'D';
      const right = col === 'L';
      setIsolatedBorder(sheet.getCell(`${col}${rowNumber}`), {
        left: left ? MEDIUM_EDGE : undefined,
        right: right ? MEDIUM_EDGE : undefined,
        top: isTitle ? MEDIUM_EDGE : undefined,
        bottom: isLast ? MEDIUM_EDGE : undefined,
      });
    }
  }
  sheet.getRow(lastRow).height = 22;
}

function clearPaymentBoxWallsBelow(
  sheet: Worksheet,
  boxLastRow: number,
  lastNoteRow: number,
): void {
  for (let rowNumber = boxLastRow + 1; rowNumber <= lastNoteRow; rowNumber++) {
    for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
      const cell = sheet.getCell(`${col}${rowNumber}`);
      const next = { ...(cell.border ?? {}) };
      delete next.left;
      delete next.right;
      delete next.top;
      if (rowNumber !== lastNoteRow) {
        delete next.bottom;
      }
      setIsolatedBorder(cell, next);
    }
    setIsolatedBorder(sheet.getCell(`A${rowNumber}`), { left: MEDIUM_EDGE });
    setIsolatedBorder(sheet.getCell(`M${rowNumber}`), { right: MEDIUM_EDGE });
  }
}

function restoreOuterFrame(
  sheet: Worksheet,
  fromRow: number,
  toRow: number,
): void {
  for (let rowNumber = fromRow; rowNumber <= toRow; rowNumber++) {
    const leftCell = sheet.getCell(`A${rowNumber}`);
    const rightCell = sheet.getCell(`M${rowNumber}`);
    setIsolatedBorder(leftCell, {
      ...(leftCell.border ?? {}),
      left: MEDIUM_EDGE,
    });
    setIsolatedBorder(rightCell, {
      ...(rightCell.border ?? {}),
      right: MEDIUM_EDGE,
    });
  }
}

function trimOuterFrameBelowNotes(sheet: Worksheet, lastNoteRow: number): void {
  for (const col of [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
  ]) {
    const cell = sheet.getCell(`${col}${lastNoteRow}`);
    const left = col === 'A' ? MEDIUM_EDGE : undefined;
    const right = col === 'M' ? MEDIUM_EDGE : undefined;
    setIsolatedBorder(cell, {
      left,
      right,
      bottom: DOUBLE_EDGE,
    });
  }
  for (
    let rowNumber = lastNoteRow + 1;
    rowNumber <= lastNoteRow + 3;
    rowNumber++
  ) {
    for (const col of [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
    ]) {
      clearInnerBorder(sheet.getCell(`${col}${rowNumber}`));
    }
  }
  sheet.pageSetup.printArea = `A2:M${lastNoteRow}`;
}

function repairPaymentAndAccount(sheet: Worksheet): void {
  const noteSnippets = [
    UTILITY_STATEMENT_NOTE_SNIPPETS.catatan,
    UTILITY_STATEMENT_NOTE_SNIPPETS.jatuhTempo,
    UTILITY_STATEMENT_NOTE_SNIPPETS.disconnect,
    UTILITY_STATEMENT_NOTE_SNIPPETS.computerPrint,
    UTILITY_STATEMENT_NOTE_SNIPPETS.rekeningOnly,
    UTILITY_STATEMENT_NOTE_SNIPPETS.transferProof,
    UTILITY_STATEMENT_NOTE_SNIPPETS.unpaidIfNoProof,
  ];
  let lastNoteRow = 0;
  for (const snippet of noteSnippets) {
    lastNoteRow = Math.max(
      lastNoteRow,
      relocateNoteToContentColumn(sheet, snippet),
    );
  }

  const titleRow = findRowContainingLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.caraPembayaran,
  );
  const rekRow = findRowByUniqueLabel(sheet, 'No. Rek');

  writeTextLeft(
    sheet.getCell(`E${titleRow}`),
    cellText(sheet.getCell(`E${titleRow}`).value) || ': ',
  );

  const payRow = findRowByUniqueLabel(
    sheet,
    UTILITY_STATEMENT_NOTE_SNIPPETS.payTransfer,
  );
  writeTextLeft(
    sheet.getCell(`D${payRow}`),
    UTILITY_STATEMENT_NOTE_SNIPPETS.payTransfer,
  );

  tryUnmerge(sheet, `F${rekRow}:I${rekRow}`);
  const account = sheet.getCell(`F${rekRow}`).value;
  for (const col of ['G', 'H', 'I']) {
    sheet.getCell(`${col}${rekRow}`).value = null;
  }
  writeTextLeft(sheet.getCell(`F${rekRow}`), account);
  sheet.mergeCells(`F${rekRow}:I${rekRow}`);
  paintPaymentBox(sheet, titleRow, rekRow);
  clearPaymentBoxWallsBelow(sheet, rekRow, lastNoteRow);
  restoreOuterFrame(sheet, 2, lastNoteRow);

  trimOuterFrameBelowNotes(sheet, lastNoteRow);
}

export async function fillUtilityStatementWorkbook(
  input: UtilityStatementFillInput,
): Promise<Workbook> {
  const wb = await openUtilityStatementWorkbook();
  const sheet = sheetOf(wb);
  sheet.getColumn('G').width = 4;
  sheet.getColumn('I').width = 8;
  writeUtilityStatementNamedFields(wb, input);
  restoreMeterBlockVisibility(sheet);
  expandUtilityStatementAddonRows(wb, input);
  writeUtilityStatementFooter(wb, input);
  repairPaymentAndAccount(sheetOf(wb));
  return wb;
}

export async function fillUtilityStatementXlsx(
  input: UtilityStatementFillInput,
): Promise<Buffer> {
  const wb = await fillUtilityStatementWorkbook(input);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

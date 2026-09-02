/**
 * Idempotent layout repair for apps/api/assets/utility-statement.xlsx.
 * Run from repo root: node apps/api/scripts/patch-utility-statement-template.mjs
 *
 * Matches the left statement in the original Utilities.xlsx, plus utilities-only
 * footer (no kurang pembayaran) and Maintenance instead of Service Charge.
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(
  __dirname,
  '..',
  'assets',
  'utility-statement.xlsx',
);

const IDR_AMOUNT_FMT = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
const RATE_FMT = '#,##0';

const FOOTER = {
  periodSubtotal: 'Tagihan Bulan ini',
  admin: 'Admin',
  due: 'Tagihan yang harus dibayar saat ini adalah',
  catatan: 'Catatan :',
  kurang: 'kurang pembayaran',
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(templatePath);
const ws = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];

function cellText(cell) {
  const value = cell.value;
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object' && value.richText) {
    return value.richText.map((part) => part.text).join('');
  }
  return String(value);
}

function assignStyle(cell, extras) {
  const font = cell.font ? { ...cell.font } : { name: 'Calibri', size: 11 };
  cell.style = {
    font,
    border: cell.border
      ? JSON.parse(JSON.stringify(cell.border))
      : undefined,
    fill: cell.fill ? JSON.parse(JSON.stringify(cell.fill)) : undefined,
    numFmt: extras.numFmt ?? '@',
    alignment: extras.alignment ?? {
      vertical: 'bottom',
      horizontal: 'left',
      wrapText: false,
    },
  };
}

function styleIdrAmountCell(address, value = 0) {
  const cell = ws.getCell(address);
  cell.value = value;
  assignStyle(cell, {
    numFmt: IDR_AMOUNT_FMT,
    alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
  });
}

function styleTextLeft(address, value) {
  const cell = ws.getCell(address);
  if (value !== undefined) {
    cell.value = value;
  }
  assignStyle(cell, {
    numFmt: '@',
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: false },
  });
}

function styleTextCenter(address, value) {
  const cell = ws.getCell(address);
  if (value !== undefined) {
    cell.value = value;
  }
  assignStyle(cell, {
    numFmt: '@',
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false },
  });
}

function rowHasExactLabel(rowNumber, label) {
  let found = false;
  ws.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
    if (cellText(cell) === label) {
      found = true;
    }
  });
  return found;
}

function findRowByExactLabel(label) {
  for (let rowNumber = 1; rowNumber <= 60; rowNumber++) {
    if (rowHasExactLabel(rowNumber, label)) {
      return rowNumber;
    }
  }
  return null;
}

function findRowContaining(substring) {
  for (let rowNumber = 1; rowNumber <= 60; rowNumber++) {
    let found = false;
    ws.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
      if (cellText(cell).includes(substring)) {
        found = true;
      }
    });
    if (found) {
      return rowNumber;
    }
  }
  return null;
}

function tryUnmerge(range) {
  try {
    ws.unMergeCells(range);
  } catch {
    // not merged
  }
}

function setDefinedName(name, cellRef) {
  const col = cellRef.replace(/\d+/g, '');
  const row = cellRef.replace(/\D+/g, '');
  delete wb.definedNames.matrixMap[name];
  wb.definedNames.add(`Sheet1!$${col}$${row}`, name);
}

function styleFooterLabelRow(rowNumber, label) {
  styleTextLeft(`D${rowNumber}`, label);
  styleTextCenter(`K${rowNumber}`, ':');
  styleIdrAmountCell(`L${rowNumber}`, ws.getCell(`L${rowNumber}`).value ?? 0);
}

function styleDueRow(rowNumber) {
  tryUnmerge(`D${rowNumber}:J${rowNumber}`);
  tryUnmerge(`D${rowNumber}:G${rowNumber}`);
  tryUnmerge(`D${rowNumber}:I${rowNumber}`);
  for (const col of ['E', 'F', 'G', 'H', 'I']) {
    const cell = ws.getCell(`${col}${rowNumber}`);
    cell.value = null;
    assignStyle(cell, { numFmt: '@' });
  }
  ws.mergeCells(`D${rowNumber}:I${rowNumber}`);
  styleTextLeft(`D${rowNumber}`, FOOTER.due);
  styleTextCenter(`J${rowNumber}`, ':');
  styleTextLeft(`K${rowNumber}`, 'Rp');
  styleIdrAmountCell(`L${rowNumber}`, ws.getCell(`L${rowNumber}`).value ?? 0);
}

function mergeAccountRow(rowNumber) {
  tryUnmerge(`F${rowNumber}:I${rowNumber}`);
  const value = ws.getCell(`F${rowNumber}`).value;
  for (const col of ['G', 'H', 'I']) {
    ws.getCell(`${col}${rowNumber}`).value = null;
  }
  ws.getCell(`F${rowNumber}`).value = value;
  assignStyle(ws.getCell(`F${rowNumber}`), {
    numFmt: '@',
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: false },
  });
  ws.mergeCells(`F${rowNumber}:I${rowNumber}`);
}

const kurangRow = findRowByExactLabel(FOOTER.kurang);
if (kurangRow != null) {
  ws.spliceRows(kurangRow, 1);
}

function rowIsBlank(rowNumber) {
  let empty = true;
  ws.getRow(rowNumber).eachCell({ includeEmpty: false }, () => {
    empty = false;
  });
  return empty;
}

const listrikRow = findRowContaining('Listrik (Electricity)');
if (listrikRow === 17 && [13, 14, 15, 16].every(rowIsBlank)) {
  ws.spliceRows(13, 4);
}

ws.getCell('B12').numFmt = '@';
styleTextLeft('D12', 'Maintenance');
styleTextCenter('K12', ':');
styleIdrAmountCell('L12', ws.getCell('L12').value ?? 0);

const listrikRowAfter = findRowContaining('Listrik (Electricity)');
if (listrikRowAfter != null) {
  ws.getRow(listrikRowAfter).hidden = false;
  ws.getRow(listrikRowAfter + 1).hidden = false;
  ws.getRow(listrikRowAfter + 2).hidden = false;
  // Minimum jam × kVA is unused; billed kWh is on Tagihan terhutang.
  ws.getRow(listrikRowAfter + 3).hidden = true;
  ws.getRow(listrikRowAfter + 4).hidden = true;
}

const tagihanRow = findRowContaining('Tagihan terhutang');
if (tagihanRow != null) {
  const rateCell = ws.getCell(`I${tagihanRow}`);
  rateCell.numFmt = RATE_FMT;
  assignStyle(rateCell, {
    numFmt: RATE_FMT,
    alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
  });
}

// Electricity also has Pemakaian / Usage — water rate is the I cell next to Rp/m3.
for (let rowNumber = 1; rowNumber <= 60; rowNumber++) {
  if (cellText(ws.getCell(`J${rowNumber}`)) === 'Rp/m3') {
    const rateCell = ws.getCell(`I${rowNumber}`);
    assignStyle(rateCell, {
      numFmt: RATE_FMT,
      alignment: { vertical: 'middle', horizontal: 'right', wrapText: false },
    });
  }
}

const amountRows =
  listrikRowAfter === 13
    ? [19, 20, 21, 22, 26, 27, 28, 29, 30]
    : [23, 24, 25, 26, 30, 31, 32, 33, 34];
for (const rowNumber of amountRows) {
  const cell = ws.getCell(`L${rowNumber}`);
  styleIdrAmountCell(
    `L${rowNumber}`,
    cell.value == null ? 0 : cell.value,
  );
}

for (const col of ['I', 'J', 'K', 'L']) {
  ws.getCell(`${col}9`).value = null;
}

const periodRow =
  findRowByExactLabel(FOOTER.periodSubtotal) ??
  findRowContaining(FOOTER.periodSubtotal);
const adminRow = findRowByExactLabel(FOOTER.admin);
const dueRow =
  findRowByExactLabel(FOOTER.due) ??
  findRowContaining('Tagihan yang harus dibayar');

if (periodRow == null || adminRow == null || dueRow == null) {
  throw new Error(
    `Footer rows missing (period=${periodRow}, admin=${adminRow}, due=${dueRow})`,
  );
}

styleFooterLabelRow(periodRow, FOOTER.periodSubtotal);
styleFooterLabelRow(adminRow, FOOTER.admin);
styleDueRow(dueRow);

const jatuhRow = findRowContaining('Tanggal Jatuh tempo');
let catatanRow = findRowByExactLabel(FOOTER.catatan);
if (catatanRow === dueRow) {
  ws.getCell(`B${catatanRow}`).value = null;
  catatanRow = null;
}
if (jatuhRow != null && catatanRow != null && catatanRow > jatuhRow) {
  const jatuhText = cellText(ws.getCell(`B${jatuhRow}`));
  styleTextLeft(`B${jatuhRow}`, FOOTER.catatan);
  styleTextLeft(`B${catatanRow}`, jatuhText);
  catatanRow = jatuhRow;
} else if (catatanRow == null) {
  catatanRow = dueRow + 1;
  styleTextLeft(`B${catatanRow}`, FOOTER.catatan);
} else {
  styleTextLeft(`B${catatanRow}`, FOOTER.catatan);
}

const payRow = findRowContaining('Pembayaran dapat ditransfer');
if (payRow != null) {
  styleTextLeft(`D${payRow}`);
}

const rekRow = findRowByExactLabel('No. Rek');
if (rekRow != null) {
  mergeAccountRow(rekRow);
}

setDefinedName('PeriodSubtotal', `L${periodRow}`);
setDefinedName('AdminAmount', `L${adminRow}`);
setDefinedName('DueAmount', `L${dueRow}`);

const names = wb.definedNames.model;
if (Array.isArray(names)) {
  for (const entry of names) {
    if (typeof entry.name === 'string' && entry.name.includes('$')) {
      delete wb.definedNames.matrixMap[entry.name];
    }
  }
}

ws.pageSetup.fitToPage = true;
ws.pageSetup.fitToWidth = 1;
ws.pageSetup.fitToHeight = 1;
ws.pageSetup.orientation = 'portrait';
ws.pageSetup.paperSize = 9;
ws.pageSetup.printArea = 'A2:M50';
ws.pageSetup.margins = {
  left: 0.4,
  right: 0.4,
  top: 0.5,
  bottom: 0.5,
  header: 0.25,
  footer: 0.25,
};

// Column I must fit readings like 20347.1 (`0.0`); G only holds kWh/m3/jam.
ws.getColumn('G').width = 4;
ws.getColumn('I').width = 8;

function moveNoteToD(snippet) {
  const rowNumber = findRowContaining(snippet);
  if (rowNumber == null) {
    return;
  }
  const fromB = cellText(ws.getCell(`B${rowNumber}`));
  const fromD = cellText(ws.getCell(`D${rowNumber}`));
  const text = fromD.includes(snippet) ? fromD : fromB;
  tryUnmerge(`D${rowNumber}:L${rowNumber}`);
  styleTextLeft(`D${rowNumber}`, text);
  ws.getCell(`B${rowNumber}`).value = null;
  for (const col of ['F', 'G', 'H', 'I', 'J']) {
    const cell = ws.getCell(`${col}${rowNumber}`);
    if (cell.border?.bottom) {
      const next = { ...cell.border };
      delete next.bottom;
      cell.border = next;
    }
  }
}

for (const snippet of [
  FOOTER.catatan,
  'Tanggal Jatuh tempo',
  'Apabila penghuni belum melunasi',
  'Surat tagihan ini adalah cetakan komputer',
  'Pembayaran hanya di terima',
  'Bukti transfer pembayaran',
  'Jika tidak mengirim bukti pembayaran',
]) {
  moveNoteToD(snippet);
}

const caraRow = findRowContaining('Cara Pembayaran');
const boxRekRow = findRowByExactLabel('No. Rek');
if (caraRow != null && boxRekRow != null) {
  const medium = { style: 'medium' };
  if (caraRow > 1) {
    for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J']) {
      const above = ws.getCell(`${col}${caraRow - 1}`);
      if (above.border?.bottom) {
        const next = { ...above.border };
        delete next.bottom;
        above.border = next;
      }
    }
  }
  for (let rowNumber = caraRow; rowNumber <= boxRekRow; rowNumber++) {
    ws.getCell(`C${rowNumber}`).border = {};
    const isTitle = rowNumber === caraRow;
    const isLast = rowNumber === boxRekRow;
    for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
      ws.getCell(`${col}${rowNumber}`).border = {
        left: col === 'D' ? medium : undefined,
        right: col === 'L' ? medium : undefined,
        top: isTitle ? medium : undefined,
        bottom: isLast ? medium : undefined,
      };
    }
  }
  ws.getRow(boxRekRow).height = 22;
}

const lastNote = findRowContaining('Jika tidak mengirim bukti pembayaran');
if (lastNote != null) {
  for (let rowNumber = lastNote + 1; rowNumber <= lastNote + 3; rowNumber++) {
    for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
      ws.getCell(`${col}${rowNumber}`).border = {};
    }
  }
  ws.pageSetup.printArea = `A2:M${lastNote}`;
}

await wb.xlsx.writeFile(templatePath);
console.log(
  `Patched ${templatePath} (due=L${dueRow}, catatan=B${catatanRow}, listrik=${listrikRowAfter})`,
);

/**
 * Rebind defined names on the hand-edited template.
 *
 * Canonical file: apps/api/assets/utility-statement.xlsx
 * Does not copy from Utilities.xlsx, splice rows, or restyle cells.
 *
 *   node apps/api/scripts/rebuild-utility-statement-template.mjs
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, '..', 'assets', 'utility-statement.xlsx');

if (process.argv[2]) {
  console.error(
    'The template is apps/api/assets/utility-statement.xlsx. Do not pass another workbook — that used to overwrite hand edits.',
  );
  process.exit(1);
}

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
  return '';
}

function findRow(ws, col, needle, { exact = false } = {}) {
  const last = Math.max(ws.rowCount, 60);
  for (let r = 1; r <= last; r++) {
    const text = cellText(ws.getCell(`${col}${r}`));
    if (exact ? text === needle : text.includes(needle)) {
      return r;
    }
  }
  throw new Error(`No ${col} cell matching ${JSON.stringify(needle)}`);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(templatePath);
const ws = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];

const maintenance = findRow(ws, 'D', 'Maintenance', { exact: true });
const listrik = findRow(ws, 'D', 'Listrik (Electricity)');
const water = findRow(ws, 'D', 'Air Bersih (Water Consumption)');
const periodSubtotal = findRow(ws, 'D', 'Tagihan Bulan ini');
const admin = findRow(ws, 'D', 'Admin', { exact: true });
const due = findRow(ws, 'D', 'Tagihan yang harus dibayar saat ini');

const NAMES = {
  Title: 'G3',
  GuestName: 'D5',
  GuestPhone: 'D6',
  UnitCode: 'D7',
  PeriodStart: 'D8',
  PeriodEnd: 'F8',
  BillingNo: 'D9',
  StatementDate: `B${maintenance}`,
  MaintenanceAmount: `L${maintenance}`,
  ElecStartKwh: `F${listrik + 1}`,
  ElecEndKwh: `I${listrik + 1}`,
  ElecActualUsage: `F${listrik + 2}`,
  ElecBilledKwh: `F${listrik + 4}`,
  ElecChargeKwh: `F${listrik + 6}`,
  ElecRate: `I${listrik + 6}`,
  ElecUsageAmount: `L${listrik + 6}`,
  ElecAddonAnchor: `D${listrik + 7}`,
  ElecSubtotal: `L${listrik + 9}`,
  WaterStartM3: `F${water + 1}`,
  WaterEndM3: `I${water + 1}`,
  WaterUsage: `F${water + 2}`,
  WaterRate: `I${water + 2}`,
  WaterUsageAmount: `L${water + 2}`,
  WaterAddonAnchor: `D${water + 3}`,
  WaterSubtotal: `L${water + 6}`,
  PeriodSubtotal: `L${periodSubtotal}`,
  AdminAmount: `L${admin}`,
  DueAmount: `L${due}`,
};

for (const [name, addr] of Object.entries(NAMES)) {
  const col = addr.replace(/\d+/g, '');
  const row = addr.replace(/\D+/g, '');
  delete wb.definedNames.matrixMap[name];
  wb.definedNames.add(`Sheet1!$${col}$${row}`, name);
}

await wb.xlsx.writeFile(templatePath);
console.log(`Rebound names on ${templatePath} (layout unchanged)`);
console.log(
  `maint=R${maintenance} listrik=R${listrik} water=R${water} due=R${due} DueAmount=L${due}`,
);

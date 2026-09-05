/**
 * Cell map for `apps/api/assets/utility-statement.xlsx` (one statement, A–M).
 *
 * Fill order (locked):
 * 1. Open the virgin workbook. Defined names are absolute (`Sheet1!$F$18`).
 *    exceljs `insertRow` does not rewrite them — they are only safe before
 *    any insert or delete.
 * 2. Write HEADER + meter inputs via `UTILITY_STATEMENT_NAMES`. Header rows
 *    never move. Electricity meters sit above `ElecAddonAnchor`. Water meters
 *    sit *below* that anchor — write them before inserting electricity add-on
 *    rows, or re-find the block by the unique title "Air Bersih (Water Consumption)".
 * 3. Duplicate the whole `ElecAddonAnchor` / `WaterAddonAnchor` row (cloned from
 *    the original Area Publik / Abodemen styled rows). Insert extra copies
 *    at/below the anchor. Overwrite name / kind / amount using
 *    `UTILITY_ADDON_ROW_LAYOUT`. Extra pre-filled sibling fee rows in the
 *    virgin sheet may be overwritten or deleted. Zero add-ons → hide/delete
 *    the marker.
 * 4. Footer amounts must not use named cells after step 3. Scan for the unique
 *    strings in `UTILITY_STATEMENT_FOOTER_LABELS`, then write column L on the
 *    same row (`UTILITY_STATEMENT_AMOUNT_COLUMN`). Period subtotal is
 *    elec + water + maintenance, not Admin. Due = period subtotal + Admin
 *    (utilities-only; no rent / stay Paid line).
 *
 * Styling lives in `apps/api/assets/utility-statement.xlsx` (hand-edited).
 * Do not regenerate that file from an external Utilities.xlsx. Due label is
 * merged D:I so "adalah" is not clipped by the colon, colon in J, due amount
 * in L only (no L:M merge). Compact `#,##0.00` so 12pt does not ###.
 * Amounts keep template alignment (center / accounting). Fill writes values
 * and re-applies the due merge after add-on expansion. Virgin footer names
 * exist for preview only. Do not treat `$L$35` as stable after add-on expansion.
 */

export const UTILITY_STATEMENT_SHEET = 'Sheet1';

/** Amount column for line items, subtotals, and footer (Biaya). */
export const UTILITY_STATEMENT_AMOUNT_COLUMN = 'L';

/** IDR accounting format (matches PMS utilities statement column L). */
export const UTILITY_STATEMENT_IDR_NUM_FMT =
  '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';

/** Compact thousands format for Rp/kWh and Rp/m3 — accounting pads overflow column I as ###. */
export const UTILITY_STATEMENT_RATE_NUM_FMT = '#,##0';

/** Due amount in L only — accounting pads + 12pt overflow as ###. */
export const UTILITY_STATEMENT_DUE_NUM_FMT = '#,##0.00';

/** Header boxed cells (not single-cell defined names). */
export const UTILITY_STATEMENT_HEADER_CELLS = {
  unitPrefix: 'D7',
  unitFloor: 'F7',
  unitRoom: 'G7',
  /** Legacy anchors — fill merges D:H on the billing row for display. */
  billingId: 'D9',
  billingYear: 'F9',
  billingMonth: 'H9',
} as const;

/** Defined names in utility-statement.xlsx. Values are Excel defined-name strings. */
export const UTILITY_STATEMENT_NAMES = {
  title: 'Title',
  guestName: 'GuestName',
  guestPhone: 'GuestPhone',
  unitCode: 'UnitCode', // legacy single cell; fill uses UTILITY_STATEMENT_HEADER_CELLS
  periodStart: 'PeriodStart',
  periodEnd: 'PeriodEnd',
  billingNo: 'BillingNo', // legacy; fill uses UTILITY_STATEMENT_HEADER_CELLS
  statementDate: 'StatementDate', // B12 Tanggal = period end (F8), not today
  maintenanceAmount: 'MaintenanceAmount',
  elecStartKwh: 'ElecStartKwh',
  elecEndKwh: 'ElecEndKwh',
  elecActualUsage: 'ElecActualUsage',
  elecMinKwh: 'ElecMinKwh',
  elecBilledKwh: 'ElecBilledKwh',
  /** Billed kWh on the Tagihan terhutang row (same number as ElecBilledKwh). */
  elecChargeKwh: 'ElecChargeKwh',
  elecRate: 'ElecRate',
  elecUsageAmount: 'ElecUsageAmount',
  elecAddonAnchorRow: 'ElecAddonAnchor', // row to duplicate
  elecSubtotal: 'ElecSubtotal',
  waterStartM3: 'WaterStartM3',
  waterEndM3: 'WaterEndM3',
  waterUsage: 'WaterUsage',
  waterRate: 'WaterRate',
  waterUsageAmount: 'WaterUsageAmount',
  waterAddonAnchorRow: 'WaterAddonAnchor',
  waterSubtotal: 'WaterSubtotal',
  periodSubtotal: 'PeriodSubtotal', // Tagihan Bulan ini = elec+water+maint (NOT admin)
  adminAmount: 'AdminAmount',
  dueAmount: 'DueAmount', // utilities subtotal + admin (excludes rent)
} as const;

/**
 * Columns on the electricity / water add-on marker row.
 * Wave 5 copies the whole row, then overwrites these cells.
 * CONSTANT → `kindCol` "konstan". PERCENT → empty `kindCol`; `rateCol` is
 * value/100 with Excel `0%` (10 → 10%, not 1000% %).
 */
export const UTILITY_ADDON_ROW_LAYOUT = {
  nameCol: 'D',
  kindCol: 'H',
  rateCol: 'F',
  amountCol: 'L',
} as const;

export const UTILITY_STATEMENT_FOOTER_LABELS = {
  periodSubtotal: 'Tagihan Bulan ini',
  admin: 'Admin',
  /** Label is D:I (merged). Colon in J, "Rp" in K, amount in L. */
  due: 'Tagihan yang harus dibayar saat ini adalah',
} as const;

export const UTILITY_STATEMENT_SECTION_LABELS = {
  electricity: 'Listrik (Electricity)',
  electricityMinUsage: 'Minimum pakai',
  water: 'Air Bersih (Water Consumption)',
  maintenance: 'Maintenance',
  hasilAkhir: 'Hasil Akhir Tagihan :',
} as const;

/** Footer notes live in column B (original overflow). Payment box is D–J. */
export const UTILITY_STATEMENT_NOTE_SNIPPETS = {
  catatan: 'Catatan :',
  jatuhTempo: 'Tanggal Jatuh tempo',
  disconnect: 'Apabila penghuni belum melunasi',
  computerPrint: 'Surat tagihan ini adalah cetakan komputer',
  rekeningOnly: 'Pembayaran hanya di terima',
  transferProof: 'Bukti transfer pembayaran',
  unpaidIfNoProof: 'Jika tidak mengirim bukti pembayaran',
  caraPembayaran: 'Cara Pembayaran',
  payTransfer: '- Pembayaran dapat ditransfer ke rekening berikut :',
} as const;

/**
 * Cara Pembayaran labels (column D). Values go in column F on the same row
 * (virgin template F42 / F43 / F44). Find by label after add-on expansion —
 * those row numbers are not stable.
 */
export const UTILITY_STATEMENT_PAYMENT_LABELS = {
  bankName: 'Nama Bank',
  accountName: 'A.N',
  accountNumber: 'No. Rek',
} as const;

/** Virgin-template value cells (invalid after add-on insert/delete). */
export const UTILITY_STATEMENT_PAYMENT_VALUE_CELLS = {
  bankName: 'F42',
  accountName: 'F43',
  accountNumber: 'F44',
} as const;

/**
 * Tight print margins (inches) for a compact utility bill — not full A4 office
 * margins. Keeps the payment-box border inside the printable area while letting
 * the PDF page size track the statement height (add-on rows).
 */
export const UTILITY_STATEMENT_PRINT_MARGINS_IN = {
  left: 0.25,
  right: 0.25,
  top: 0.25,
  bottom: 0.25,
  header: 0.15,
  footer: 0.15,
} as const;

/**
 * 1-based row numbers on the unused template. Invalid after add-on inserts.
 */
export const UTILITY_STATEMENT_VIRGIN_ROWS = {
  title: 3,
  maintenance: 12,
  elecAddonAnchor: 20,
  elecSubtotal: 22,
  waterAddonAnchor: 27,
  waterSubtotal: 30,
  periodSubtotal: 33,
  admin: 34,
  due: 35,
} as const;

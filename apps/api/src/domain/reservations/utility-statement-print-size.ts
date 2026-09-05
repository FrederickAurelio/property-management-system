import type { Worksheet } from 'exceljs';
import { UTILITY_STATEMENT_PRINT_MARGINS_IN } from './utility-statement-cells.js';

/** Columns A–M on the hand-edited template (print area width). */
export const UTILITY_STATEMENT_PRINT_COLUMN_COUNT = 13;

/** First content row inside the outer frame (row 1 is unused). */
export const UTILITY_STATEMENT_PRINT_FIRST_ROW = 2;

/** Excel column width (char units) → inches for Calibri 11 default metrics. */
export function excelColumnWidthToInches(charWidth: number): number {
  return ((charWidth + 0.71) * 7) / 96;
}

/** Inches → OOXML `paperWidth` / `paperHeight` (twentieths of a point). */
export function inchesToPaperTwips(inches: number): number {
  return Math.round(inches * 1440);
}

export type StatementPrintContentInches = {
  width: number;
  height: number;
};

export type StatementPaperTwips = {
  widthTwips: number;
  heightTwips: number;
};

/** Sum column widths A–M and row heights inside the print area. */
export function measureStatementPrintContentInches(
  sheet: Worksheet,
  lastPrintRow: number,
): StatementPrintContentInches {
  let width = 0;
  for (let col = 1; col <= UTILITY_STATEMENT_PRINT_COLUMN_COUNT; col++) {
    width += excelColumnWidthToInches(sheet.getColumn(col).width ?? 8.43);
  }

  let heightPt = 0;
  for (
    let row = UTILITY_STATEMENT_PRINT_FIRST_ROW;
    row <= lastPrintRow;
    row++
  ) {
    const rowObj = sheet.getRow(row);
    if (rowObj.hidden) {
      continue;
    }
    heightPt += rowObj.height ?? 15;
  }

  return { width, height: heightPt / 72 };
}

/**
 * Compact bill page — content box + tight margins (not full A4).
 *
 * Indonesian utility/IPL bills are often A5 or a custom ~185–200 mm wide form.
 * This template is ~186 mm wide; A5 (148 mm) would shrink text too much, so we
 * size the PDF page to the print area and grow height with add-on rows.
 */
export function statementPaperTwipsForContent(
  content: StatementPrintContentInches,
): StatementPaperTwips {
  const margins = UTILITY_STATEMENT_PRINT_MARGINS_IN;
  const widthIn =
    content.width + margins.left + margins.right;
  const heightIn =
    content.height + margins.top + margins.bottom;
  return {
    widthTwips: inchesToPaperTwips(widthIn),
    heightTwips: inchesToPaperTwips(heightIn),
  };
}

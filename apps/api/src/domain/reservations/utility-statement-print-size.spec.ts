import {
  excelColumnWidthToInches,
  inchesToPaperTwips,
  measureStatementPrintContentInches,
  statementPaperTwipsForContent,
} from './utility-statement-print-size.js';

describe('utility-statement-print-size', () => {
  it('converts Excel column width to inches', () => {
    expect(excelColumnWidthToInches(8.43)).toBeCloseTo(0.666, 2);
  });

  it('converts inches to OOXML paper twips', () => {
    expect(inchesToPaperTwips(7.5)).toBe(10_800);
  });

  it('adds tight margins around measured content', () => {
    const paper = statementPaperTwipsForContent({ width: 7.31, height: 10.81 });
    expect(paper.widthTwips).toBe(inchesToPaperTwips(7.31 + 0.5));
    expect(paper.heightTwips).toBe(inchesToPaperTwips(10.81 + 0.5));
  });

  it('measures worksheet print area height from row heights', () => {
    const widths = Array.from({ length: 13 }, (_, index) =>
      index === 3 ? 16.25 : 3.63,
    );
    const sheet = {
      getColumn: (index: number) => ({
        width: widths[index - 1],
      }),
      getRow: (row: number) => ({
        height: row === 2 ? 23.25 : 15,
        hidden: false,
      }),
    };
    const content = measureStatementPrintContentInches(
      sheet as never,
      4,
    );
    expect(content.height).toBeCloseTo((23.25 + 15 + 15) / 72, 4);
    expect(content.width).toBeGreaterThan(4);
  });

  it('skips hidden rows when measuring print height', () => {
    const sheet = {
      getColumn: () => ({ width: 8.43 }),
      getRow: (row: number) => ({
        height: 15,
        hidden: row === 3,
      }),
    };
    const content = measureStatementPrintContentInches(
      sheet as never,
      4,
    );
    expect(content.height).toBeCloseTo((15 + 15) / 72, 4);
  });
});

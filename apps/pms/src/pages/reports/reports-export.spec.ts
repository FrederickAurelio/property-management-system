import { describe, expect, it } from "vitest";
import { buildReportsCsv } from "./reports-export";
import { buildReportsFixture } from "./reports-fixture";
import { guestLedgerNetIdr, pctOfTotal } from "./reports-format";

describe("buildReportsCsv", () => {
  const summary = buildReportsFixture({
    propertyId: "p1",
    from: "2026-07-01",
    to: "2026-07-31",
    compare: true,
  });

  it("includes billed and out sections after guest cash", () => {
    const csv = buildReportsCsv(summary, {
      compare: true,
      propertyName: "Test Property",
    });
    expect(csv).toContain("# cash-billed");
    expect(csv).toContain("# cash-out");
    expect(csv).toContain("GUEST_REFUND");
    expect(csv).toContain("rent,");
    expect(csv.indexOf("# cash-by-source")).toBeLessThan(csv.indexOf("# cash-out"));
    expect(csv.indexOf("# cash-out")).toBeLessThan(csv.indexOf("# cash-billed"));
  });

  it("uses guest net for by-source % of net", () => {
    const csv = buildReportsCsv(summary, {
      compare: true,
      propertyName: "Test Property",
    });
    const guestNetAbs = Math.abs(guestLedgerNetIdr(summary.cash)) || 0;
    const first = summary.cash.bySource[0]!;
    const pct = pctOfTotal(first.netIdr, guestNetAbs);
    expect(csv).toContain(String(pct));
  });
});

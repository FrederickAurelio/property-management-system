import type { StaffReportsSummary } from "@cabin/api-contract";
import { formatReservationSource } from "@/pages/reservations/reservation-format";
import { pctOfTotal, shareDeltaPp } from "./reports-format";

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function rowsToCsv(
  header: string[],
  rows: (string | number | null)[][],
): string {
  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return lines.join("\n");
}

function methodLabel(method: string | null): string {
  if (method == null) return "Unspecified";
  return method;
}

/** Multi-section CSV matching denser on-screen reports. */
export function buildReportsCsv(
  summary: StaffReportsSummary,
  opts: { compare: boolean; propertyName: string },
): string {
  const sections: string[] = [];
  const compareOn = opts.compare && summary.compare != null;
  const cashNetAbs = Math.abs(summary.cash.netIdr) || 0;

  sections.push(`# Cabin PMS Reports`);
  sections.push(`# Property,${csvEscape(opts.propertyName)}`);
  sections.push(`# Period,${summary.from},${summary.to}`);
  if (compareOn && summary.compare) {
    sections.push(
      `# Compare period,${summary.compare.from},${summary.compare.to}`,
    );
  }
  sections.push("");

  sections.push("# cash-summary");
  sections.push(
    rowsToCsv(
      compareOn
        ? ["metric", "amountIdr", "previousIdr", "deltaIdr", "deltaPct"]
        : ["metric", "amountIdr"],
      compareOn && summary.cash.compare
        ? [
            [
              "net",
              summary.cash.netIdr,
              summary.cash.compare.netIdr,
              summary.cash.compare.netDeltaIdr,
              summary.cash.compare.netDeltaPct,
            ],
            [
              "in",
              summary.cash.inIdr,
              summary.cash.compare.inIdr,
              summary.cash.inIdr - summary.cash.compare.inIdr,
              null,
            ],
            [
              "out",
              summary.cash.outIdr,
              summary.cash.compare.outIdr,
              summary.cash.outIdr - summary.cash.compare.outIdr,
              null,
            ],
          ]
        : [
            ["net", summary.cash.netIdr],
            ["in", summary.cash.inIdr],
            ["out", summary.cash.outIdr],
          ],
    ),
  );
  sections.push("");
  sections.push("# cash-by-source");
  sections.push(
    rowsToCsv(
      ["source", "inIdr", "outIdr", "netIdr", "pctOfNet"],
      summary.cash.bySource.map((r) => [
        formatReservationSource(r.source),
        r.inIdr,
        r.outIdr,
        r.netIdr,
        pctOfTotal(r.netIdr, cashNetAbs),
      ]),
    ),
  );
  sections.push("");
  sections.push("# cash-by-unit-type");
  sections.push(
    rowsToCsv(
      ["unitType", "inIdr", "outIdr", "netIdr", "pctOfNet"],
      [...summary.cash.byUnitType]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => [
          r.name,
          r.inIdr,
          r.outIdr,
          r.netIdr,
          pctOfTotal(r.netIdr, cashNetAbs),
        ]),
    ),
  );
  sections.push("");
  sections.push("# cash-by-method");
  sections.push(
    rowsToCsv(
      ["method", "inIdr", "outIdr", "netIdr", "pctOfNet"],
      summary.cash.byMethod.map((r) => [
        methodLabel(r.method),
        r.inIdr,
        r.outIdr,
        r.netIdr,
        pctOfTotal(r.netIdr, cashNetAbs),
      ]),
    ),
  );

  sections.push("");
  sections.push("# occupancy");
  sections.push(
    rowsToCsv(
      compareOn
        ? [
            "unitType",
            "unit",
            "occupiedNights",
            "availableNights",
            "occupancyPct",
            "prevOccupied",
            "prevAvailable",
            "prevPct",
            "pctDelta",
          ]
        : [
            "unitType",
            "unit",
            "occupiedNights",
            "availableNights",
            "occupancyPct",
          ],
      [
        compareOn && summary.occupancy.compare
          ? [
              "property",
              "",
              summary.occupancy.occupiedNights,
              summary.occupancy.availableNights,
              summary.occupancy.occupancyPct,
              summary.occupancy.compare.occupiedNights,
              summary.occupancy.compare.availableNights,
              summary.occupancy.compare.occupancyPct,
              summary.occupancy.compare.occupancyPctDelta,
            ]
          : [
              "property",
              "",
              summary.occupancy.occupiedNights,
              summary.occupancy.availableNights,
              summary.occupancy.occupancyPct,
            ],
        ...summary.occupancyByUnitType.flatMap((row) => {
          const typeRow =
            compareOn && row.compare
              ? [
                  row.name,
                  "",
                  row.occupiedNights,
                  row.availableNights,
                  row.occupancyPct,
                  row.compare.occupiedNights,
                  row.compare.availableNights,
                  row.compare.occupancyPct,
                  row.compare.occupancyPctDelta,
                ]
              : [
                  row.name,
                  "",
                  row.occupiedNights,
                  row.availableNights,
                  row.occupancyPct,
                ];
          const unitRows = [...row.units]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((unit) =>
              compareOn && unit.compare
                ? [
                    row.name,
                    unit.name,
                    unit.occupiedNights,
                    unit.availableNights,
                    unit.occupancyPct,
                    unit.compare.occupiedNights,
                    unit.compare.availableNights,
                    unit.compare.occupancyPct,
                    unit.compare.occupancyPctDelta,
                  ]
                : [
                    row.name,
                    unit.name,
                    unit.occupiedNights,
                    unit.availableNights,
                    unit.occupancyPct,
                  ],
            );
          return [typeRow, ...unitRows];
        }),
      ],
    ),
  );

  sections.push("");
  sections.push("# source-mix");
  sections.push(
    rowsToCsv(
      compareOn
        ? [
            "source",
            "staysCheckInInPeriod",
            "nights",
            "pctOfNights",
            "cashNetIdr",
            "pctOfNet",
            "prevNights",
            "prevPctOfNights",
            "shareDeltaPp",
            "nightsDelta",
          ]
        : [
            "source",
            "staysCheckInInPeriod",
            "nights",
            "pctOfNights",
            "cashNetIdr",
            "pctOfNet",
          ],
      summary.sourceMix.map((r) => {
        const cash = summary.cash.bySource.find((c) => c.source === r.source);
        const cashNet = cash?.netIdr ?? 0;
        const cashPct = pctOfTotal(cashNet, cashNetAbs);
        if (compareOn && r.compare) {
          return [
            formatReservationSource(r.source),
            r.staysCheckInInPeriod,
            r.nights,
            r.pctOfNights,
            cashNet,
            cashPct,
            r.compare.nights,
            r.compare.pctOfNights,
            shareDeltaPp(r.pctOfNights, r.compare.pctOfNights),
            r.compare.nightsDelta,
          ];
        }
        return [
          formatReservationSource(r.source),
          r.staysCheckInInPeriod,
          r.nights,
          r.pctOfNights,
          cashNet,
          cashPct,
        ];
      }),
    ),
  );

  return sections.join("\n");
}

export function downloadReportsCsv(
  summary: StaffReportsSummary,
  opts: { compare: boolean; propertyName: string },
): void {
  const csv = buildReportsCsv(summary, opts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = opts.propertyName.replaceAll(/[^\w.-]+/g, "_").slice(0, 40);
  a.href = url;
  a.download = `reports-${safeName}-${summary.from}-${summary.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

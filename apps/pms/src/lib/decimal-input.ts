/**
 * id-ID grouped decimal display helpers (`.` thousands, `,` decimal).
 * Canonical plain uses JS `.` (`"1234.5"`).
 * Editing caret/input is owned by `DecimalAmountInput` → `react-number-format`.
 */

/** Plain → display (`"1234.5"` → `"1.234,5"`). */
export function formatDecimalInput(
  plain: string,
  maxFractionDigits = 3,
): string {
  if (!plain) {
    return "";
  }
  const trailingSep = plain.endsWith(".");
  const body = trailingSep ? plain.slice(0, -1) : plain;
  if (body === "" && trailingSep) {
    return "0,";
  }
  const n = Number(body);
  if (!Number.isFinite(n)) {
    return "";
  }
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(n);
  return trailingSep ? `${formatted},` : formatted;
}

/** Number → canonical plain (drops trailing zeros). */
export function plainFromMeterValue(
  value: number,
  maxFractionDigits = 3,
): string {
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }
  const fixed = value.toFixed(maxFractionDigits);
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
}

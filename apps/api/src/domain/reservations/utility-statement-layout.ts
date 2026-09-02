/** Split `BCN-1101` → prefix + floor + room for boxed header cells. */
export function parseUnitCodeForStatement(unitCode: string): {
  prefix: string;
  floor: string;
  room: string;
} {
  const trimmed = unitCode.trim();
  const dash = trimmed.indexOf('-');
  if (dash === -1) {
    return { prefix: trimmed, floor: '', room: '' };
  }
  const prefix = trimmed.slice(0, dash);
  const tail = trimmed.slice(dash + 1);
  const roomNum = Number(tail);
  if (!Number.isFinite(roomNum) || tail.length === 0) {
    return { prefix, floor: '', room: tail };
  }
  const floor = String(Math.floor(roomNum / 100));
  const room = String(roomNum % 100).padStart(2, '0');
  return { prefix, floor, room };
}

/** Split `US-CMTJH8SP-2026-10` into slash-separated boxed cells (D/F/H). */
export function parseBillingNoForStatement(billingNo: string): {
  idPart: string;
  year: string;
  month: string;
} {
  const match = /^US-(.+)-(\d{4})-(\d{2})$/.exec(billingNo.trim());
  if (!match) {
    return { idPart: billingNo.trim(), year: '', month: '' };
  }
  return {
    idPart: `US-${match[1]}`,
    year: match[2],
    month: match[3],
  };
}

/** Parse `YYYY-MM-DD` to UTC noon so Excel/LibreOffice keep the calendar day. */
export function parseStatementIsoDate(iso: string): Date | string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return iso;
  }
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
    ),
  );
}

/** Compact `dd/mm/yy` text for B12 Tanggal (period end; avoids ###). */
export function formatStatementDateShort(iso: string): string {
  const parsed = parseStatementIsoDate(iso);
  if (!(parsed instanceof Date)) {
    return iso;
  }
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const year = String(parsed.getUTCFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/** Amount due on the utility statement = utilities subtotal + admin (excludes rent). */
export function utilityStatementAmountDueIdr(input: {
  periodSubtotalIdr: number;
  adminAmountIdr: number;
}): number {
  return Math.max(0, input.periodSubtotalIdr + input.adminAmountIdr);
}

import type { ArchiveItem, StaffPropertyExpense } from '@cabin/api-contract';
import type {
  Admin,
  PropertyExpense,
  Unit,
} from '../../generated/prisma/index.js';

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type ExpenseRow = PropertyExpense & {
  unit: Pick<Unit, 'code' | 'name'> | null;
  createdByAdmin: Pick<Admin, 'username'> | null;
  updatedByAdmin: Pick<Admin, 'username'> | null;
};

export function toStaffPropertyExpense(row: ExpenseRow): StaffPropertyExpense {
  const unitName = row.unit
    ? row.unit.name?.trim()
      ? row.unit.name
      : row.unit.code
    : null;
  return {
    id: row.id,
    propertyId: row.propertyId,
    unitId: row.unitId,
    unitName,
    category: row.category,
    amountIdr: Number(row.amountIdr),
    occurredOn: ymd(row.occurredOn),
    note: row.note,
    proofImages: (row.proofImages as ArchiveItem[] | null) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByAdminId: row.createdByAdminId,
    createdByAdminUsername: row.createdByAdmin?.username ?? null,
    updatedByAdminId: row.updatedByAdminId,
    updatedByAdminUsername: row.updatedByAdmin?.username ?? null,
  };
}

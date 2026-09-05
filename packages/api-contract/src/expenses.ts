import type { ArchiveItem } from './archive.js';
import { UNIT_TYPE_YEARLY_PRICE_IDR_MAX } from './inventory.js';
import { PAYMENT_MOVEMENT_PROOF_MAX } from './reservations.js';

/** Operating cash-out on a property (not guest `PaymentMovement`). */
export const PropertyExpenseCategory = {
  UTILITIES: 'UTILITIES',
  MAINTENANCE: 'MAINTENANCE',
  INTERNET: 'INTERNET',
  SUPPLIES: 'SUPPLIES',
  STAFF: 'STAFF',
  OTHER: 'OTHER',
} as const;

export type PropertyExpenseCategory =
  (typeof PropertyExpenseCategory)[keyof typeof PropertyExpenseCategory];

/** Stable report / form order. */
export const PROPERTY_EXPENSE_CATEGORIES: readonly PropertyExpenseCategory[] = [
  PropertyExpenseCategory.UTILITIES,
  PropertyExpenseCategory.MAINTENANCE,
  PropertyExpenseCategory.INTERNET,
  PropertyExpenseCategory.SUPPLIES,
  PropertyExpenseCategory.STAFF,
  PropertyExpenseCategory.OTHER,
];

export const PROPERTY_EXPENSE_NOTE_MAX = 500;

export const PROPERTY_EXPENSE_AMOUNT_IDR_MIN = 1;

export const PROPERTY_EXPENSE_AMOUNT_IDR_MAX = UNIT_TYPE_YEARLY_PRICE_IDR_MAX;

export const PROPERTY_EXPENSE_PROOF_MAX = PAYMENT_MOVEMENT_PROOF_MAX;

export type StaffPropertyExpense = {
  id: string;
  propertyId: string;
  unitId: string | null;
  /** Denormalized for list display. */
  unitName: string | null;
  category: PropertyExpenseCategory;
  amountIdr: number;
  /** Inclusive business date YYYY-MM-DD (report bucket). */
  occurredOn: string;
  note: string | null;
  proofImages: ArchiveItem[];
  createdAt: string;
  updatedAt: string;
  createdByAdminId: string | null;
  createdByAdminUsername: string | null;
  updatedByAdminId: string | null;
  updatedByAdminUsername: string | null;
};

export type StaffPropertyExpenseListParams = {
  propertyId: string;
  from: string;
  to: string;
  category?: PropertyExpenseCategory;
  page?: number;
  pageSize?: number;
};

export type CreateStaffPropertyExpenseInput = {
  propertyId: string;
  occurredOn: string;
  category: PropertyExpenseCategory;
  amountIdr: number;
  unitId?: string | null;
  note?: string | null;
  proofImages?: ArchiveItem[];
};

export type UpdateStaffPropertyExpenseInput = {
  occurredOn?: string;
  category?: PropertyExpenseCategory;
  amountIdr?: number;
  unitId?: string | null;
  note?: string | null;
  proofImages?: ArchiveItem[];
};

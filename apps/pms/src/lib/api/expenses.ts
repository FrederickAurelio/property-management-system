/**
 * Property operating expenses — Nest `/staff/expenses`.
 */
import type {
  CreateStaffPropertyExpenseInput,
  Paginated,
  StaffPropertyExpense,
  StaffPropertyExpenseListParams,
  UpdateStaffPropertyExpenseInput,
} from "@cabin/api-contract";
import { PAGE_SIZE_DEFAULT } from "@cabin/api-contract";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  staffExpensesListQueryKeyPrefix,
  staffReportsQueryKeyPrefix,
} from "./query-keys";

export async function listPropertyExpenses(
  params: StaffPropertyExpenseListParams,
): Promise<Paginated<StaffPropertyExpense>> {
  const { data } = await api.get<Paginated<StaffPropertyExpense>>("/expenses", {
    params: {
      propertyId: params.propertyId,
      from: params.from,
      to: params.to,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? PAGE_SIZE_DEFAULT,
      ...(params.category ? { category: params.category } : {}),
    },
  });
  return data;
}

export async function createPropertyExpense(
  input: CreateStaffPropertyExpenseInput,
): Promise<StaffPropertyExpense> {
  const { data } = await api.post<StaffPropertyExpense>("/expenses", input);
  return data;
}

export async function updatePropertyExpense(
  id: string,
  input: UpdateStaffPropertyExpenseInput,
): Promise<StaffPropertyExpense> {
  const { data } = await api.patch<StaffPropertyExpense>(
    `/expenses/${id}`,
    input,
  );
  return data;
}

export async function deletePropertyExpense(
  id: string,
): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/expenses/${id}`);
  return data;
}

export function invalidateExpenseCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: staffExpensesListQueryKeyPrefix });
  void qc.invalidateQueries({ queryKey: staffReportsQueryKeyPrefix });
}

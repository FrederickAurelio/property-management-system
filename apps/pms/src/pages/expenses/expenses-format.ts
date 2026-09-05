import type { PropertyExpenseCategory } from "@cabin/api-contract";
import i18n from "@/i18n";

export function formatExpenseCategory(category: PropertyExpenseCategory): string {
  return i18n.t(`expenses:categories.${category}`);
}

import {
  PROPERTY_EXPENSE_AMOUNT_IDR_MAX,
  PROPERTY_EXPENSE_NOTE_MAX,
  PropertyExpenseCategory,
} from "@cabin/api-contract";
import { z } from "zod";

const CATEGORY_VALUES = [
  PropertyExpenseCategory.UTILITIES,
  PropertyExpenseCategory.MAINTENANCE,
  PropertyExpenseCategory.INTERNET,
  PropertyExpenseCategory.SUPPLIES,
  PropertyExpenseCategory.STAFF,
  PropertyExpenseCategory.OTHER,
] as const;

export function createExpenseFormSchema(t: (key: string) => string) {
  return z
    .object({
      occurredOn: z.string().min(1, t("expenses:sheet.zod.dateRequired")),
      category: z.enum(CATEGORY_VALUES),
      amountDigits: z.string().min(1, t("expenses:sheet.zod.amountRequired")),
      unitId: z.string(),
      note: z.union([
        z.literal(""),
        z.string().trim().max(PROPERTY_EXPENSE_NOTE_MAX),
      ]),
    })
    .superRefine((values, ctx) => {
      const amount = Number(values.amountDigits || "0");
      if (!Number.isFinite(amount) || amount < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: t("expenses:sheet.zod.amountAboveZero"),
        });
      } else if (amount > PROPERTY_EXPENSE_AMOUNT_IDR_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["amountDigits"],
          message: t("expenses:sheet.zod.amountTooLarge"),
        });
      }
      if (
        values.category === PropertyExpenseCategory.OTHER &&
        values.note.trim().length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["note"],
          message: t("expenses:sheet.zod.noteRequired"),
        });
      }
    });
}

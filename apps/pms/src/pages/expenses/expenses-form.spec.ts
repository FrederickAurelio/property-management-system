import { describe, expect, it } from "vitest";
import { PropertyExpenseCategory } from "@cabin/api-contract";
import { createExpenseFormSchema } from "./expenses-form";

const t = (key: string) => key;

function validBase() {
  return {
    occurredOn: "2026-07-10",
    category: PropertyExpenseCategory.UTILITIES,
    amountDigits: "300000",
    unitId: "__none__",
    note: "",
  };
}

describe("createExpenseFormSchema", () => {
  const schema = createExpenseFormSchema(t);

  it("accepts UTILITIES without a note", () => {
    expect(schema.safeParse(validBase()).success).toBe(true);
  });

  it("requires a note for OTHER", () => {
    const result = schema.safeParse({
      ...validBase(),
      category: PropertyExpenseCategory.OTHER,
      note: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "note")).toBe(true);
    }
  });

  it("accepts OTHER with a note", () => {
    expect(
      schema.safeParse({
        ...validBase(),
        category: PropertyExpenseCategory.OTHER,
        note: "Wi-Fi router",
      }).success,
    ).toBe(true);
  });

  it("rejects amount below 1", () => {
    const result = schema.safeParse({ ...validBase(), amountDigits: "0" });
    expect(result.success).toBe(false);
  });
});

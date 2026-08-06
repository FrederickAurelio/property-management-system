/* anchor: react-number-format caret engine, diverge: id-ID `.` / `,` + shadcn Input */
import { forwardRef, type ComponentProps } from "react";
import { NumericFormat } from "react-number-format";
import { UTILITY_METER_FRACTION_DIGITS } from "@cabin/api-contract";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DecimalAmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode" | "defaultValue"
> & {
  /** Canonical plain string (`"1234.5"`, optional trailing `.`). */
  value: string;
  onValueChange: (plain: string) => void;
  /** Inclusive max; null/undefined = no cap. */
  max?: number | null;
  /** Fractional digits after `,` (default meter = 3). */
  maxFractionDigits?: number;
};

/**
 * Grouped decimal field (id-ID): `.` thousands, `,` decimal.
 *
 * Uses `react-number-format` for caret placement (typing `,` keeps the caret
 * *after* the decimal separator). Custom digit-index caret repeatedly put the
 * caret *before* `,` and broke fraction entry.
 */
export const DecimalAmountInput = forwardRef<
  HTMLInputElement,
  DecimalAmountInputProps
>(function DecimalAmountInput(
  {
    value,
    onValueChange,
    max = null,
    maxFractionDigits = UTILITY_METER_FRACTION_DIGITS,
    className,
    onBlur,
    onFocus,
    onKeyDown,
    disabled,
    name,
    id,
    placeholder,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref,
) {
  return (
    <NumericFormat
      {...rest}
      getInputRef={ref}
      customInput={Input}
      id={id}
      name={name}
      disabled={disabled}
      placeholder={placeholder}
      aria-invalid={ariaInvalid}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn("tabular-nums", className)}
      value={value}
      valueIsNumericString
      allowNegative={false}
      thousandSeparator="."
      decimalSeparator=","
      allowedDecimalSeparators={[",", "."]}
      decimalScale={maxFractionDigits}
      inputMode="decimal"
      autoComplete="off"
      isAllowed={(values) => {
        if (max == null || !Number.isFinite(max)) {
          return true;
        }
        if (values.floatValue == null) {
          return true;
        }
        return values.floatValue <= max;
      }}
      onValueChange={(values, sourceInfo) => {
        // Ignore prop-driven reformats; only commit user edits.
        if (sourceInfo.source !== "event") {
          return;
        }
        onValueChange(values.value);
      }}
    />
  );
});

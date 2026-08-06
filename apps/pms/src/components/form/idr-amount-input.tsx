/* anchor: react-number-format caret engine, diverge: whole IDR + id-ID `.` thousands */
import { forwardRef, type ComponentProps } from "react";
import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type IdrAmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode" | "defaultValue"
> & {
  /** Raw digit string (no thousand separators), e.g. `"450000"`. */
  value: string;
  onValueChange: (digits: string) => void;
  /** Inclusive max; null/undefined = no cap. */
  max?: number | null;
};

/**
 * Whole-rupiah amount field: id-ID thousand separators (`.`), no decimals.
 * Caret / delete / grouping owned by `react-number-format` (same as meters).
 */
export const IdrAmountInput = forwardRef<HTMLInputElement, IdrAmountInputProps>(
  function IdrAmountInput(
    {
      value,
      onValueChange,
      max = null,
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
        // Required whenever thousandSeparator is `.` — library default decimal is also `.`
        // and throws even with decimalScale={0}.
        decimalSeparator=","
        decimalScale={0}
        allowLeadingZeros={false}
        inputMode="numeric"
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
          if (sourceInfo.source !== "event") {
            return;
          }
          onValueChange(values.value);
        }}
      />
    );
  },
);

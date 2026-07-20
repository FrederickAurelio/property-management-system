/* eslint-disable react-refresh/only-export-components */
/* anchor: Stripe money input, diverge: id-ID grouping + digit-index caret */
import {
  useLayoutEffect,
  useRef,
  forwardRef,
  type ComponentProps,
} from "react";
import { Input } from "@/components/ui/input";
import {
  clampDigitsToMax,
  digitsFromIdrInput,
  formatIdrInput,
} from "@/pages/properties/inventory-types";
import { cn } from "@/lib/utils";

/** Digits to the left of `caret` in a (possibly formatted) string. */
export function countDigitsBefore(value: string, caret: number): number {
  let count = 0;
  const end = Math.max(0, Math.min(caret, value.length));
  for (let i = 0; i < end; i++) {
    if (/\d/.test(value[i]!)) {
      count += 1;
    }
  }
  return count;
}

/** Caret index in formatted string after `digitCount` digits. */
export function caretPosAfterDigits(
  formatted: string,
  digitCount: number,
): number {
  if (digitCount <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen += 1;
      if (seen >= digitCount) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}

type IdrAmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Raw digit string (no thousand separators). */
  value: string;
  onValueChange: (digits: string) => void;
  /** Inclusive max; null/undefined = no cap. */
  max?: number | null;
};

/**
 * IDR amount field: shows thousand separators while editing, keeps caret
 * aligned to the digit under the cursor (not the separator).
 */
export const IdrAmountInput = forwardRef<HTMLInputElement, IdrAmountInputProps>(
  function IdrAmountInput(
    { value, onValueChange, max = null, className, onKeyDown, ...props },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pendingDigitCaret = useRef<number | null>(null);
    const display = formatIdrInput(value);

    useLayoutEffect(() => {
      const el = inputRef.current;
      const digitCaret = pendingDigitCaret.current;
      if (!el || digitCaret == null) {
        return;
      }
      const pos = caretPosAfterDigits(display, digitCaret);
      el.setSelectionRange(pos, pos);
      pendingDigitCaret.current = null;
    }, [display]);

    return (
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn("tabular-nums", className)}
        value={display}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) {
            return;
          }
          const el = e.currentTarget;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          // Backspace on a separator: delete the digit before it instead.
          if (e.key === "Backspace" && start === end && start > 0) {
            const before = el.value[start - 1];
            if (before && !/\d/.test(before)) {
              e.preventDefault();
              const digitCaret = countDigitsBefore(el.value, start);
              const nextDigits =
                value.slice(0, Math.max(0, digitCaret - 1)) +
                value.slice(digitCaret);
              pendingDigitCaret.current = Math.max(0, digitCaret - 1);
              onValueChange(clampDigitsToMax(nextDigits, max ?? null));
            }
          }
          // Delete on a separator: delete the digit after it.
          if (e.key === "Delete" && start === end && start < el.value.length) {
            const at = el.value[start];
            if (at && !/\d/.test(at)) {
              e.preventDefault();
              const digitCaret = countDigitsBefore(el.value, start);
              const nextDigits =
                value.slice(0, digitCaret) + value.slice(digitCaret + 1);
              pendingDigitCaret.current = digitCaret;
              onValueChange(clampDigitsToMax(nextDigits, max ?? null));
            }
          }
        }}
        onChange={(e) => {
          const el = e.target;
          const caret = el.selectionStart ?? el.value.length;
          pendingDigitCaret.current = countDigitsBefore(el.value, caret);
          const next = clampDigitsToMax(
            digitsFromIdrInput(el.value),
            max ?? null,
          );
          onValueChange(next);
        }}
      />
    );
  },
);

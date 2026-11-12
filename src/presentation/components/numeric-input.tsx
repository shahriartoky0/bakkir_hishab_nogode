"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "../lib/utils";
import { inputModeFor, sanitizeNumeric, type NumericKind } from "../lib/numeric";
import { Input } from "./ui/input";

/**
 * A text input that only accepts numbers (Bangla or English digits). Letters are
 * dropped as they are typed or pasted; `error` shows a message right under the field.
 */
export function NumericInput({
  kind,
  value,
  onValueChange,
  error,
  className,
  id,
  ...rest
}: {
  kind: NumericKind;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | null;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode">) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <>
      <Input
        {...rest}
        id={inputId}
        type="text"
        inputMode={inputModeFor(kind)}
        autoComplete={rest.autoComplete ?? "off"}
        value={value}
        onChange={(e) => onValueChange(sanitizeNumeric(e.target.value, kind))}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : rest["aria-describedby"]}
        className={cn("h-12 text-base tabular-nums", className)}
      />
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

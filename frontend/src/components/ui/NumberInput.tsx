import React, { useCallback, useState, useEffect } from "react";

interface NumberInputProps {
  label?: string;
  value: number | string;
  onChange: (value: number | string) => void;
  decimalScale?: number;
  step?: number;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-1.5 text-sm",
  lg: "px-3 py-2 text-base"
};

export function NumberInput({
  label,
  value,
  onChange,
  decimalScale = 2,
  step = 1,
  min,
  max,
  size = "md",
  disabled = false,
  className = ""
}: NumberInputProps) {
  // Local state to track the display value while typing
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === "" || value === undefined || value === null) return "";
    if (typeof value === "number") return value.toString();
    return value;
  });
  const [isFocused, setIsFocused] = useState(false);

  // Sync display value with prop when not focused (external updates)
  useEffect(() => {
    if (!isFocused) {
      if (value === "" || value === undefined || value === null) {
        setDisplayValue("");
      } else if (typeof value === "number") {
        setDisplayValue(value.toFixed(decimalScale));
      } else {
        setDisplayValue(value);
      }
    }
  }, [value, decimalScale, isFocused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setDisplayValue(rawValue);

      // Allow empty string for clearing the input
      if (rawValue === "") {
        onChange("");
        return;
      }

      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Format the value on blur
    if (displayValue === "") {
      return;
    }
    const parsed = parseFloat(displayValue);
    if (!isNaN(parsed)) {
      setDisplayValue(parsed.toFixed(decimalScale));
    }
  }, [displayValue, decimalScale]);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm text-slate-900 mb-1">{label}</label>
      )}
      <input
        type="number"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className={`w-full bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${sizeStyles[size]}`}
      />
    </div>
  );
}

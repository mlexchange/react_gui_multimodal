import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

interface ToggleGroupProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

export function ToggleGroup<T extends string>({
  value,
  onValueChange,
  options,
  disabled = false,
  size = "md",
  className = "",
}: ToggleGroupProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(newValue) => {
        // Prevent deselection - always require a value
        if (newValue) onValueChange(newValue as T);
      }}
      disabled={disabled}
      className={`flex gap-0.5 ${className}`}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={`
            ${sizeStyles[size]}
            rounded-md font-medium transition-colors
            ${value === option.value
              ? "bg-sky-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

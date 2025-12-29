import * as TogglePrimitive from "@radix-ui/react-toggle";

interface ToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

export function Toggle({
  pressed,
  onPressedChange,
  children,
  disabled = false,
  size = "md",
  className = "",
}: ToggleProps) {
  return (
    <TogglePrimitive.Root
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      className={`
        ${sizeStyles[size]}
        rounded-md font-medium transition-colors
        ${pressed
          ? "bg-sky-500 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {children}
    </TogglePrimitive.Root>
  );
}

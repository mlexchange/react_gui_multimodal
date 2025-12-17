import * as SwitchPrimitive from "@radix-ui/react-switch";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  labelPosition?: "left" | "right";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
  md: { track: "w-11 h-6", thumb: "w-4 h-4", translate: "translate-x-5" },
  lg: { track: "w-14 h-7", thumb: "w-5 h-5", translate: "translate-x-7" },
};

export function Switch({
  checked,
  onChange,
  label,
  labelPosition = "right",
  disabled = false,
  size = "md",
  className = "",
}: SwitchProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={`flex items-center gap-2 ${
        labelPosition === "left" ? "flex-row-reverse justify-end" : ""
      } ${className}`}
    >
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={`${styles.track} rounded-full relative transition-colors border-2 ${
          checked
            ? "bg-blue-50 border-blue-500"
            : "bg-gray-100 border-gray-400"
        } ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <SwitchPrimitive.Thumb
          className={`block ${styles.thumb} bg-white rounded-full border-2 transition-transform ${
            checked
              ? `${styles.translate} border-blue-500`
              : "translate-x-0.5 border-gray-400"
          }`}
        />
      </SwitchPrimitive.Root>
      {label && <span className="text-sm text-slate-900">{label}</span>}
    </div>
  );
}

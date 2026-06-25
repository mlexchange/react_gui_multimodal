import React, { forwardRef } from "react";
import { Tooltip } from "./Tooltip";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  tooltip?: string;
  variant?: "subtle" | "default" | "danger";
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10"
};

const variantClasses = {
  subtle: "hover:bg-gray-100 text-slate-700",
  default: "bg-gray-100 hover:bg-gray-200 text-slate-700",
  danger: "bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white"
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      tooltip,
      variant = "subtle",
      size = "md",
      ariaLabel,
      disabled = false,
      className = "",
      ...props
    },
    ref
  ) {
    const button = (
      <button
        ref={ref}
        className={`flex items-center justify-center rounded transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        aria-label={ariaLabel}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return <Tooltip content={tooltip}>{button}</Tooltip>;
    }

    return button;
  }
);

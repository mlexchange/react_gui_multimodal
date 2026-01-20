import React from "react";

interface LinecutSectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function LinecutSectionHeader({
  children,
  className = ""
}: LinecutSectionHeaderProps) {
  return (
    <h3
      className={`text-md font-bold mb-2 text-center text-sky-900 ${className}`}
    >
      {children}
    </h3>
  );
}

interface LinecutItemContainerProps {
  children: React.ReactNode;
  id?: string | number;
  className?: string;
}

export function LinecutItemContainer({
  children,
  id,
  className = ""
}: LinecutItemContainerProps) {
  return (
    <div
      className={`mb-3 pt-2 pb-4 relative border rounded-lg ${className}`}
      role="region"
      aria-labelledby={id ? `item-${id}` : undefined}
    >
      {children}
    </div>
  );
}

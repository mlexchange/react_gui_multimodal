import React from "react";

interface ItemContainerProps {
  children: React.ReactNode;
  id?: string | number;
  className?: string;
}

export function ItemContainer({ children, id, className = "" }: ItemContainerProps) {
  return (
    <div
      className={`mb-3 pt-2 pb-4 px-3 relative border rounded-lg ${className}`}
      role="region"
      aria-labelledby={id ? `item-${id}` : undefined}
    >
      {children}
    </div>
  );
}

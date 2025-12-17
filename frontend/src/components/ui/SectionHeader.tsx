import React from "react";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeader({ children, className = "" }: SectionHeaderProps) {
  return (
    <h3 className={`text-md font-bold mb-2 text-center text-sky-900 ${className}`}>
      {children}
    </h3>
  );
}

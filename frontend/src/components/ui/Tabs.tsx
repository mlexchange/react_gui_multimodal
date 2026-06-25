/**
 * Tabs component built on Radix UI Tabs primitive.
 *
 * Provides styled tab navigation with primary and secondary variants.
 */

import * as TabsPrimitive from "@radix-ui/react-tabs";
import React from "react";

// ============================================================================
// Tabs Root
// ============================================================================

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className = ""
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

// ============================================================================
// Tabs List (Tab Bar)
// ============================================================================

interface TabsListProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

const listVariantStyles = {
  primary: "bg-gray-100 p-1 rounded-lg gap-1",
  secondary: "bg-gray-50 p-0.5 rounded-md gap-0.5 border border-gray-200"
};

export function TabsList({
  children,
  variant = "primary",
  className = ""
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={`
        inline-flex items-center
        ${listVariantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </TabsPrimitive.List>
  );
}

// ============================================================================
// Tab Trigger (Individual Tab)
// ============================================================================

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
  /** When true, shows blue styling even when inactive (indicates data is available) */
  hasData?: boolean;
}

export function TabsTrigger({
  value,
  children,
  variant = "primary",
  disabled = false,
  className = "",
  hasData = false
}: TabsTriggerProps) {
  // Build class strings based on variant and hasData
  const baseClasses =
    variant === "primary"
      ? "px-3 py-1.5 text-sm font-medium rounded-md transition-all"
      : "px-2 py-1 text-xs font-medium rounded transition-all";

  const activeClasses =
    variant === "primary"
      ? "data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-sm"
      : "data-[state=active]:bg-white data-[state=active]:text-sky-600 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200";

  // Inactive classes depend on hasData - blue if has data, gray otherwise
  const inactiveClasses = hasData
    ? variant === "primary"
      ? "data-[state=inactive]:text-sky-600 data-[state=inactive]:hover:text-sky-700 data-[state=inactive]:hover:bg-sky-50"
      : "data-[state=inactive]:text-sky-500 data-[state=inactive]:hover:text-sky-600 data-[state=inactive]:hover:bg-sky-50"
    : variant === "primary"
      ? "data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-gray-50"
      : "data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-100";

  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={`${baseClasses} ${activeClasses} ${inactiveClasses} ${disabledClasses} ${className}`}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

// ============================================================================
// Tab Content
// ============================================================================

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({
  value,
  children,
  className = ""
}: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={`focus:outline-none ${className}`}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

// ============================================================================
// Convenience exports
// ============================================================================

export { TabsPrimitive };

import { useState, useMemo } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  data: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  maxDropdownHeight?: number;
  className?: string;
}

const sizeStyles = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-1.5 text-sm",
  lg: "px-3 py-2 text-base",
};

export function Select({
  label,
  value,
  onChange,
  data,
  placeholder = "Select...",
  searchable = false,
  disabled = false,
  size = "md",
  maxDropdownHeight = 300,
  className = "",
}: SelectProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery) return data;
    return data.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery, searchable]);

  const selectedLabel = data.find((item) => item.value === value)?.label;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm text-slate-900 mb-1">{label}</label>
      )}
      <SelectPrimitive.Root
        value={value ?? ""}
        onValueChange={(val) => onChange(val || null)}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className={`w-full min-w-0 flex items-center justify-between gap-1 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${sizeStyles[size]}`}
        >
          <span className="truncate min-w-0 flex-1 text-left">
            <SelectPrimitive.Value placeholder={placeholder}>
              {selectedLabel || placeholder}
            </SelectPrimitive.Value>
          </span>
          <SelectPrimitive.Icon className="shrink-0">
            <CaretDownIcon size={16} className="text-gray-500" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50"
            position="popper"
            sideOffset={4}
          >
            {searchable && (
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <SelectPrimitive.Viewport
              className="p-1"
              style={{ maxHeight: maxDropdownHeight }}
            >
              {filteredData.length === 0 ? (
                <div className="py-2 px-4 text-sm text-gray-500">
                  No options found
                </div>
              ) : (
                filteredData.map((item) => (
                  <SelectPrimitive.Item
                    key={item.value}
                    value={item.value}
                    className="py-2 px-4 text-sm hover:bg-gray-100 cursor-pointer rounded outline-none data-[highlighted]:bg-sky-50 data-[state=checked]:bg-sky-100 flex items-center justify-between"
                  >
                    <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon size={14} className="text-sky-600" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

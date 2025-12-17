import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

interface PopoverProps {
  children: React.ReactNode;
  width?: number;
  position?: "top" | "bottom" | "left" | "right";
}

function PopoverRoot({ children, width, position = "bottom" }: PopoverProps) {
  return (
    <PopoverPrimitive.Root>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === PopoverTarget) {
            return child;
          }
          if (child.type === PopoverDropdown) {
            return React.cloneElement(child as React.ReactElement<{ side: "top" | "bottom" | "left" | "right"; width?: number }>, {
              side: position,
              width,
            });
          }
        }
        return child;
      })}
    </PopoverPrimitive.Root>
  );
}

function PopoverTarget({ children }: { children: React.ReactNode }) {
  return (
    <PopoverPrimitive.Trigger asChild>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

interface PopoverDropdownProps {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  width?: number;
}

function PopoverDropdown({ children, side = "bottom", width }: PopoverDropdownProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        className="bg-white border border-gray-200 rounded-md shadow-lg p-4 z-50"
        sideOffset={8}
        side={side}
        style={width ? { width } : undefined}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-white" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export const Popover = Object.assign(PopoverRoot, {
  Target: PopoverTarget,
  Dropdown: PopoverDropdown,
});

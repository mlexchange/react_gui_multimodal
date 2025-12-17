import React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

interface MenuProps {
  children: React.ReactNode;
  position?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
}

interface MenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

function MenuRoot({ children, position = "bottom-end" }: MenuProps) {
  const [side, align] = position.split("-") as ["bottom" | "top", "start" | "end"];

  return (
    <DropdownMenuPrimitive.Root>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === MenuTarget) {
            return child;
          }
          if (child.type === MenuDropdown) {
            return React.cloneElement(child as React.ReactElement<{ side: "bottom" | "top"; align: "start" | "end" }>, {
              side,
              align,
            });
          }
        }
        return child;
      })}
    </DropdownMenuPrimitive.Root>
  );
}

function MenuTarget({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Trigger asChild>
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
}

interface MenuDropdownProps {
  children: React.ReactNode;
  side?: "bottom" | "top";
  align?: "start" | "end";
}

function MenuDropdown({ children, side = "bottom", align = "end" }: MenuDropdownProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className="bg-white border border-gray-200 rounded-md shadow-lg p-1 z-50 min-w-[120px]"
        sideOffset={4}
        side={side}
        align={align}
      >
        {children}
        <DropdownMenuPrimitive.Arrow className="fill-white" />
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

function MenuItem({ children, onClick, className = "", disabled = false }: MenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={`py-2 px-3 text-sm cursor-pointer rounded outline-none data-[highlighted]:bg-gray-100 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export const Menu = Object.assign(MenuRoot, {
  Target: MenuTarget,
  Dropdown: MenuDropdown,
  Item: MenuItem,
});

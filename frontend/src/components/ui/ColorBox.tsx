import React from "react";
import { Tooltip } from "./Tooltip";

interface ColorBoxProps {
  color: string;
  onClick?: (e: React.MouseEvent) => void;
  tooltip?: string;
}

export function ColorBox({ color, onClick, tooltip = "Click to change color" }: ColorBoxProps) {
  return (
    <Tooltip content={tooltip}>
      <div
        className="h-3 w-8 cursor-pointer rounded"
        style={{ backgroundColor: color }}
        onClick={onClick}
      />
    </Tooltip>
  );
}

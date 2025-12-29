import React from 'react';
import { SketchPicker, ColorResult } from "react-color";

interface ColorPickerPopupProps {
  colorPicker: {
    id: number;
    side: "left" | "right";
    visible: boolean;
    originalColor: string;
    currentColor: string;
    position: { top: number; left: number };
  };
  onColorChange: (id: number, side: "left" | "right", color: string) => void;
  onAccept: () => void;
  onCancel: () => void;
}


const ColorPickerPopup = React.forwardRef<HTMLDivElement, Omit<ColorPickerPopupProps, 'ref'>>(
  ({ colorPicker, onColorChange, onAccept, onCancel }, ref) => {
    return (
      <div
        ref={ref}
        className="fixed z-50"
        style={{
          top: colorPicker.position.top,
          left: colorPicker.position.left
        }}
      >
        <div className="bg-white p-4 shadow-lg rounded">
          <SketchPicker
            color={colorPicker.currentColor}
            onChange={(color: ColorResult) =>
              onColorChange(colorPicker.id, colorPicker.side, color.hex)
            }
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={onAccept}
            >
              Accept
            </button>
            <button
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ColorPickerPopup.displayName = 'ColorPickerPopup';

export default ColorPickerPopup;

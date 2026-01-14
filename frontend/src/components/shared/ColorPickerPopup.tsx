import React from 'react';
import { SketchPicker, ColorResult } from "react-color";
import { Button } from '@blueskyproject/finch';

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
            <Button
              text="Accept"
              cb={onAccept}
              size="small"
              bgColor="bg-green-600"
              hoverBgColor="hover:bg-green-700"
            />
            <Button
              text="Cancel"
              cb={onCancel}
              size="small"
              bgColor="bg-gray-400"
              hoverBgColor="hover:bg-gray-500"
            />
          </div>
        </div>
      </div>
    );
  }
);

ColorPickerPopup.displayName = 'ColorPickerPopup';

export default ColorPickerPopup;

import React, { useState, useEffect, useCallback } from "react";
import { EyeIcon, EyeSlashIcon, TrashSimpleIcon } from "@phosphor-icons/react";
import { Linecut } from './types';
import { InputSlider } from "@blueskyproject/finch";
import ColorPickerPopup from "../ColorPickerPopup";

interface VerticalLinecutWidgetProps {
  linecutType: string | null;
  linecuts: Linecut[];
  qXMatrix: number[][];
  updateVerticalLinecutPosition: (id: number, position: number) => void;
  updateVerticalLinecutWidth: (id: number, width: number) => void;
  updateVerticalLinecutColor: (id: number, side: "left" | "right", color: string) => void;
  deleteVerticalLinecut: (id: number) => void;
  toggleVerticalLinecutVisibility: (id: number) => void;
}

const VerticalLinecutWidget: React.FC<VerticalLinecutWidgetProps> = ({
  linecutType,
  linecuts,
  qXMatrix,
  updateVerticalLinecutPosition,
  updateVerticalLinecutWidth,
  updateVerticalLinecutColor,
  deleteVerticalLinecut,
  toggleVerticalLinecutVisibility,
}) => {
  const colorPickerRef = React.useRef<HTMLDivElement>(null);
  const [colorPicker, setColorPicker] = useState<{
    id: number;
    side: "left" | "right";
    visible: boolean;
    originalColor: string;
    currentColor: string;
    position: { top: number; left: number };
  } | null>(null);

  const [minQXValue, maxQXValue] = React.useMemo(() => {
    if (!qXMatrix || !qXMatrix.length || !qXMatrix[0] || !qXMatrix[0].length) {
      return [0, 1];
    }

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let x = 0; x < qXMatrix[0].length; x++) {
      if (qXMatrix[0][x] !== undefined) {
        minVal = Math.min(minVal, qXMatrix[0][x]);
        maxVal = Math.max(maxVal, qXMatrix[0][x]);
      }
    }

    if (minVal === Infinity || maxVal === -Infinity) {
      return [0, 1];
    }

    return [
      parseFloat(minVal.toFixed(1)),
      parseFloat(maxVal.toFixed(1))
    ];
  }, [qXMatrix]);

  const handleCancelColor = useCallback(() => {
    if (colorPicker) {
      updateVerticalLinecutColor(
        colorPicker.id,
        colorPicker.side,
        colorPicker.originalColor
      );
      setColorPicker(null);
    }
  }, [colorPicker, updateVerticalLinecutColor]);

  const handleColorChange = (id: number, side: "left" | "right", color: string) => {
    if (colorPicker) {
      setColorPicker({
        ...colorPicker,
        currentColor: color,
      });
    }
    updateVerticalLinecutColor(id, side, color);
  };

  const handleOpenColorPicker = (linecut: Linecut, side: "left" | "right", event: React.MouseEvent) => {
    if (colorPicker?.id === linecut.id && colorPicker?.side === side && colorPicker?.visible) {
      setColorPicker(null);
    } else {
      const originalColor = side === "left" ? linecut.leftColor : linecut.rightColor;
      setColorPicker({
        id: linecut.id,
        side,
        visible: true,
        originalColor,
        currentColor: originalColor,
        position: { top: event.clientY + 10, left: event.clientX },
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPicker?.visible &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        handleCancelColor();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [colorPicker, handleCancelColor]);

  return (
    <div className="w-full relative mb-4">
      {/* Section Title */}
      <h3 className="text-md font-bold mb-2 text-center text-sky-900">{linecutType} Linecuts</h3>

      {/* Linecuts List */}
      <div className="w-full">
        {linecuts.map((linecut) => (
          <div
            key={linecut.id}
            className="mb-3 pt-2 pb-4 px-3 relative border rounded-lg"
            role="region"
            aria-labelledby={`linecut-${linecut.id}-title`}
          >
            {/* Linecut header: number on left, controls on right */}
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-sm font-semibold">#{linecut.id}</span>
              <div className="flex items-center gap-2">
                {/* Left color bar with tooltip */}
                <div className="group relative">
                  <div
                    className="h-3 w-8 cursor-pointer rounded"
                    style={{ backgroundColor: linecut.leftColor }}
                    onClick={(e) => handleOpenColorPicker(linecut, "left", e)}
                  ></div>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    Click to change color
                  </span>
                </div>
                {/* Right color bar with tooltip */}
                <div className="group relative">
                  <div
                    className="h-3 w-8 cursor-pointer rounded"
                    style={{ backgroundColor: linecut.rightColor }}
                    onClick={(e) => handleOpenColorPicker(linecut, "right", e)}
                  ></div>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    Click to change color
                  </span>
                </div>
                {/* Visibility Toggle with Tooltip */}
                <div className="group relative">
                  <button
                    className="flex items-center"
                    onClick={() => toggleVerticalLinecutVisibility(linecut.id)}
                    aria-label={`Toggle Visibility of Linecut ${linecut.id}`}
                  >
                    {linecut.hidden ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    {linecut.hidden ? "Show" : "Hide"}
                  </span>
                </div>
                {/* Delete button with tooltip */}
                <div className="group relative">
                  <button
                    className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white rounded"
                    onClick={() => deleteVerticalLinecut(linecut.id)}
                    aria-label={`Delete Linecut ${linecut.id}`}
                  >
                    <TrashSimpleIcon size={16} />
                  </button>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    Delete
                  </span>
                </div>
              </div>
            </div>

            {/* Slider for Linecut Width */}
            <div className="mb-4">
              <h4 className="text-sm mb-1">Width (nm⁻¹)</h4>
              <InputSlider
                min={0}
                max={10}
                value={linecut.width || 0}
                step={0.1}
                onChange={(value) => updateVerticalLinecutWidth(linecut.id, value)}
                marks={[0, 10]}
                styles="w-full"
              />
            </div>

            {/* Slider for Linecut Position */}
            <div>
              <h4 className="text-sm mb-1">q<sub>x</sub> value (nm⁻¹)</h4>
              <InputSlider
                min={minQXValue}
                max={maxQXValue}
                value={parseFloat(linecut.position.toFixed(1))}
                step={0.1}
                onChange={(value) => updateVerticalLinecutPosition(linecut.id, value)}
                marks={[minQXValue, maxQXValue]}
                styles="w-full"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Color Picker Popup */}
      {colorPicker?.visible && (
        <ColorPickerPopup
          ref={colorPickerRef}
          colorPicker={colorPicker}
          onColorChange={handleColorChange}
          onAccept={() => setColorPicker(null)}
          onCancel={handleCancelColor}
        />
      )}
    </div>
  );
};

export default VerticalLinecutWidget;

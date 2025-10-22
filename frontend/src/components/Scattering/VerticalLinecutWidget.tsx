import React, { useState, useEffect, useCallback } from "react";
import { FaEye, FaEyeSlash, FaTrash } from "react-icons/fa"; // Icons for visibility toggle
import { Linecut } from './types';
import { InputSlider } from "@blueskyproject/finch";
import { Accordion } from "@mantine/core";
import ColorPickerPopup from "../ColorPickerPopup";

interface VerticalLinecutWidgetProps {
  linecutType: string | null;
  linecuts: Linecut[];
  qXMatrix: number[][]; // Changed from qXVector to qXMatrix
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
    originalColor: string; // Store the original color when opening the picker
    currentColor: string; // Track the current color during picking
    position: { top: number; left: number }; // Position for the color picker
  } | null>(null);

  // Calculate min and max q values from qXMatrix instead of qXVector
  const [minQXValue, maxQXValue] = React.useMemo(() => {
    if (!qXMatrix || !qXMatrix.length || !qXMatrix[0] || !qXMatrix[0].length) {
      return [0, 1]; // Default range if matrix is empty
    }

    let minVal = Infinity;
    let maxVal = -Infinity;

    // Extract values from first row - for vertical linecuts, we're interested in qX values
    // which are in the first row across columns
    for (let x = 0; x < qXMatrix[0].length; x++) {
      if (qXMatrix[0][x] !== undefined) {
        minVal = Math.min(minVal, qXMatrix[0][x]);
        maxVal = Math.max(maxVal, qXMatrix[0][x]);
      }
    }

    // Handle empty matrix case
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
    // Update the current color in the picker state
    if (colorPicker) {
      setColorPicker({
        ...colorPicker,
        currentColor: color,
      });
    }
    // Update the color preview
    updateVerticalLinecutColor(id, side, color);
  };

  const handleOpenColorPicker = (linecut: Linecut, side: "left" | "right", event: React.MouseEvent) => {
    // Check if the color picker is already open for this linecut and side
    if (colorPicker?.id === linecut.id && colorPicker?.side === side && colorPicker?.visible) {
      // If it is, close it and save the current color
      setColorPicker(null);
    } else {
      // If it's not open, or open for a different linecut/side, open it with the new settings
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
    <Accordion
      multiple={false}
      defaultValue={linecutType ? `${linecutType}-linecuts` : undefined}
      chevronPosition="right"
      classNames={{
        chevron: "text-md font-bold",
        label: "text-md font-bold",
        content: "p-0",
      }}
      className="w-full relative"
    >
      <Accordion.Item value={`${linecutType}-linecuts`} className="w-full">
        <Accordion.Control className="pl-0">{linecutType} Linecuts</Accordion.Control>
        <Accordion.Panel>
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden w-full">
            {linecuts.map((linecut) => (
              <div
                key={linecut.id}
                className="mb-5 pt-2 pb-5 pl-2 pr-3 relative shadow-lg border rounded-lg"
                role="region"
                aria-labelledby={`linecut-${linecut.id}-title`}
              >
                {/* Linecut Title with Color Pickers */}
                <div className="text-md text-center font-medium">
                  Linecut {linecut.id}
                </div>
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="flex items-center ml-4">
                    {/* Left color bar with tooltip */}
                    <div className="group relative">
                      <div
                        className="h-3 w-12 mr-4 cursor-pointer"
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
                        className="h-3 w-12 mr-2 cursor-pointer"
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
                        className="text-blue-500 hover:text-blue-700 ml-1 flex items-center pointer-events-auto"
                        onClick={() => toggleVerticalLinecutVisibility(linecut.id)}
                        aria-label={`Toggle Visibility of Linecut ${linecut.id}`}
                      >
                        {linecut.hidden ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                      </button>
                      {/* Tooltip */}
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                        {linecut.hidden ? "Show" : "Hide"}
                      </span>
                    </div>
                    {/* Delete button with tooltip */}
                    <div className="group relative ml-4" style={{ transform: 'translateY(1px)' }}>
                      <button
                        className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white rounded"
                        onClick={() => deleteVerticalLinecut(linecut.id)}
                        aria-label={`Delete Linecut ${linecut.id}`}
                      >
                        <FaTrash size={14} />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                        Delete
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slider and Input Box for Linecut Width */}
                <div className="mb-6">
                  <h4 className="text-md mb-2">Width (nm⁻¹)</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
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
                  </div>
                </div>

                {/* Slider and Input Box for Linecut Position */}
                <div className="mb-4">
                  <h4 className="text-md mb-2">q<sub>x</sub> value (nm⁻¹)</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
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
                </div>
              </div>
            ))}
          </div>
        </Accordion.Panel>
      </Accordion.Item>

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
    </Accordion>
  );
};

export default VerticalLinecutWidget;

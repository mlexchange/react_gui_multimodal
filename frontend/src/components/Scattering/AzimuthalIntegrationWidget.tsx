import React, { useRef, useState, useCallback } from 'react';
import { Accordion } from '@mantine/core';
import { FaEye, FaEyeSlash, FaTrash } from 'react-icons/fa';
import InputSliderRange from '../InputSliderRange';
import { AzimuthalIntegration } from './types';
import ColorPickerPopup from '../ColorPickerPopup';

interface AzimuthalIntegrationWidgetProps {
    integrations: AzimuthalIntegration[];
    maxQValue: number;
    updateAzimuthalQRange: (id: number, range: [number, number]) => void;
    updateAzimuthalRange: (id: number, range: [number, number]) => void;
    updateAzimuthalColor: (id: number, side: 'left' | 'right', color: string) => void;
    deleteAzimuthalIntegration: (id: number) => void;
    toggleAzimuthalVisibility: (id: number) => void;
}

export default function AzimuthalIntegrationWidget({
    integrations,
    maxQValue,
    updateAzimuthalQRange,
    updateAzimuthalRange,
    updateAzimuthalColor,
    deleteAzimuthalIntegration,
    toggleAzimuthalVisibility,
}: AzimuthalIntegrationWidgetProps) {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [colorPicker, setColorPicker] = useState<{
    id: number;
    side: "left" | "right";
    visible: boolean;
    originalColor: string;
    currentColor: string;
    position: { top: number; left: number };
  } | null>(null);

  const getQRangeValues = (integration: AzimuthalIntegration): [number, number] => {
    if (integration.qRange === null) {
      return [0, maxQValue];
    }
    return integration.qRange;
  };

  const handleOpenColorPicker = (integration: AzimuthalIntegration, side: "left" | "right", event: React.MouseEvent) => {
    if (colorPicker?.id === integration.id && colorPicker?.side === side && colorPicker?.visible) {
      setColorPicker(null);
    } else {
      const originalColor = side === "left" ? integration.leftColor : integration.rightColor;
      setColorPicker({
        id: integration.id,
        side,
        visible: true,
        originalColor,
        currentColor: originalColor,
        position: { top: event.clientY + 10, left: event.clientX },
      });
    }
  };

  const handleColorChange = (id: number, side: "left" | "right", color: string) => {
    if (colorPicker) {
      setColorPicker({
        ...colorPicker,
        currentColor: color,
      });
    }
    updateAzimuthalColor(id, side, color);
  };

  const handleCancelColor = useCallback(() => {
    if (colorPicker) {
      updateAzimuthalColor(
        colorPicker.id,
        colorPicker.side,
        colorPicker.originalColor
      );
      setColorPicker(null);
    }
  }, [colorPicker, updateAzimuthalColor]);

  React.useEffect(() => {
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
      defaultValue="azimuthal-integrations"
      chevronPosition="right"
      classNames={{
        chevron: "text-md font-bold",
        label: "text-md font-bold",
        content: "p-0",
      }}
      className="w-full relative"
    >
      <Accordion.Item value="azimuthal-integrations" className="w-full">
        <Accordion.Control className="pl-0">Azimuthal Integrations</Accordion.Control>
        <Accordion.Panel>
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden w-full">
            {integrations.map((integration) => {
              const currentQRange = getQRangeValues(integration);

              return (
                <div
                  key={integration.id}
                  className="mb-5 pt-2 pb-5 pl-2 pr-3 relative shadow-lg border rounded-lg"
                  role="region"
                  aria-labelledby={`integration-${integration.id}`}
                >
                {/* Integration Title with Color Pickers */}
                <div className="text-md text-center font-medium">
                  Integral {integration.id}
                </div>
                <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex items-center">
                        {/* Left color bar */}
                        <div className="group relative">
                        <div
                            className="h-3 w-12 mr-4 cursor-pointer"
                            style={{ backgroundColor: integration.leftColor }}
                            onClick={(e) => handleOpenColorPicker(integration, 'left', e)}
                        />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                            Click to change color
                        </span>
                        </div>
                        {/* Right color bar */}
                        <div className="group relative">
                        <div
                            className="h-3 w-12 mr-2 cursor-pointer"
                            style={{ backgroundColor: integration.rightColor }}
                            onClick={(e) => handleOpenColorPicker(integration, 'right', e)}
                        />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                            Click to change color
                        </span>
                        </div>
                        {/* Eye icon */}
                        <div className="group relative">
                        <button
                            className="text-blue-500 hover:text-blue-700 ml-1 flex items-center pointer-events-auto"
                            onClick={() => toggleAzimuthalVisibility(integration.id)}
                            aria-label={`Toggle Visibility of Integration ${integration.id}`}
                        >
                            {integration.hidden ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                        </button>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                            {integration.hidden ? "Show" : "Hide"}
                        </span>
                        </div>
                        {/* Delete button */}
                        <div className="group relative ml-4" style={{ transform: 'translateY(1px)' }}>
                        <button
                            className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white rounded"
                            onClick={() => deleteAzimuthalIntegration(integration.id)}
                            aria-label={`Delete Integration ${integration.id}`}
                        >
                            <FaTrash size={14} />
                        </button>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                            Delete
                        </span>
                        </div>
                    </div>
                    </div>



                  <div className="mb-6">
                    <h4 className="text-md mb-2">Q-Range (nm⁻¹)</h4>
                    <div className="space-y-2">
                      <InputSliderRange
                        value={[currentQRange[0], currentQRange[1]]}
                        onChange={(value) => updateAzimuthalQRange(integration.id, [value[0], value[1]])}
                        min={0}
                        max={Number(maxQValue.toFixed(1))}
                        step={0.1}
                      />
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between w-full">
                          <label className="text-sm text-gray-600">Min:</label>
                          <input
                            type="number"
                            value={currentQRange[0].toFixed(2)}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value);
                              if (!isNaN(newValue)) {
                                updateAzimuthalQRange(integration.id, [
                                  Math.min(newValue, currentQRange[1]),
                                  currentQRange[1]
                                ]);
                              }
                            }}
                            disabled={integration.hidden}
                            className="w-28 p-2 border border-gray-300 rounded text-center text-sm"
                            step={0.1}
                            min={0}
                            max={currentQRange[1]}
                          />
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <label className="text-sm text-gray-600">Max:</label>
                          <input
                            type="number"
                            value={currentQRange[1].toFixed(2)}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value);
                              if (!isNaN(newValue)) {
                                updateAzimuthalQRange(integration.id, [
                                  currentQRange[0],
                                  Math.max(newValue, currentQRange[0])
                                ]);
                              }
                            }}
                            disabled={integration.hidden}
                            className="w-28 p-2 border border-gray-300 rounded text-center text-sm"
                            step={0.1}
                            min={currentQRange[0]}
                            max={maxQValue}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-md mb-2">Azimuthal Range (degrees)</h4>
                    <div className="space-y-2">
                      <InputSliderRange
                        value={[integration.azimuthRange[0], integration.azimuthRange[1]]}
                        onChange={(value) => updateAzimuthalRange(integration.id, [value[0], value[1]])}
                        min={-180}
                        max={180}
                        step={1}
                      />
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between w-full">
                          <label className="text-sm text-gray-600">Min:</label>
                          <input
                            type="number"
                            value={integration.azimuthRange[0]}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value);
                              if (!isNaN(newValue)) {
                                updateAzimuthalRange(integration.id, [
                                  Math.min(newValue, integration.azimuthRange[1]),
                                  integration.azimuthRange[1]
                                ]);
                              }
                            }}
                            disabled={integration.hidden}
                            className="w-28 p-2 border border-gray-300 rounded text-center text-sm"
                            step={1}
                            min={-180}
                            max={integration.azimuthRange[1]}
                          />
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <label className="text-sm text-gray-600">Max:</label>
                          <input
                            type="number"
                            value={integration.azimuthRange[1]}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value);
                              if (!isNaN(newValue)) {
                                updateAzimuthalRange(integration.id, [
                                  integration.azimuthRange[0],
                                  Math.max(newValue, integration.azimuthRange[0])
                                ]);
                              }
                            }}
                            disabled={integration.hidden}
                            className="w-28 p-2 border border-gray-300 rounded text-center text-sm"
                            step={1}
                            min={integration.azimuthRange[0]}
                            max={180}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Accordion.Panel>
      </Accordion.Item>

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
}

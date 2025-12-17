import React, { useRef, useState, useCallback } from 'react';
import { EyeIcon, EyeSlashIcon, TrashSimpleIcon } from '@phosphor-icons/react';
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
    <div className="w-full relative mb-4">
      {/* Section Title */}
      <h3 className="text-md font-bold mb-2 text-center text-sky-900">Azimuthal Integrations</h3>

      {/* Integrations List */}
      <div className="w-full">
        {integrations.map((integration) => {
          const currentQRange = getQRangeValues(integration);

          return (
            <div
              key={integration.id}
              className="mb-3 pt-2 pb-4 px-3 relative border rounded-lg"
              role="region"
              aria-labelledby={`integration-${integration.id}`}
            >
              {/* Integration header: number on left, controls on right */}
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-sm font-semibold">#{integration.id}</span>
                <div className="flex items-center gap-2">
                  {/* Left color bar */}
                  <div className="group relative">
                    <div
                      className="h-3 w-8 cursor-pointer rounded"
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
                      className="h-3 w-8 cursor-pointer rounded"
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
                      className="flex items-center"
                      onClick={() => toggleAzimuthalVisibility(integration.id)}
                      aria-label={`Toggle Visibility of Integration ${integration.id}`}
                    >
                      {integration.hidden ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                      {integration.hidden ? "Show" : "Hide"}
                    </span>
                  </div>
                  {/* Delete button */}
                  <div className="group relative">
                    <button
                      className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white rounded"
                      onClick={() => deleteAzimuthalIntegration(integration.id)}
                      aria-label={`Delete Integration ${integration.id}`}
                    >
                      <TrashSimpleIcon size={16} />
                    </button>
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                      Delete
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm mb-1">Q-Range (nm⁻¹)</h4>
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

              <div>
                <h4 className="text-sm mb-1">Azimuthal Range (degrees)</h4>
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
}

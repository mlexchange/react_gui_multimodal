import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon, TrashSimpleIcon } from '@phosphor-icons/react';
import { InputSlider } from '@blueskyproject/finch';
import ColorPickerPopup from '../ColorPickerPopup';
import { InclinedLinecut } from './types';

interface InclinedLinecutWidgetProps {
  linecutType: string;
  linecuts: InclinedLinecut[];
  units: string;
  updateInclinedLinecutAngle: (id: number, angle: number) => void;
  updateInclinedLinecutWidth: (id: number, qWidth: number) => void;
  updateInclinedLinecutColor: (id: number, side: 'left' | 'right', color: string) => void;
  deleteInclinedLinecut: (id: number) => void;
  toggleInclinedLinecutVisibility: (id: number) => void;
}

const InclinedLinecutWidget: React.FC<InclinedLinecutWidgetProps> = ({
  linecutType,
  linecuts,
  units,
  updateInclinedLinecutAngle,
  updateInclinedLinecutWidth,
  updateInclinedLinecutColor,
  deleteInclinedLinecut,
  toggleInclinedLinecutVisibility,
}) => {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [colorPicker, setColorPicker] = useState<{
    id: number;
    side: 'left' | 'right';
    visible: boolean;
    originalColor: string;
    currentColor: string;
    position: { top: number; left: number };
  } | null>(null);

  const handleCancelColor = useCallback(() => {
    if (colorPicker) {
      updateInclinedLinecutColor(
        colorPicker.id,
        colorPicker.side,
        colorPicker.originalColor
      );
      setColorPicker(null);
    }
  }, [colorPicker, updateInclinedLinecutColor]);

  const handleColorChange = (id: number, side: 'left' | 'right', color: string) => {
    if (colorPicker) {
      setColorPicker({
        ...colorPicker,
        currentColor: color,
      });
    }
    updateInclinedLinecutColor(id, side, color);
  };

  const handleOpenColorPicker = (linecut: InclinedLinecut, side: 'left' | 'right', event: React.MouseEvent) => {
    const originalColor = side === 'left' ? linecut.leftColor : linecut.rightColor;
    setColorPicker({
      id: linecut.id,
      side,
      visible: true,
      originalColor,
      currentColor: originalColor,
      position: { top: event.clientY + 10, left: event.clientX },
    });
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
                    onClick={(e) => handleOpenColorPicker(linecut, 'left', e)}
                  />
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    Click to change color
                  </span>
                </div>
                {/* Right color bar with tooltip */}
                <div className="group relative">
                  <div
                    className="h-3 w-8 cursor-pointer rounded"
                    style={{ backgroundColor: linecut.rightColor }}
                    onClick={(e) => handleOpenColorPicker(linecut, 'right', e)}
                  />
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                    Click to change color
                  </span>
                </div>
                {/* Visibility Toggle with Tooltip */}
                <div className="group relative">
                  <button
                    className="flex items-center"
                    onClick={() => toggleInclinedLinecutVisibility(linecut.id)}
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
                    onClick={() => deleteInclinedLinecut(linecut.id)}
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

            {/* Controls Section */}
            <div className="space-y-4">
              {/* Width Control in q-space */}
              <div>
                <h4 className="text-sm mb-1">Width ({units})</h4>
                <InputSlider
                  min={0}
                  max={10}
                  marks={[0, 10]}
                  value={linecut.qWidth ?? 0}
                  step={0.01}
                  onChange={(value) => updateInclinedLinecutWidth(linecut.id, value)}
                />
              </div>

              {/* Angle Control */}
              <div>
                <h4 className="text-sm mb-1">Angle (degrees)</h4>
                <InputSlider
                  min={-90}
                  max={90}
                  marks={[90, 0, -90]}
                  value={linecut.angle ?? 0}
                  step={1}
                  onChange={(value) => updateInclinedLinecutAngle(linecut.id, value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Color Picker Popup */}
      {colorPicker?.visible && (
        <div ref={colorPickerRef}>
          <ColorPickerPopup
            colorPicker={colorPicker}
            onColorChange={handleColorChange}
            onAccept={() => setColorPicker(null)}
            onCancel={handleCancelColor}
          />
        </div>
      )}
    </div>
  );
};

export default InclinedLinecutWidget;

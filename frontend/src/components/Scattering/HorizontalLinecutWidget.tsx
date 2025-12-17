import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Linecut } from './types';
import { InputSlider } from "@blueskyproject/finch"
import ColorPickerPopup from "../ColorPickerPopup";
import { ColorBox, IconButton, DeleteButton, SectionHeader, ItemContainer } from "../ui";
import { useColorPicker } from "../../hooks/useColorPicker";

interface HorizontalLinecutWidgetProps {
  linecutType: string | null;
  linecuts: Linecut[];
  qYMatrix: number[][]; // Changed from qYVector to qYMatrix
  updateHorizontalLinecutPosition: (id: number, position: number) => void;
  updateHorizontalLinecutWidth: (id: number, width: number) => void;
  updateHorizontalLinecutColor: (id: number, side: "left" | "right", color: string) => void;
  deleteHorizontalLinecut: (id: number) => void;
  toggleHorizontalLinecutVisibility: (id: number) => void;
}

const HorizontalLinecutWidget: React.FC<HorizontalLinecutWidgetProps> = ({
  linecutType,
  linecuts,
  qYMatrix,
  updateHorizontalLinecutPosition,
  updateHorizontalLinecutWidth,
  updateHorizontalLinecutColor,
  deleteHorizontalLinecut,
  toggleHorizontalLinecutVisibility,
}) => {
  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor,
  } = useColorPicker({ onColorChange: updateHorizontalLinecutColor });

  // Find min and max q values from the matrix's first column
  const [minQYValue, maxQYValue] = React.useMemo(() => {
    if (!qYMatrix || !qYMatrix.length) {
      return [0, 1];
    }

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let y = 0; y < qYMatrix.length; y++) {
      if (qYMatrix[y] && qYMatrix[y][0] !== undefined) {
        minVal = Math.min(minVal, qYMatrix[y][0]);
        maxVal = Math.max(maxVal, qYMatrix[y][0]);
      }
    }

    if (minVal === Infinity || maxVal === -Infinity) {
      return [0, 1];
    }

    return [
      parseFloat(minVal.toFixed(1)),
      parseFloat(maxVal.toFixed(1))
    ];
  }, [qYMatrix]);

  return (
    <div className="w-full relative mb-4">
      <SectionHeader>{linecutType} Linecuts</SectionHeader>

      <div className="w-full">
        {linecuts.map((linecut) => (
          <ItemContainer key={linecut.id} id={linecut.id}>
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-sm font-semibold">#{linecut.id}</span>
              <div className="flex items-center gap-2">
                <ColorBox
                  color={linecut.leftColor}
                  onClick={(e) => handleOpenColorPicker(linecut, "left", e)}
                />
                <ColorBox
                  color={linecut.rightColor}
                  onClick={(e) => handleOpenColorPicker(linecut, "right", e)}
                />
                <IconButton
                  onClick={() => toggleHorizontalLinecutVisibility(linecut.id)}
                  ariaLabel={`Toggle Visibility of Linecut ${linecut.id}`}
                  tooltip={linecut.hidden ? "Show" : "Hide"}
                  size="sm"
                >
                  {linecut.hidden ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                </IconButton>
                <DeleteButton
                  onClick={() => deleteHorizontalLinecut(linecut.id)}
                  ariaLabel={`Delete Linecut ${linecut.id}`}
                />
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm mb-1">Width (nm⁻¹)</h4>
              <InputSlider
                min={0}
                max={10}
                value={linecut.width || 0}
                step={0.1}
                onChange={(value) => updateHorizontalLinecutWidth(linecut.id, value)}
                marks={[0, 10]}
                styles="w-full"
              />
            </div>

            <div>
              <h4 className="text-sm mb-1">q<sub>y</sub> value (nm⁻¹)</h4>
              <InputSlider
                min={minQYValue}
                max={maxQYValue}
                value={parseFloat(linecut.position.toFixed(1))}
                step={0.1}
                onChange={(value) => updateHorizontalLinecutPosition(linecut.id, value)}
                marks={[minQYValue, maxQYValue]}
                styles="w-full"
              />
            </div>
          </ItemContainer>
        ))}
      </div>

      {colorPicker?.visible && (
        <ColorPickerPopup
          ref={colorPickerRef}
          colorPicker={colorPicker}
          onColorChange={handleColorChange}
          onAccept={handleAcceptColor}
          onCancel={handleCancelColor}
        />
      )}
    </div>
  );
};

export default HorizontalLinecutWidget;

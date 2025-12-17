import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Linecut } from './types';
import { InputSlider } from "@blueskyproject/finch";
import ColorPickerPopup from "../ColorPickerPopup";
import { ColorBox, IconButton, DeleteButton, SectionHeader, ItemContainer } from "../ui";
import { useColorPicker } from "../../hooks/useColorPicker";

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
  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor,
  } = useColorPicker({ onColorChange: updateVerticalLinecutColor });

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
                  onClick={() => toggleVerticalLinecutVisibility(linecut.id)}
                  ariaLabel={`Toggle Visibility of Linecut ${linecut.id}`}
                  tooltip={linecut.hidden ? "Show" : "Hide"}
                  size="sm"
                >
                  {linecut.hidden ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                </IconButton>
                <DeleteButton
                  onClick={() => deleteVerticalLinecut(linecut.id)}
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
                onChange={(value) => updateVerticalLinecutWidth(linecut.id, value)}
                marks={[0, 10]}
                styles="w-full"
              />
            </div>

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

export default VerticalLinecutWidget;

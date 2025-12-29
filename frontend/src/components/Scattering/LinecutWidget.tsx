import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Linecut } from './types';
import { InputSlider } from "@blueskyproject/finch";
import { IconButton } from "@/components/ui";
import { ColorPickerPopup, ColorBox, DeleteButton } from "@/components/shared";
import { LinecutSectionHeader, LinecutItemContainer } from "./LinecutItemContainer";
import { useColorPicker } from "../../hooks/useColorPicker";

type LinecutDirection = 'horizontal' | 'vertical';

interface LinecutWidgetProps {
  direction: LinecutDirection;
  linecutType: string | null;
  linecuts: Linecut[];
  qMatrix: number[][];
  updatePosition: (id: number, position: number) => void;
  updateWidth: (id: number, width: number) => void;
  updateColor: (id: number, side: "left" | "right", color: string) => void;
  deleteLinecut: (id: number) => void;
  toggleVisibility: (id: number) => void;
}

const directionConfig = {
  horizontal: {
    positionLabel: <>q<sub>y</sub> value (nm⁻¹)</>,
    extractMinMax: (matrix: number[][]) => {
      if (!matrix || !matrix.length) return [0, 1];
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let y = 0; y < matrix.length; y++) {
        if (matrix[y] && matrix[y][0] !== undefined) {
          minVal = Math.min(minVal, matrix[y][0]);
          maxVal = Math.max(maxVal, matrix[y][0]);
        }
      }
      if (minVal === Infinity || maxVal === -Infinity) return [0, 1];
      return [parseFloat(minVal.toFixed(1)), parseFloat(maxVal.toFixed(1))];
    },
  },
  vertical: {
    positionLabel: <>q<sub>x</sub> value (nm⁻¹)</>,
    extractMinMax: (matrix: number[][]) => {
      if (!matrix || !matrix.length || !matrix[0] || !matrix[0].length) return [0, 1];
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let x = 0; x < matrix[0].length; x++) {
        if (matrix[0][x] !== undefined) {
          minVal = Math.min(minVal, matrix[0][x]);
          maxVal = Math.max(maxVal, matrix[0][x]);
        }
      }
      if (minVal === Infinity || maxVal === -Infinity) return [0, 1];
      return [parseFloat(minVal.toFixed(1)), parseFloat(maxVal.toFixed(1))];
    },
  },
};

const LinecutWidget: React.FC<LinecutWidgetProps> = ({
  direction,
  linecutType,
  linecuts,
  qMatrix,
  updatePosition,
  updateWidth,
  updateColor,
  deleteLinecut,
  toggleVisibility,
}) => {
  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor,
  } = useColorPicker({ onColorChange: updateColor });

  const config = directionConfig[direction];
  const [minQValue, maxQValue] = React.useMemo(
    () => config.extractMinMax(qMatrix),
    [qMatrix, config]
  );

  return (
    <div className="w-full relative mb-4">
      <LinecutSectionHeader>{linecutType} Linecuts</LinecutSectionHeader>

      <div className="w-full">
        {linecuts.map((linecut) => (
          <LinecutItemContainer key={linecut.id} id={linecut.id}>
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
                  onClick={() => toggleVisibility(linecut.id)}
                  ariaLabel={`Toggle Visibility of Linecut ${linecut.id}`}
                  tooltip={linecut.hidden ? "Show" : "Hide"}
                  size="sm"
                >
                  {linecut.hidden ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
                </IconButton>
                <DeleteButton
                  onClick={() => deleteLinecut(linecut.id)}
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
                onChange={(value) => updateWidth(linecut.id, value)}
                marks={[0, 10]}
                styles="w-full"
              />
            </div>

            <div>
              <h4 className="text-sm mb-1">{config.positionLabel}</h4>
              <InputSlider
                min={minQValue}
                max={maxQValue}
                value={parseFloat(linecut.position.toFixed(1))}
                step={0.1}
                onChange={(value) => updatePosition(linecut.id, value)}
                marks={[minQValue, maxQValue]}
                styles="w-full"
              />
            </div>
          </LinecutItemContainer>
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

export default LinecutWidget;

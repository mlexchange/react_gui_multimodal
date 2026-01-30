import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Linecut, LinecutDirection } from "./types";
import { InputSlider } from "@blueskyproject/finch";
import { IconButton } from "@/components/ui";
import { ColorPickerPopup, ColorBox, DeleteButton } from "@/components/shared";
import {
  LinecutSectionHeader,
  LinecutItemContainer
} from "./LinecutItemContainer";
import { useColorPicker } from "../../hooks/useColorPicker";

interface LinecutWidgetProps {
  direction: LinecutDirection;
  linecutType: string | null;
  linecuts: Linecut[];
  qVector: number[];
  experimentType?: string;
  qStep?: number;
  updatePosition: (id: number, position: number) => void;
  updateWidth: (id: number, width: number) => void;
  updateColor: (id: number, side: "left" | "right", color: string) => void;
  deleteLinecut: (id: number) => void;
  toggleVisibility: (id: number) => void;
}

const extractMinMax = (vector: number[]): [number, number] => {
  if (!vector || !vector.length) return [0, 1];
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] !== undefined) {
      minVal = Math.min(minVal, vector[i]);
      maxVal = Math.max(maxVal, vector[i]);
    }
  }
  if (minVal === Infinity || maxVal === -Infinity) return [0, 1];
  return [parseFloat(minVal.toFixed(4)), parseFloat(maxVal.toFixed(4))];
};

const getPositionLabel = (
  direction: LinecutDirection,
  experimentType?: string
): React.ReactNode => {
  const isGisaxs = experimentType?.toLowerCase() === "gisaxs";
  if (direction === "horizontal") {
    return isGisaxs ? (
      <>
        q<sub>oop</sub> value (nm⁻¹)
      </>
    ) : (
      <>
        q<sub>y</sub> value (nm⁻¹)
      </>
    );
  }
  return isGisaxs ? (
    <>
      q<sub>ip</sub> value (nm⁻¹)
    </>
  ) : (
    <>
      q<sub>x</sub> value (nm⁻¹)
    </>
  );
};

const LinecutWidget: React.FC<LinecutWidgetProps> = ({
  direction,
  linecutType,
  linecuts,
  qVector,
  experimentType,
  qStep = 0.1,
  updatePosition,
  updateWidth,
  updateColor,
  deleteLinecut,
  toggleVisibility
}) => {
  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor
  } = useColorPicker({ onColorChange: updateColor });

  const positionLabel = React.useMemo(
    () => getPositionLabel(direction, experimentType),
    [direction, experimentType]
  );
  const [minQValue, maxQValue] = React.useMemo(
    () => extractMinMax(qVector),
    [qVector]
  );

  // Calculate max width based on q-range (rounded to 2 decimal places)
  const maxWidth = React.useMemo(() => {
    const qRange = Math.abs(maxQValue - minQValue);
    return parseFloat(qRange.toFixed(2)) || 10;
  }, [minQValue, maxQValue]);

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
                  {linecut.hidden ? (
                    <EyeSlashIcon size={18} />
                  ) : (
                    <EyeIcon size={18} />
                  )}
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
                max={maxWidth}
                value={linecut.width || 0}
                step={qStep}
                onChange={(value) => updateWidth(linecut.id, value)}
                marks={[0, maxWidth]}
                styles="w-full"
              />
            </div>

            <div>
              <h4 className="text-sm mb-1">{positionLabel}</h4>
              <InputSlider
                min={minQValue}
                max={maxQValue}
                value={linecut.position}
                step={qStep}
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

export default React.memo(LinecutWidget);

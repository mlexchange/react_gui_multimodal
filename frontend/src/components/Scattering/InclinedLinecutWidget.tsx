import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { InputSlider } from "@blueskyproject/finch";
import { InclinedLinecut } from "./types";
import { IconButton } from "@/components/ui";
import { ColorPickerPopup, ColorBox, DeleteButton } from "@/components/shared";
import {
  LinecutSectionHeader,
  LinecutItemContainer
} from "./LinecutItemContainer";
import { useColorPicker } from "../../hooks/useColorPicker";

interface InclinedLinecutWidgetProps {
  linecutType: string;
  linecuts: InclinedLinecut[];
  units: string;
  maxQWidth?: number;
  updateInclinedLinecutAngle: (id: number, angle: number) => void;
  updateInclinedLinecutWidth: (id: number, qWidth: number) => void;
  updateInclinedLinecutColor: (
    id: number,
    side: "left" | "right",
    color: string
  ) => void;
  deleteInclinedLinecut: (id: number) => void;
  toggleInclinedLinecutVisibility: (id: number) => void;
}

const InclinedLinecutWidget: React.FC<InclinedLinecutWidgetProps> = ({
  linecutType,
  linecuts,
  units,
  maxQWidth: rawMaxQWidth = 10,
  updateInclinedLinecutAngle,
  updateInclinedLinecutWidth,
  updateInclinedLinecutColor,
  deleteInclinedLinecut,
  toggleInclinedLinecutVisibility
}) => {
  // Round maxQWidth to 2 decimal places
  const maxQWidth = parseFloat(rawMaxQWidth.toFixed(2)) || 10;

  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor
  } = useColorPicker({ onColorChange: updateInclinedLinecutColor });

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
                  onClick={() => toggleInclinedLinecutVisibility(linecut.id)}
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
                  onClick={() => deleteInclinedLinecut(linecut.id)}
                  ariaLabel={`Delete Linecut ${linecut.id}`}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm mb-1">Width ({units})</h4>
                <InputSlider
                  min={0}
                  max={maxQWidth}
                  marks={[0, maxQWidth]}
                  value={linecut.qWidth ?? 0}
                  step={0.01}
                  onChange={(value) =>
                    updateInclinedLinecutWidth(linecut.id, value)
                  }
                />
              </div>

              <div>
                <h4 className="text-sm mb-1">Angle (degrees)</h4>
                <InputSlider
                  min={-90}
                  max={90}
                  marks={[90, 0, -90]}
                  value={linecut.angle ?? 0}
                  step={1}
                  onChange={(value) =>
                    updateInclinedLinecutAngle(linecut.id, value)
                  }
                />
              </div>
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

export default InclinedLinecutWidget;

import React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { InputSliderRange } from "@blueskyproject/finch";
import { AzimuthalIntegration } from "./types";
import { IconButton } from "@/components/ui";
import { ColorPickerPopup, ColorBox, DeleteButton } from "@/components/shared";
import {
  LinecutSectionHeader,
  LinecutItemContainer
} from "./LinecutItemContainer";
import { useColorPicker } from "../../hooks/useColorPicker";

interface AzimuthalIntegrationWidgetProps {
  integrations: AzimuthalIntegration[];
  maxQValue: number;
  qStep?: number;
  updateAzimuthalQRange: (id: number, range: [number, number]) => void;
  updateAzimuthalRange: (id: number, range: [number, number]) => void;
  updateAzimuthalColor: (
    id: number,
    side: "left" | "right",
    color: string
  ) => void;
  deleteAzimuthalIntegration: (id: number) => void;
  toggleAzimuthalVisibility: (id: number) => void;
}

function AzimuthalIntegrationWidget({
  integrations,
  maxQValue,
  qStep = 0.1,
  updateAzimuthalQRange,
  updateAzimuthalRange,
  updateAzimuthalColor,
  deleteAzimuthalIntegration,
  toggleAzimuthalVisibility
}: AzimuthalIntegrationWidgetProps) {
  const {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor
  } = useColorPicker({ onColorChange: updateAzimuthalColor });

  const getQRangeValues = (
    integration: AzimuthalIntegration
  ): [number, number] => {
    if (integration.qRange === null) {
      return [0, maxQValue];
    }
    return integration.qRange;
  };

  return (
    <div className="w-full relative mb-4">
      <LinecutSectionHeader>Azimuthal Integrations</LinecutSectionHeader>

      <div className="w-full">
        {integrations.map((integration) => {
          const currentQRange = getQRangeValues(integration);

          return (
            <LinecutItemContainer key={integration.id} id={integration.id}>
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-sm font-semibold">#{integration.id}</span>
                <div className="flex items-center gap-2">
                  <ColorBox
                    color={integration.leftColor}
                    onClick={(e) =>
                      handleOpenColorPicker(integration, "left", e)
                    }
                  />
                  <ColorBox
                    color={integration.rightColor}
                    onClick={(e) =>
                      handleOpenColorPicker(integration, "right", e)
                    }
                  />
                  <IconButton
                    onClick={() => toggleAzimuthalVisibility(integration.id)}
                    ariaLabel={`Toggle Visibility of Integration ${integration.id}`}
                    tooltip={integration.hidden ? "Show" : "Hide"}
                    size="sm"
                  >
                    {integration.hidden ? (
                      <EyeSlashIcon size={18} />
                    ) : (
                      <EyeIcon size={18} />
                    )}
                  </IconButton>
                  <DeleteButton
                    onClick={() => deleteAzimuthalIntegration(integration.id)}
                    ariaLabel={`Delete Integration ${integration.id}`}
                  />
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm mb-1">Q-Range (nm⁻¹)</h4>
                <div className="space-y-2">
                  <InputSliderRange
                    value={[currentQRange[0], currentQRange[1]]}
                    onChange={(value) =>
                      updateAzimuthalQRange(integration.id, [
                        value[0],
                        value[1]
                      ])
                    }
                    min={0}
                    max={Number(maxQValue.toFixed(1))}
                    step={qStep}
                    showSideInput={false}
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
                        step={qStep}
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
                        step={qStep}
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
                    value={[
                      integration.azimuthRange[0],
                      integration.azimuthRange[1]
                    ]}
                    onChange={(value) =>
                      updateAzimuthalRange(integration.id, [value[0], value[1]])
                    }
                    min={-180}
                    max={180}
                    step={1}
                    showSideInput={false}
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
            </LinecutItemContainer>
          );
        })}
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
}

export default React.memo(AzimuthalIntegrationWidget);

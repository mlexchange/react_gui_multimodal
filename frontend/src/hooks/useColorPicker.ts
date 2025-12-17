import { useRef, useState, useCallback, useEffect } from "react";

export interface ColorPickerState {
  id: number;
  side: "left" | "right";
  visible: boolean;
  originalColor: string;
  currentColor: string;
  position: { top: number; left: number };
}

interface UseColorPickerOptions {
  onColorChange: (id: number, side: "left" | "right", color: string) => void;
}

export function useColorPicker({ onColorChange }: UseColorPickerOptions) {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [colorPicker, setColorPicker] = useState<ColorPickerState | null>(null);

  const handleCancelColor = useCallback(() => {
    if (colorPicker) {
      onColorChange(colorPicker.id, colorPicker.side, colorPicker.originalColor);
      setColorPicker(null);
    }
  }, [colorPicker, onColorChange]);

  const handleColorChange = useCallback(
    (id: number, side: "left" | "right", color: string) => {
      if (colorPicker) {
        setColorPicker({
          ...colorPicker,
          currentColor: color,
        });
      }
      onColorChange(id, side, color);
    },
    [colorPicker, onColorChange]
  );

  const handleOpenColorPicker = useCallback(
    (
      item: { id: number; leftColor: string; rightColor: string },
      side: "left" | "right",
      event: React.MouseEvent
    ) => {
      if (colorPicker?.id === item.id && colorPicker?.side === side && colorPicker?.visible) {
        setColorPicker(null);
      } else {
        const originalColor = side === "left" ? item.leftColor : item.rightColor;
        setColorPicker({
          id: item.id,
          side,
          visible: true,
          originalColor,
          currentColor: originalColor,
          position: { top: event.clientY + 10, left: event.clientX },
        });
      }
    },
    [colorPicker]
  );

  const handleAcceptColor = useCallback(() => {
    setColorPicker(null);
  }, []);

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

  return {
    colorPickerRef,
    colorPicker,
    handleOpenColorPicker,
    handleColorChange,
    handleAcceptColor,
    handleCancelColor,
  };
}

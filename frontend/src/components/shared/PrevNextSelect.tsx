import React from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Select, IconButton } from '@/components/ui';

interface PrevNextSelectProps {
  label?: string;
  value: number | "";
  onChange: (value: number | "") => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  numItems: number;
  maxWidth?: number;  // Optional max width in pixels
}

export const PrevNextSelect: React.FC<PrevNextSelectProps> = ({ value, onChange, options, disabled, numItems, maxWidth = 400 }) => {
  const index = typeof value === 'number' ? value : -1;
  return (
    <div className="flex items-center gap-1 min-w-0 w-full" style={{ maxWidth: `${maxWidth}px` }}>
      <IconButton
        variant="subtle"
        size="sm"
        onClick={() => index > 0 && onChange(index - 1)}
        disabled={disabled || index <= 0}
        className="shrink-0"
      >
        <CaretLeftIcon size={18} />
      </IconButton>
      <div className="flex-1 min-w-0">
        <Select
          placeholder="Select item"
          value={value === "" ? "" : String(value)}
          onChange={(v) => onChange(v === null ? "" : Number(v))}
          data={options}
          searchable
          disabled={disabled}
        />
      </div>
      <IconButton
        variant="subtle"
        size="sm"
        onClick={() => index < numItems - 1 && onChange(index + 1)}
        disabled={disabled || index >= numItems - 1}
        className="shrink-0"
      >
        <CaretRightIcon size={18} />
      </IconButton>
    </div>
  );
};

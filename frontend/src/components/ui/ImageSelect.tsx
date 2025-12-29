import React from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Select } from './Select';
import { IconButton } from './IconButton';

interface ImageSelectProps {
  label?: string;
  value: number | "";
  onChange: (value: number | "") => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  numItems: number;
}

export const ImageSelect: React.FC<ImageSelectProps> = ({ value, onChange, options, disabled, numItems }) => {
  const index = typeof value === 'number' ? value : -1;
  return (
    <div className="flex items-center gap-1">
      <IconButton
        variant="subtle"
        size="sm"
        onClick={() => index > 0 && onChange(index - 1)}
        disabled={disabled || index <= 0}
      >
        <CaretLeftIcon size={18} />
      </IconButton>
      <Select
        placeholder="Select image"
        value={value === "" ? "" : String(value)}
        onChange={(v) => onChange(v === null ? "" : Number(v))}
        data={options}
        searchable
        disabled={disabled}
      />
      <IconButton
        variant="subtle"
        size="sm"
        onClick={() => index < numItems - 1 && onChange(index + 1)}
        disabled={disabled || index >= numItems - 1}
      >
        <CaretRightIcon size={18} />
      </IconButton>
    </div>
  );
};

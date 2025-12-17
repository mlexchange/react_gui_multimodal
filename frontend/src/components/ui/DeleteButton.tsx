import { TrashSimpleIcon } from "@phosphor-icons/react";
import { IconButton } from "./IconButton";

interface DeleteButtonProps {
  onClick: () => void;
  ariaLabel: string;
  tooltip?: string;
}

export function DeleteButton({ onClick, ariaLabel, tooltip = "Delete" }: DeleteButtonProps) {
  return (
    <IconButton
      onClick={onClick}
      variant="danger"
      size="sm"
      ariaLabel={ariaLabel}
      tooltip={tooltip}
    >
      <TrashSimpleIcon size={16} />
    </IconButton>
  );
}

import { IconButton } from "@/components/ui";
import { XIcon } from "@phosphor-icons/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  titleIcon,
  children,
  showCloseButton = true
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 text-sky-950">
          <div className="flex items-center gap-2">
            {titleIcon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          {showCloseButton && (
            <IconButton variant="subtle" size="md" onClick={onClose}>
              <XIcon size={20} />
            </IconButton>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

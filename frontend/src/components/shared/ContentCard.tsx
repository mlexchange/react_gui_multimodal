import { SpinnerGapIcon } from "@phosphor-icons/react";

interface ContentCardProps {
  title?: string;
  headerChildren?: React.ReactNode;
  centerHeader?: boolean;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  isLoading?: boolean;
  allowOverflow?: boolean;
}

export function ContentCard({
  title,
  headerChildren,
  centerHeader = false,
  children,
  className = "",
  contentClassName = "p-2",
  isLoading = false,
  allowOverflow = false
}: ContentCardProps) {
  const overflowClass = allowOverflow ? "overflow-visible" : "overflow-hidden";
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm ${overflowClass} flex flex-col ${className}`}
    >
      {/* Header */}
      <div
        className={`flex items-center px-4 py-1 border-b border-gray-200 flex-shrink-0 text-sky-950 ${
          centerHeader ? "justify-center" : "justify-between"
        }`}
      >
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        <div className="flex items-center gap-2">
          {headerChildren}
          {isLoading && (
            <SpinnerGapIcon size={18} className="animate-spin text-sky-950" />
          )}
        </div>
      </div>
      {/* Content */}
      <div className={`flex-1 ${overflowClass} ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}

import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  isVisible: boolean;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  isVisible,
  label = 'Loading data...'
}) => {
  if (!isVisible) return null;

  // Ensure progress is between 0 and 100
  const safeProgress = Math.min(100, Math.max(0, progress));

  // Minimum width for the blue bar to accommodate the text
  const minWidth = 30; // pixels
  const displayWidth = safeProgress < 5 ? minWidth : `${safeProgress}%`;

  return (
    <div className="w-full">
      {/* Progress bar container */}
      <div className="relative h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
        {/* Blue fill bar with internal centered text */}
        <div
          className="h-full bg-blue-500 flex items-center justify-center transition-all duration-300 overflow-visible"
          style={{
            width: displayWidth,
            minWidth: safeProgress < 5 ? minWidth : 0
          }}
        >
          <span className="text-xs font-medium text-white whitespace-nowrap px-1">
            {Math.round(safeProgress)}%
          </span>
        </div>
      </div>

      {/* Label text */}
      <div className="text-center text-sm mt-1 text-gray-600">
        {label}
      </div>
    </div>
  );
};

export default ProgressBar;

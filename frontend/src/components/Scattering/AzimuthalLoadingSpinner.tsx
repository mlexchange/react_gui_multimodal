// components/AzimuthalLoadingSpinner.tsx
import React from 'react';

interface AzimuthalLoadingSpinnerProps {
  isLoading: boolean;
  message?: string;
}

const AzimuthalLoadingSpinner: React.FC<AzimuthalLoadingSpinnerProps> = ({
  isLoading,
  message = "Processing azimuthal integration..."
}) => {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-lg font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
};

export default AzimuthalLoadingSpinner;

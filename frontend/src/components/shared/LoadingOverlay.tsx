interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded">
      <div className="bg-white px-4 py-2 rounded-lg shadow flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm text-gray-700">{message}</span>
      </div>
    </div>
  );
}

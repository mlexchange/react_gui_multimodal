import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { XIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon } from "@phosphor-icons/react";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "default" | "success" | "error" | "loading";
  autoClose?: number | false;
}

interface ShowToastProps {
  id: string;
  title: string;
  message: string;
  loading?: boolean;
  autoClose?: number | false;
}

interface UpdateToastProps {
  id: string;
  title: string;
  message: string;
  color?: "green" | "red";
  autoClose?: number | false;
}

interface ToastContextType {
  show: (props: ShowToastProps) => void;
  update: (props: UpdateToastProps) => void;
  hide: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Global reference for the singleton pattern
let globalToastRef: ToastContextType | null = null;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastProviderInner({ children, onMount }: { children: React.ReactNode; onMount: (api: ToastContextType) => void }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(({ id, title, message, loading, autoClose }: ShowToastProps) => {
    setToasts((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        return prev.map((t) =>
          t.id === id
            ? { ...t, title, message, type: loading ? "loading" : "default", autoClose }
            : t
        );
      }
      return [
        ...prev,
        { id, title, message, type: loading ? "loading" : "default", autoClose },
      ];
    });
  }, []);

  const update = useCallback(({ id, title, message, color, autoClose }: UpdateToastProps) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title,
              message,
              type: color === "green" ? "success" : color === "red" ? "error" : "default",
              autoClose,
            }
          : t
      )
    );

    // Auto-remove after autoClose duration
    if (typeof autoClose === "number" && autoClose > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, autoClose);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hide = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register the API on mount
  useEffect(() => {
    onMount({ show, update, hide });
  }, [show, update, hide, onMount]);

  return (
    <ToastContext.Provider value={{ show, update, hide }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-start gap-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full"
            duration={toast.autoClose === false ? Infinity : (typeof toast.autoClose === "number" ? toast.autoClose : 5000)}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === "loading" && (
                <SpinnerIcon size={20} className="text-blue-500 animate-spin" />
              )}
              {toast.type === "success" && (
                <CheckCircleIcon size={20} className="text-green-500" weight="fill" />
              )}
              {toast.type === "error" && (
                <XCircleIcon size={20} className="text-red-500" weight="fill" />
              )}
            </div>
            <div className="flex-1">
              <ToastPrimitive.Title className="font-medium text-sm text-slate-900">
                {toast.title}
              </ToastPrimitive.Title>
              <ToastPrimitive.Description className="text-sm text-gray-600 mt-1">
                {toast.message}
              </ToastPrimitive.Description>
            </div>
            <ToastPrimitive.Close className="flex-shrink-0 text-gray-400 hover:text-gray-600">
              <XIcon size={16} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-4 right-4 flex flex-col gap-2 w-96 max-w-[100vw] z-50" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const handleMount = useCallback((api: ToastContextType) => {
    globalToastRef = api;
  }, []);

  return (
    <ToastProviderInner onMount={handleMount}>
      {children}
    </ToastProviderInner>
  );
}

// Global notifications object for use outside of React components
export const notifications = {
  show: (props: ShowToastProps) => {
    if (globalToastRef) {
      globalToastRef.show(props);
    } else {
      console.warn("Toast not initialized. Make sure ToastProvider is mounted.");
    }
  },
  update: (props: UpdateToastProps) => {
    if (globalToastRef) {
      globalToastRef.update(props);
    } else {
      console.warn("Toast not initialized. Make sure ToastProvider is mounted.");
    }
  },
  hide: (id: string) => {
    if (globalToastRef) {
      globalToastRef.hide(id);
    } else {
      console.warn("Toast not initialized. Make sure ToastProvider is mounted.");
    }
  },
};

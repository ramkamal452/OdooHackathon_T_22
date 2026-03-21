'use client';

import { Toaster, toast as sonnerToast } from 'sonner';
import { createContext, useContext, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = (message: string, type: ToastType = 'info') => {
    switch (type) {
      case 'success':
        sonnerToast.success(message);
        break;
      case 'error':
        sonnerToast.error(message);
        break;
      case 'warning':
        sonnerToast.warning(message);
        break;
      default:
        sonnerToast.info(message);
    }
  };

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

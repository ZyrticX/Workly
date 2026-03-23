'use client'

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { useToast, type ToastType } from '@/hooks/use-toast'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

// ──────────────────────────────────────────────
// Context so any component can call toast()
// ──────────────────────────────────────────────

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToastContext() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider')
  return ctx
}

// ──────────────────────────────────────────────
// Styling helpers
// ──────────────────────────────────────────────

const typeStyles: Record<ToastType, string> = {
  success:
    'border-emerald-300/50 bg-emerald-50/80 text-emerald-800',
  error:
    'border-red-300/50 bg-red-50/80 text-red-800',
  warning:
    'border-amber-300/50 bg-amber-50/80 text-amber-800',
  info:
    'border-blue-300/50 bg-blue-50/80 text-blue-800',
}

const typeIcons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
}

// ──────────────────────────────────────────────
// ToastContainer (renders all active toasts)
// ──────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toast, toasts, removeToast } = useToast()

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast portal */}
      <div
        className="fixed top-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none"
        dir="rtl"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-2 rounded-xl border
              px-4 py-3 shadow-ios backdrop-blur-md
              animate-slide-in-top
              glass-card
              ${typeStyles[t.type]}
            `}
            role="alert"
          >
            <span className="shrink-0">{typeIcons[t.type]}</span>
            <span className="text-sm font-medium leading-snug">
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
              aria-label="סגור"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

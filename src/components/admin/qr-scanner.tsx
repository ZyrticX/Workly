'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type ConnectionStatus = 'idle' | 'connecting' | 'pending_qr' | 'scan_qr' | 'connected' | 'error'

interface QrScannerProps {
  businessId: string
  onConnected?: () => void
}

export default function QrScanner({ businessId, onConnected }: QrScannerProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const connectedCalledRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  // Poll for QR code
  const pollQr = useCallback(async (session: string) => {
    if (!mountedRef.current) return

    try {
      const res = await fetch(`/api/waha/qr?session=${encodeURIComponent(session)}`)
      const data = await res.json()

      if (!mountedRef.current) return

      if (data.status === 'connected') {
        setStatus('connected')
        setQrImage(null)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        if (!connectedCalledRef.current) {
          connectedCalledRef.current = true
          onConnected?.()
        }
        return
      }

      if (data.status === 'scan_qr' && data.qr) {
        setStatus('scan_qr')
        setQrImage(data.qr)
        setError(null)
        return
      }

      if (data.status === 'NOT_FOUND') {
        // Session not found — stop polling, user needs to click connect again
        setStatus('error')
        setError('Session not found. Please try connecting again.')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        return
      }

      // Still starting up — keep polling
      setStatus('pending_qr')
    } catch {
      if (!mountedRef.current) return
      // Network error — keep polling, don't break the flow
    }
  }, [onConnected])

  // Start polling
  const startPolling = useCallback((session: string) => {
    // Clear any existing interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    // Initial poll immediately
    pollQr(session)

    // Then every 5 seconds
    pollingRef.current = setInterval(() => {
      pollQr(session)
    }, 5000)
  }, [pollQr])

  // Connect WhatsApp — creates session and starts polling
  const handleConnect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    setQrImage(null)
    connectedCalledRef.current = false

    try {
      const res = await fetch('/api/waha/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to connect')
        setStatus('error')
        return
      }

      if (!mountedRef.current) return

      setSessionName(data.sessionName)

      if (data.status === 'connected') {
        setStatus('connected')
        if (!connectedCalledRef.current) {
          connectedCalledRef.current = true
          onConnected?.()
        }
        return
      }

      setStatus('pending_qr')
      startPolling(data.sessionName)
    } catch {
      if (!mountedRef.current) return
      setError('שגיאה בהתחברות לשרת')
      setStatus('error')
    }
  }, [onConnected, startPolling])

  // Auto-connect on mount
  useEffect(() => {
    if (businessId) {
      handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-text">חיבור וואטסאפ</h3>
        <p className="text-sm text-text-secondary mt-1">
          סרוק את קוד ה-QR באפליקציית וואטסאפ שלך
        </p>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            status === 'connected'
              ? 'bg-success'
              : status === 'scan_qr'
                ? 'bg-warning animate-pulse'
                : status === 'error'
                  ? 'bg-danger'
                  : status === 'connecting' || status === 'pending_qr'
                    ? 'bg-warning animate-pulse'
                    : 'bg-text-muted'
          }`}
        />
        <span className="text-sm text-text-secondary">
          {status === 'connected' && 'מחובר!'}
          {status === 'scan_qr' && 'ממתין לסריקה...'}
          {status === 'connecting' && 'מתחבר...'}
          {status === 'pending_qr' && 'טוען קוד QR...'}
          {status === 'idle' && 'לא מחובר'}
          {status === 'error' && 'שגיאה בחיבור'}
        </span>
      </div>

      {/* Connected state */}
      {status === 'connected' && (
        <div className="bg-success-bg border border-success/20 rounded-[var(--radius-card)] p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-success font-semibold">הוואטסאפ מחובר בהצלחה!</p>
          <p className="text-sm text-text-secondary">אפשר להמשיך לשלב הבא</p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="bg-danger-bg border border-danger/20 rounded-[var(--radius-card)] p-8 text-center space-y-3">
          <p className="text-danger text-sm">{error || 'שגיאה בחיבור'}</p>
          <button
            type="button"
            onClick={handleConnect}
            className="px-4 py-2 rounded-[var(--radius-button)] bg-white border border-border text-text text-sm font-medium hover:bg-surface transition-colors"
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* QR / Loading state */}
      {(status === 'connecting' || status === 'pending_qr' || status === 'scan_qr') && (
        <div className="bg-white border border-border rounded-[var(--radius-card)] p-6 flex flex-col items-center space-y-4">
          {status === 'scan_qr' && qrImage ? (
            <div className="bg-white p-4 rounded-xl">
              <img
                src={qrImage}
                alt="QR Code for WhatsApp"
                className="w-64 h-64 object-contain"
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-surface rounded-xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-text-muted">
                <svg
                  className="w-8 h-8 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">
                  {status === 'connecting' ? 'מתחבר...' : 'טוען קוד QR...'}
                </span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-center space-y-2 max-w-xs">
            <p className="text-sm text-text-secondary font-medium">איך מתחברים?</p>
            <ol className="text-xs text-text-muted space-y-1 text-start">
              <li>1. פתח WhatsApp בטלפון</li>
              <li>2. הגדרות &rarr; מכשירים מקושרים</li>
              <li>3. לחץ &quot;קשר מכשיר&quot;</li>
              <li>4. סרוק את הקוד שמוצג כאן</li>
            </ol>
          </div>

          {/* Auto-refresh notice */}
          <p className="text-xs text-text-muted">
            הקוד מתרענן אוטומטית כל 5 שניות
          </p>
        </div>
      )}

      {/* Idle state — show connect button */}
      {status === 'idle' && (
        <div className="flex flex-col items-center gap-4 p-8">
          <button
            type="button"
            onClick={handleConnect}
            className="px-6 py-3 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            חבר WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}

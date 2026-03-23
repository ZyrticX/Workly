'use client'

import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
  isBotActive: boolean
  onMessageSent?: () => void
}

/**
 * Message input bar for the chat view.
 * Text input + send button. Disabled when the AI bot is active.
 */
export function MessageInput({ conversationId, isBotActive, onMessageSent }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showError = useCallback((msg: string) => {
    setSendError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setSendError(null), 3000)
  }, [])

  const handleSend = useCallback(async () => {
    const text = content.trim()
    if (!text || sending) return

    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content: text }),
      })

      if (res.ok) {
        setContent('')
        onMessageSent?.()

        // Re-focus input after sending
        requestAnimationFrame(() => {
          inputRef.current?.focus()
        })
      } else {
        showError('שליחת ההודעה נכשלה. נסה שוב.')
      }
    } catch {
      showError('שגיאת רשת. בדוק את החיבור ונסה שוב.')
    } finally {
      setSending(false)
    }
  }, [content, conversationId, sending, onMessageSent, showError])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (without Shift). Shift+Enter = newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // When bot is active, show an indicator instead of input
  if (isBotActive) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50/60 backdrop-blur-sm border-t border-blue-100/30">
        <div className="h-2 w-2 rounded-full bg-[#3B7DD8] animate-pulse" />
        <span className="text-sm text-[#3B7DD8] font-medium">
          AI פעיל — הבוט עונה אוטומטית
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col glass-strong border-t-0">
      {sendError && (
        <div
          dir="rtl"
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/80"
        >
          {sendError}
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-2">
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="הקלד הודעה..."
        dir="rtl"
        rows={1}
        disabled={sending}
        className="
          flex-1 resize-none rounded-2xl border border-gray-200/50 bg-white/80
          px-4 py-2.5 text-base text-[#1B2E24] placeholder-[#8FA89A]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50
          disabled:opacity-50
          max-h-32 leading-relaxed transition-ios
        "
        style={{
          // Auto-grow textarea
          height: 'auto',
          minHeight: '40px',
        }}
        onInput={(e) => {
          const target = e.currentTarget
          target.style.height = 'auto'
          target.style.height = `${Math.min(target.scrollHeight, 128)}px`
        }}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={!content.trim() || sending}
        aria-label="שלח הודעה"
        className="
          flex h-11 w-11 shrink-0 items-center justify-center rounded-xl min-h-[44px] min-w-[44px]
          bg-[var(--color-primary)] text-white shadow-ios
          transition-ios press-effect
          hover:bg-[var(--color-primary-dark)]
          disabled:bg-[#E8EFE9] disabled:text-[#8FA89A] disabled:cursor-not-allowed disabled:shadow-none
        "
      >
        {sending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Send size={18} className="rtl:-scale-x-100" />
        )}
      </button>
      </div>
    </div>
  )
}

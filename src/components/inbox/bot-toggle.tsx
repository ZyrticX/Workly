'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BotToggleProps {
  conversationId: string
  initialActive: boolean
  onToggle?: (active: boolean) => void
}

/**
 * Toggle switch to enable/disable the AI bot for a specific conversation.
 * Green when active. Shows a confirmation dialog before disabling.
 */
export function BotToggle({ conversationId, initialActive, onToggle }: BotToggleProps) {
  const [active, setActive] = useState(initialActive)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleToggle = useCallback(async () => {
    const newValue = !active

    // Confirmation before disabling the bot
    if (active) {
      const confirmed = window.confirm(
        'האם לכבות את הבוט האוטומטי לשיחה זו?\nתצטרך לענות ידנית על הודעות.'
      )
      if (!confirmed) return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_bot_active: newValue })
        .eq('id', conversationId)

      if (!error) {
        setActive(newValue)
        onToggle?.(newValue)
      }
    } catch {
      // Silently fail — state stays the same
    } finally {
      setLoading(false)
    }
  }, [active, conversationId, supabase, onToggle])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'AI בוט פעיל — לחץ לכיבוי' : 'AI בוט כבוי — לחץ להפעלה'}
      disabled={loading}
      onClick={handleToggle}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full py-[10px] box-content
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${active ? 'bg-[var(--color-primary)]' : 'bg-[#E8EFE9]'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
          ring-0 transition-transform duration-200 ease-in-out
          ${active ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'}
        `}
      />
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </span>
      )}
    </button>
  )
}

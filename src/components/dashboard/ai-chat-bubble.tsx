'use client'

import { cn } from '@/lib/utils/cn'
import { Bot, User } from 'lucide-react'

// ── Types ──────────────────────────────────────────────

export interface ChatAction {
  label: string
  action: string
  params?: Record<string, unknown>
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  table?: TableData | null
  actions?: ChatAction[]
  created_at: string
}

// ── Typing Indicator ───────────────────────────────────

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 px-4 py-2 animate-page-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
        <Bot className="h-4 w-4 text-[var(--color-primary)]" />
      </div>
      <div className="glass-card rounded-2xl rounded-ts-sm px-4 py-3 shadow-ios">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]/60 animate-[typing-dot_1.4s_ease-in-out_infinite]" />
          <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]/60 animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]/60 animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  )
}

// ── Chat Bubble ────────────────────────────────────────

export function AIChatBubble({
  message,
  onAction,
}: {
  message: AIChatMessage
  onAction?: (action: ChatAction) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-4 py-1.5',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-gray-100' : 'bg-[var(--color-primary)]/10'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-gray-500" />
        ) : (
          <Bot className="h-4 w-4 text-[var(--color-primary)]" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[85%] lg:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm overflow-hidden',
          isUser
            ? 'rounded-te-sm bg-[var(--color-primary)] text-white'
            : 'rounded-ts-sm bg-white border border-gray-100 text-gray-800'
        )}
      >
        {/* Text content */}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.content}</p>

        {/* Table data */}
        {message.table && message.table.headers.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F7FAF8]">
                  {message.table.headers.map((header, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap px-3 py-2 text-start font-semibold text-gray-600"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.table.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={cn(
                      'border-t border-gray-100',
                      rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    )}
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="whitespace-nowrap px-3 py-1.5 text-start text-gray-700"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onAction?.(act)}
                className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 transition-colors"
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            'mt-1 text-[10px]',
            isUser ? 'text-white/70' : 'text-gray-400'
          )}
        >
          {new Date(message.created_at).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils/cn'

export interface ChatBubbleProps {
  content: string
  direction: 'inbound' | 'outbound'
  senderType: 'customer' | 'agent' | 'ai'
  time: string
}

/**
 * Format a timestamp string to HH:MM in Hebrew locale (24h).
 */
function formatTime(isoOrTime: string): string {
  try {
    const date = new Date(isoOrTime)
    if (isNaN(date.getTime())) return isoOrTime
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoOrTime
  }
}

/**
 * WhatsApp-style chat bubble.
 *
 * RTL layout:
 *   - Inbound (customer) messages: aligned to the right (start in RTL) with gray bg.
 *   - Outbound messages: aligned to the left (end in RTL).
 *     - Agent outbound: WhatsApp green bg.
 *     - AI outbound: soft blue bg.
 *
 * The tail effect is achieved with asymmetric border-radius:
 *   - Inbound: small bottom-left radius (appears bottom-right visually in RTL).
 *   - Outbound: small bottom-right radius (appears bottom-left visually in RTL).
 */
export function ChatBubble({ content, direction, senderType, time }: ChatBubbleProps) {
  const isInbound = direction === 'inbound'

  const bubbleBg = isInbound
    ? 'glass-card'                             // glass effect for inbound
    : senderType === 'ai'
      ? 'bg-blue-50/60 backdrop-blur-sm border border-blue-100/30'  // glass blue for AI
      : 'bg-[#DCF8C6] shadow-ios'             // WhatsApp green with shadow for agent

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 max-w-[85%] lg:max-w-[75%] overflow-hidden',
        isInbound ? 'self-end' : 'self-start'
      )}
    >
      {/* Sender label for AI messages */}
      {senderType === 'ai' && direction === 'outbound' && (
        <span className="text-[10px] text-[#3B7DD8] font-medium px-1">
          AI
        </span>
      )}

      <div
        className={cn(
          'px-3 py-2 text-sm leading-relaxed text-[#1B2E24] whitespace-pre-wrap break-words overflow-hidden',
          '[overflow-wrap:anywhere]',
          bubbleBg,
          // WhatsApp-style tail via asymmetric border-radius
          isInbound
            ? 'rounded-2xl rounded-bs-sm'   // tail on bottom-start (visual bottom-right in RTL)
            : 'rounded-2xl rounded-be-sm'   // tail on bottom-end (visual bottom-left in RTL)
        )}
        dir="auto"
      >
        {content}
      </div>

      {/* Timestamp */}
      <span
        className={cn(
          'text-[10px] text-[#8FA89A] px-1',
          isInbound ? 'text-end' : 'text-start'
        )}
      >
        {formatTime(time)}
      </span>
    </div>
  )
}

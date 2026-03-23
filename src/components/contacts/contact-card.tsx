'use client'

import Link from 'next/link'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { StatusBadge } from '@/components/ui/status-badge'
import { ChevronLeft } from 'lucide-react'

export type ContactStatus = 'new' | 'returning' | 'vip' | 'dormant'

export interface ContactCardData {
  id: string
  name: string
  phone: string
  status: ContactStatus
  last_visit?: string | null
  total_revenue?: number
  tags?: string[]
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  new: { label: 'חדש', variant: 'info' },
  returning: { label: 'חוזר', variant: 'success' },
  vip: { label: 'VIP', variant: 'warning' },
  dormant: { label: 'רדום', variant: 'neutral' },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  })
}

interface ContactCardProps {
  contact: ContactCardData
}

export function ContactCard({ contact }: ContactCardProps) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.new

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="block glass-card shadow-ios rounded-2xl p-4 hover:shadow-ios-lg hover:border-[var(--color-primary)]/30 transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <AvatarInitials name={contact.name} size="md" />

        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Badge */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1B2E24] text-base truncate">
              {contact.name}
            </span>
            <StatusBadge variant={statusCfg.variant}>
              {statusCfg.label}
            </StatusBadge>
          </div>

          {/* Row 2: Phone */}
          {contact.phone && (
            <div className="text-sm text-[#6B7B73] mt-1" dir="ltr">
              {contact.phone}
            </div>
          )}

          {/* Row 3: Last visit + Revenue */}
          <div className="flex items-center gap-3 mt-2">
            {contact.last_visit && (
              <span className="text-xs text-[#8FA89A]">
                ביקור אחרון: {formatDate(contact.last_visit)}
              </span>
            )}
            {contact.total_revenue != null && contact.total_revenue > 0 && (
              <span className="text-xs font-medium text-[var(--color-primary)]">
                {formatCurrency(contact.total_revenue)}
              </span>
            )}
          </div>
        </div>

        <ChevronLeft className="w-5 h-5 text-[#8FA89A] shrink-0 mt-1" />
      </div>
    </Link>
  )
}

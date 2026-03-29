'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  MessageSquare,
  CalendarPlus,
  Pencil,
  Phone,
  Loader2,
  DollarSign,
  CalendarDays,
  History,
} from 'lucide-react'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { StatusBadge } from '@/components/ui/status-badge'
import { ContactForm } from './contact-form'
import type { ContactStatus } from './contact-card'

interface ContactData {
  id: string
  name: string
  phone: string
  status: ContactStatus
  tags: string[]
  notes?: string
  birthday?: string
  total_revenue: number
  total_visits: number
  last_visit?: string
  created_at: string
  linked_to?: string
  relationship?: string
}

interface LinkedContact {
  id: string
  name: string
  relationship?: string
  status: string
  total_visits: number
  total_revenue: number
}

interface ParentContact {
  id: string
  name: string
  phone: string
}

interface AppointmentHistoryItem {
  id: string
  service_type: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: string
}

type Tab = 'history' | 'conversations' | 'notes' | 'linked'

const STATUS_VARIANT_MAP: Record<ContactStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  new: 'info',
  returning: 'success',
  vip: 'warning',
  dormant: 'neutral',
}

const STATUS_LABEL_MAP: Record<ContactStatus, string> = {
  new: 'חדש',
  returning: 'חוזר',
  vip: 'VIP',
  dormant: 'רדום',
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'מתוכנן',
  completed: 'הושלם',
  cancelled: 'בוטל',
  no_show: 'לא הגיע',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface ContactDetailProps {
  contactId: string
}

export function ContactDetail({ contactId }: ContactDetailProps) {
  const [contact, setContact] = useState<ContactData | null>(null)
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([])
  const [parentContact, setParentContact] = useState<ParentContact | null>(null)
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const [showEditForm, setShowEditForm] = useState(false)

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts?id=${contactId}`)
      if (res.ok) {
        const data = await res.json()
        setContact(data.contact ?? null)
        setLinkedContacts(data.linkedContacts ?? [])
        setParentContact(data.parentContact ?? null)
      }
    } catch {
      // Silently fail
    }
  }, [contactId])

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments?contactId=${contactId}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments ?? [])
      }
    } catch {
      // Silently fail
    }
  }, [contactId])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchContact(), fetchAppointments()])
      setLoading(false)
    }
    load()
  }, [fetchContact, fetchAppointments])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="bg-white rounded-xl border border-[#E8EFE9] p-12 text-center">
        <div className="text-[#6B7B73] text-sm mb-3">איש הקשר לא נמצא</div>
        <Link href="/contacts" className="text-sm text-[var(--color-primary)] font-medium hover:underline">
          חזור לרשימה
        </Link>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: 'היסטוריית טיפולים' },
    { key: 'conversations', label: 'שיחות' },
    { key: 'notes', label: 'הערות' },
    { key: 'linked', label: `מקושרים (${linkedContacts.length})` },
  ]

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-[#6B7B73] hover:text-[var(--color-primary)] transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לאנשי קשר
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-[#E8EFE9] p-6">
        <div className="flex items-start gap-4">
          <AvatarInitials name={contact.name} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-[#1B2E24]">{contact.name}</h2>
              <StatusBadge variant={STATUS_VARIANT_MAP[contact.status]}>
                {STATUS_LABEL_MAP[contact.status]}
              </StatusBadge>
            </div>

            <div className="flex items-center gap-1 mt-1 text-sm text-[#6B7B73]">
              <Phone className="w-3.5 h-3.5" />
              <span dir="ltr">{contact.phone}</span>
            </div>

            {/* Tags */}
            {contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] text-xs font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-[#F7FAF8] rounded-lg p-3 text-center">
            <CalendarDays className="w-4 h-4 text-[#6B7B73] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#1B2E24]">{contact.total_visits ?? 0}</div>
            <div className="text-xs text-[#6B7B73]">ביקורים</div>
          </div>
          <div className="bg-[#F7FAF8] rounded-lg p-3 text-center">
            <DollarSign className="w-4 h-4 text-[#6B7B73] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#1B2E24]">
              {formatCurrency(contact.total_revenue ?? 0)}
            </div>
            <div className="text-xs text-[#6B7B73]">הכנסה</div>
          </div>
          <div className="bg-[#F7FAF8] rounded-lg p-3 text-center">
            <History className="w-4 h-4 text-[#6B7B73] mx-auto mb-1" />
            <div className="text-sm font-bold text-[#1B2E24]">
              {contact.last_visit ? formatDate(contact.last_visit) : '--'}
            </div>
            <div className="text-xs text-[#6B7B73]">ביקור אחרון</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-5">
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
            <MessageSquare className="w-4 h-4" />
            שלח הודעה
          </button>
          <Link
            href={`/calendar?contact=${contactId}`}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-primary)]/5 transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            קבע תור
          </Link>
          <button
            onClick={() => setShowEditForm(true)}
            className="px-3 py-2.5 border border-[#E8EFE9] text-[#6B7B73] rounded-lg hover:bg-[#F7FAF8] transition-colors"
            aria-label="ערוך"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#E8EFE9] overflow-hidden">
        <div className="flex border-b border-[#E8EFE9]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'text-[#6B7B73] border-transparent hover:text-[#1B2E24]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-sm text-[#6B7B73]">
                  אין היסטוריית טיפולים
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-3 bg-[#F7FAF8] rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#1B2E24]">
                          {apt.service_type}
                        </div>
                        <div className="text-xs text-[#6B7B73] mt-0.5">
                          {formatDate(apt.start_time)} | {new Date(apt.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} | {apt.duration_minutes} דקות
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          apt.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : apt.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : apt.status === 'no_show'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {APPOINTMENT_STATUS_LABELS[apt.status] ?? apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conversations Tab */}
          {activeTab === 'conversations' && (
            <div className="text-center py-8 text-sm text-[#6B7B73]">
              היסטוריית שיחות תוצג כאן
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              {contact.notes ? (
                <div className="bg-[#F7FAF8] rounded-lg p-4 text-sm text-[#1B2E24] whitespace-pre-wrap">
                  {contact.notes}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-[#6B7B73]">
                  אין הערות
                </div>
              )}
            </div>
          )}

          {/* Linked Contacts Tab */}
          {activeTab === 'linked' && (
            <div>
              {/* Parent contact info */}
              {parentContact && (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium mb-1">מקושר/ת ל:</p>
                  <Link href={`/contacts/${parentContact.id}`} className="flex items-center gap-2 hover:bg-blue-100 rounded-lg p-2 -m-2 transition-colors">
                    <AvatarInitials name={parentContact.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-[#1B2E24]">{parentContact.name}</p>
                      <p className="text-xs text-[#6B7B73]">{parentContact.phone}</p>
                    </div>
                  </Link>
                </div>
              )}

              {/* Linked contacts (sub-clients) */}
              {linkedContacts.length > 0 ? (
                <div className="space-y-2">
                  {linkedContacts.map((lc) => (
                    <div key={lc.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#E8EFE9] hover:bg-[#F7FAF8] transition-colors">
                      <AvatarInitials name={lc.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1B2E24]">{lc.name}</p>
                        <p className="text-xs text-[#8FA89A]">
                          {lc.relationship === 'mother' ? 'אמא' :
                           lc.relationship === 'father' ? 'אבא' :
                           lc.relationship === 'friend' ? 'חבר/ה' :
                           lc.relationship === 'spouse' ? 'בן/בת זוג' :
                           lc.relationship === 'child' ? 'ילד/ה' :
                           lc.relationship === 'sibling' ? 'אח/אחות' :
                           lc.relationship || 'מקושר/ת'}
                          {lc.total_visits > 0 && ` · ${lc.total_visits} ביקורים`}
                          {lc.total_revenue > 0 && ` · ${lc.total_revenue} ₪`}
                        </p>
                      </div>
                      <StatusBadge variant={lc.status === 'vip' ? 'warning' : lc.status === 'returning' ? 'success' : 'info'}>
                        {lc.status === 'new' ? 'חדש' : lc.status === 'returning' ? 'חוזר' : lc.status === 'vip' ? 'VIP' : lc.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-[#6B7B73]">
                  אין לקוחות מקושרים
                  <p className="text-xs text-[#8FA89A] mt-1">לקוחות מקושרים נוצרים כשהלקוח מזמין תור לחבר/משפחה</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit form */}
      {showEditForm && (
        <ContactForm
          initialData={{
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            tags: contact.tags,
            notes: contact.notes ?? '',
          }}
          onClose={() => setShowEditForm(false)}
          onSaved={() => {
            setShowEditForm(false)
            fetchContact()
          }}
        />
      )}
    </div>
  )
}

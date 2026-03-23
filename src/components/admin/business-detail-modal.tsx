'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'

interface BusinessPhone {
  id: string
  phone_number: string
  status: string
  session_id: string | null
}

interface BusinessBilling {
  plan: string
  monthly_price: number
  status: string
  next_billing_date: string | null
}

interface BusinessDetail {
  id: string
  name: string
  business_type: string | null
  status: string
  plan: string
  created_at: string
  owner_email: string | null
  phones: BusinessPhone[]
  billing: BusinessBilling | null
  messages_count: number
  contacts_count: number
}

interface BusinessDetailModalProps {
  business: BusinessDetail | null
  open: boolean
  onClose: () => void
}

export function BusinessDetailModal({
  business,
  open,
  onClose,
}: BusinessDetailModalProps) {
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  if (!open || !business) return null

  async function handleAction(action: string, payload?: Record<string, string>) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/business-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: business!.id, action, ...payload }),
        })
        if (res.ok) {
          setActionMessage(`הפעולה "${action}" בוצעה בהצלחה`)
        } else {
          setActionMessage('שגיאה בביצוע הפעולה')
        }
      } catch {
        setActionMessage('שגיאה בביצוע הפעולה')
      }
    })
  }

  const statusColors: Record<string, string> = {
    active: 'bg-success-bg text-success',
    suspended: 'bg-danger-bg text-danger',
    trial: 'bg-warning-bg text-warning',
  }

  const phoneStatusColors: Record<string, string> = {
    connected: 'bg-success-bg text-success',
    disconnected: 'bg-danger-bg text-danger',
    pending_qr: 'bg-warning-bg text-warning',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-text">{business.name}</h2>
            <span
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-lg',
                statusColors[business.status] || 'bg-neutral-bg text-neutral'
              )}
            >
              {business.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-text-muted"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Action message */}
          {actionMessage && (
            <div className="text-sm text-center py-2 px-4 rounded-xl bg-info-bg text-info">
              {actionMessage}
            </div>
          )}

          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">פרטי עסק</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="שם" value={business.name} />
              <InfoRow label="סוג עסק" value={business.business_type || '-'} />
              <InfoRow label="תוכנית" value={business.plan} />
              <InfoRow label="אימייל בעלים" value={business.owner_email || '-'} />
              <InfoRow
                label="תאריך הצטרפות"
                value={new Date(business.created_at).toLocaleDateString('he-IL')}
              />
              <InfoRow label="אנשי קשר" value={String(business.contacts_count)} />
              <InfoRow label="הודעות (חודש)" value={String(business.messages_count)} />
            </div>
          </section>

          {/* Phone Numbers */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">
              מספרי טלפון ({business.phones.length})
            </h3>
            {business.phones.length === 0 ? (
              <p className="text-sm text-text-muted">אין מספרים מחוברים</p>
            ) : (
              <div className="space-y-2">
                {business.phones.map((phone) => (
                  <div
                    key={phone.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-md',
                          phoneStatusColors[phone.status] || 'bg-neutral-bg text-neutral'
                        )}
                      >
                        {phone.status}
                      </span>
                      <span className="text-sm font-medium text-text font-mono">
                        {phone.phone_number}
                      </span>
                    </div>
                    {phone.status === 'disconnected' && (
                      <button
                        onClick={() => handleAction('disconnect_phone', { phoneId: phone.id })}
                        disabled={isPending}
                        className="text-[11px] font-medium text-danger hover:underline disabled:opacity-50"
                      >
                        נתק
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billing */}
          {business.billing && (
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">חיוב</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="תוכנית" value={business.billing.plan} />
                <InfoRow
                  label="מחיר חודשי"
                  value={`₪${business.billing.monthly_price}`}
                />
                <InfoRow label="סטטוס" value={business.billing.status} />
                <InfoRow
                  label="חיוב הבא"
                  value={
                    business.billing.next_billing_date
                      ? new Date(business.billing.next_billing_date).toLocaleDateString('he-IL')
                      : '-'
                  }
                />
              </div>
            </section>
          )}

          {/* Actions */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">פעולות</h3>
            <div className="flex flex-wrap gap-2">
              {business.status === 'active' ? (
                <button
                  onClick={() => handleAction('suspend')}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-danger-bg text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                >
                  השעה עסק
                </button>
              ) : (
                <button
                  onClick={() => handleAction('activate')}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-success-bg text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                >
                  הפעל עסק
                </button>
              )}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAction('change_plan', { newPlan: e.target.value })
                    e.target.value = ''
                  }
                }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-info-bg text-info border-0 cursor-pointer disabled:opacity-50"
                defaultValue=""
              >
                <option value="" disabled>
                  שנה תוכנית...
                </option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
              </select>
              {business.phones.map((phone) => (
                <button
                  key={phone.id}
                  onClick={() => handleAction('disconnect_phone', { phoneId: phone.id })}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-warning-bg text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
                >
                  נתק {phone.phone_number}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-text truncate">{value}</p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Bug, Lightbulb, TrendingUp, StickyNote, Plus, ChevronDown, ChevronUp } from 'lucide-react'

interface Ticket {
  id: string
  user_email: string
  type: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: 'באג', icon: Bug, color: 'bg-red-100 text-red-700' },
  feature: { label: 'פיצ\'ר', icon: Lightbulb, color: 'bg-blue-100 text-blue-700' },
  improvement: { label: 'שיפור', icon: TrendingUp, color: 'bg-green-100 text-green-700' },
  note: { label: 'הערה', icon: StickyNote, color: 'bg-gray-100 text-gray-600' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'נמוך', color: 'bg-gray-100 text-gray-500' },
  normal: { label: 'רגיל', color: 'bg-blue-50 text-blue-600' },
  high: { label: 'גבוה', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'דחוף', color: 'bg-red-100 text-red-600' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'פתוח', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'בטיפול', color: 'bg-blue-100 text-blue-700' },
  done: { label: 'בוצע', color: 'bg-green-100 text-green-700' },
  closed: { label: 'סגור', color: 'bg-gray-100 text-gray-500' },
}

const STATUS_OPTIONS = ['open', 'in_progress', 'done', 'closed']

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'עכשיו'
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`
  if (diff < 172800) return 'אתמול'
  return `לפני ${Math.floor(diff / 86400)} ימים`
}

export function TicketsClient({ tickets: initialTickets }: { tickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'bug', priority: 'normal', title: '', description: '' })

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  async function handleStatusChange(id: string, newStatus: string) {
    const res = await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    if (res.ok) {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ type: 'bug', priority: 'normal', title: '', description: '' })
      window.location.reload()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1B2E24]">טיקטים ומשוב</h2>
          <p className="text-sm text-gray-500">{tickets.length} טיקטים סה״כ</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
        >
          <Plus className="w-4 h-4" />
          טיקט חדש
        </button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#E8EFE9] p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-[#1B2E24]">טיקט חדש</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm"
              >
                <option value="bug">באג 🐛</option>
                <option value="feature">פיצ׳ר 💡</option>
                <option value="improvement">שיפור 📈</option>
                <option value="note">הערה 📝</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm"
              >
                <option value="low">נמוך</option>
                <option value="normal">רגיל</option>
                <option value="high">גבוה</option>
                <option value="urgent">דחוף 🔥</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת *</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="תיאור קצר של הבעיה או הבקשה"
              className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור מפורט</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="פרט את הבעיה, מה ציפית שיקרה, ומה קרה בפועל..."
              rows={4}
              className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.title.trim()}
              className="px-6 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {saving ? 'שומר...' : 'שלח טיקט'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 text-sm text-gray-500 hover:text-gray-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'הכל' },
          { value: 'open', label: 'פתוח' },
          { value: 'in_progress', label: 'בטיפול' },
          { value: 'done', label: 'בוצע' },
          { value: 'closed', label: 'סגור' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm rounded-xl transition-colors ${
              filter === tab.value
                ? 'bg-[#1B2E24] text-white'
                : 'bg-white border border-[#E8EFE9] text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className="ms-1.5 text-xs opacity-70">
                ({tickets.filter(t => t.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>אין טיקטים</p>
          </div>
        ) : (
          filtered.map(ticket => {
            const typeConf = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.note
            const prioConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.normal
            const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
            const TypeIcon = typeConf.icon
            const isExpanded = expandedId === ticket.id

            return (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl border border-[#E8EFE9] p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${typeConf.color}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${prioConf.color}`}>
                        {prioConf.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>

                    <h3 className="font-bold text-[#1B2E24] text-sm">{ticket.title}</h3>

                    {ticket.description && (
                      <p className={`text-xs text-gray-500 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {ticket.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{ticket.user_email}</span>
                      <span>{timeAgo(ticket.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={ticket.status}
                      onChange={e => handleStatusChange(ticket.id, e.target.value)}
                      className="text-xs rounded-lg border border-[#E8EFE9] px-2 py-1.5 bg-white"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>
                          {STATUS_CONFIG[s]?.label || s}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

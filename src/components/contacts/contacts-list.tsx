'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, Plus, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react'
import { ContactCard, type ContactCardData } from './contact-card'
import { ContactForm } from './contact-form'

type StatusFilter = 'all' | 'new' | 'returning' | 'vip' | 'dormant'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'new', label: 'חדש' },
  { value: 'returning', label: 'חוזר' },
  { value: 'vip', label: 'VIP' },
  { value: 'dormant', label: 'רדום' },
]

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'name', label: 'שם' },
  { value: 'created_at_desc', label: 'חדש ביותר' },
  { value: 'revenue', label: 'הכנסה' },
]

export function ContactsList() {
  const [contacts, setContacts] = useState<ContactCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchContacts = useCallback(async (q: string, status: StatusFilter, sortBy: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '20',
        sort: sortBy,
      })
      if (q) params.set('q', q)
      if (status !== 'all') params.set('status', status)

      const res = await fetch(`/api/contacts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts ?? [])
        setTotalPages(data.totalPages ?? 1)
        setTotal(data.total ?? 0)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts(search, statusFilter, sort, page)
  }, [statusFilter, sort, page, fetchContacts]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(() => {
      fetchContacts(value, statusFilter, sort, 1)
    }, 300)
  }

  function handleStatusChange(status: StatusFilter) {
    setStatusFilter(status)
    setPage(1)
  }

  function handleSortChange(sortBy: string) {
    setSort(sortBy)
    setPage(1)
    setShowSortDropdown(false)
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-[#E8EFE9] p-4 space-y-3">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7B73]" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="חפש שם או טלפון..."
              className="w-full ps-10 pe-3 py-2.5 border border-[#E8EFE9] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="p-2.5 border border-[#E8EFE9] rounded-lg hover:bg-[#F7FAF8] transition-colors"
              aria-label="מיון"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#6B7B73]" />
            </button>
            {showSortDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                <div className="absolute end-0 top-full mt-1 bg-white border border-[#E8EFE9] rounded-lg shadow-lg z-20 overflow-hidden min-w-[140px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`w-full text-start px-3 py-2 text-sm hover:bg-[#F7FAF8] transition-colors ${
                        sort === opt.value ? 'text-[var(--color-primary)] font-medium bg-[var(--color-primary)]/5' : 'text-[#1B2E24]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* New contact button */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">חדש</span>
          </button>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
                statusFilter === opt.value
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white text-[#6B7B73] border-[#E8EFE9] hover:border-[var(--color-primary)]/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-[#6B7B73] px-1">
        {total} אנשי קשר
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8EFE9] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
            {search ? (
              <Search className="w-7 h-7 text-[var(--color-primary)]" />
            ) : (
              <Users className="w-7 h-7 text-[var(--color-primary)]" />
            )}
          </div>
          <p className="text-base font-semibold text-[#1B2E24]">
            {search ? 'לא נמצאו תוצאות' : 'אין לקוחות עדיין'}
          </p>
          <p className="mt-2 text-sm text-[#6B7B73] max-w-[280px] mx-auto leading-relaxed">
            {search
              ? 'נסה לחפש עם מילות מפתח אחרות'
              : 'לקוחות חדשים יתווספו אוטומטית כשיפנו בוואטסאפ'}
          </p>
          {!search && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-ios hover:bg-[var(--color-primary-dark)] transition-ios press-effect"
              aria-label="הוסף איש קשר ראשון"
            >
              <Plus className="w-4 h-4" />
              הוסף איש קשר
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-[#E8EFE9] hover:bg-[#F7FAF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="עמוד קודם"
          >
            <ChevronRight className="w-4 h-4 text-[#6B7B73]" />
          </button>
          <span className="text-sm text-[#6B7B73]">
            עמוד {page} מתוך {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-[#E8EFE9] hover:bg-[#F7FAF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="עמוד הבא"
          >
            <ChevronLeft className="w-4 h-4 text-[#6B7B73]" />
          </button>
        </div>
      )}

      {/* New contact form */}
      {showForm && (
        <ContactForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            fetchContacts(search, statusFilter, sort, page)
          }}
        />
      )}
    </div>
  )
}

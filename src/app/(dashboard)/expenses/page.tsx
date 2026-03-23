'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import ExpenseForm from '@/components/dashboard/expense-form'
import {
  Receipt,
  Plus,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronRight,
  ChevronLeft,
  Repeat,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ── Types ──────────────────────────────────────────────

interface Expense {
  id: string
  business_id: string
  category: string
  amount: number
  description: string
  expense_date: string
  receipt_url: string | null
  is_recurring: boolean
  created_at: string
}

interface RecurringExpense {
  id: string
  business_id: string
  category: string
  amount: number
  description: string
  frequency: 'weekly' | 'monthly' | 'yearly'
  is_active: boolean
  created_at: string
}

type TabType = 'one_time' | 'recurring'

// ── Category helpers ───────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'שכירות',
  materials: 'חומרים',
  equipment: 'ציוד',
  marketing: 'שיווק',
  insurance: 'ביטוח',
  taxes: 'מיסים',
  employees: 'עובדים',
  other: 'אחר',
}

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700',
  materials: 'bg-amber-100 text-amber-700',
  equipment: 'bg-purple-100 text-purple-700',
  marketing: 'bg-pink-100 text-pink-700',
  insurance: 'bg-cyan-100 text-cyan-700',
  taxes: 'bg-red-100 text-red-700',
  employees: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-700',
}

const INTERVAL_LABELS: Record<string, string> = {
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Summary Card ───────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: 'green' | 'red' | 'blue'
}) {
  const colorMap = {
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-green-700',
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      value: 'text-red-700',
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      value: 'text-blue-700',
    },
  }

  const c = colorMap[color]

  return (
    <div className={cn('rounded-xl p-4', c.bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', c.icon)} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={cn('text-lg font-bold', c.value)}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────

export default function ExpensesPage() {
  const { businessId, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('one_time')
  const [showForm, setShowForm] = useState(false)

  // Date navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  // Data
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [monthRevenue, setMonthRevenue] = useState(0)

  const monthLabel = new Date(currentMonth.year, currentMonth.month - 1)
    .toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })

  const navigateMonth = (direction: -1 | 1) => {
    setCurrentMonth((prev) => {
      let m = prev.month + direction
      let y = prev.year
      if (m < 1) {
        m = 12
        y--
      } else if (m > 12) {
        m = 1
        y++
      }
      return { year: y, month: m }
    })
  }

  // Load data
  const loadData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const startDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`
    const endDate =
      currentMonth.month === 12
        ? `${currentMonth.year + 1}-01-01`
        : `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`

    try {
      const [expensesResult, recurringResult, revenueResult] = await Promise.all([
        // One-time expenses for the month
        supabase
          .from('expenses')
          .select('*')
          .eq('business_id', businessId)
          .gte('expense_date', startDate)
          .lt('expense_date', endDate)
          .order('expense_date', { ascending: false }),

        // Recurring expenses (all active)
        supabase
          .from('recurring_expenses')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),

        // Revenue for the month (completed appointments)
        supabase
          .from('appointments')
          .select('price')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('start_time', startDate)
          .lt('start_time', endDate),
      ])

      setExpenses((expensesResult.data as Expense[]) || [])
      setRecurringExpenses((recurringResult.data as RecurringExpense[]) || [])

      const revenue =
        revenueResult.data?.reduce((sum, a) => sum + (Number(a.price) || 0), 0) ?? 0
      setMonthRevenue(revenue)
    } catch (err) {
      console.error('Failed to load expenses:', err)
    }

    setLoading(false)
  }, [businessId, currentMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculations
  const totalOneTimeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalRecurringMonthly = recurringExpenses.reduce((sum, e) => {
    if (e.frequency === 'monthly') return sum + e.amount
    if (e.frequency === 'weekly') return sum + e.amount * 4.33
    if (e.frequency === 'yearly') return sum + e.amount / 12
    return sum
  }, 0)
  const totalExpenses = totalOneTimeExpenses + totalRecurringMonthly
  const netProfit = monthRevenue - totalExpenses

  // Group expenses by category
  const groupedExpenses = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const key = e.category || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  if (authLoading || loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F7FAF8]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-full bg-[#F7FAF8]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a href="/" className="flex items-center gap-1 text-sm text-[#5A6E62] hover:text-[#1B2E24] transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            חזרה
          </a>
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
              <Receipt className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">הוצאות</h1>
              <p className="text-xs text-gray-500">ניהול הכנסות והוצאות</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            הוצאה חדשה
          </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 pb-24 space-y-5">
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="הכנסות"
            value={monthRevenue}
            icon={TrendingUp}
            color="green"
          />
          <SummaryCard
            label="הוצאות"
            value={totalExpenses}
            icon={TrendingDown}
            color="red"
          />
          <SummaryCard
            label="רווח נקי"
            value={netProfit}
            icon={Wallet}
            color={netProfit >= 0 ? 'green' : 'red'}
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-white border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setTab('one_time')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
              tab === 'one_time'
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <CreditCard className="h-4 w-4" />
            הוצאות חד-פעמיות
          </button>
          <button
            type="button"
            onClick={() => setTab('recurring')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
              tab === 'recurring'
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Repeat className="h-4 w-4" />
            הוצאות קבועות
          </button>
        </div>

        {/* One-time expenses list */}
        {tab === 'one_time' && (
          <div className="space-y-4">
            {Object.keys(groupedExpenses).length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <Receipt className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">אין הוצאות החודש</p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  הוסף הוצאה ראשונה
                </button>
              </div>
            )}

            {Object.entries(groupedExpenses).map(([category, items]) => {
              const categoryTotal = items.reduce((s, e) => s + e.amount, 0)
              return (
                <div
                  key={category}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          CATEGORY_COLORS[category] || CATEGORY_COLORS.other
                        )}
                      >
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {items.length} הוצאות
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {formatCurrency(categoryTotal)}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div>
                          <p className="text-sm text-gray-800">
                            {expense.description}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(expense.expense_date).toLocaleDateString('he-IL')}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-red-600">
                          -{formatCurrency(expense.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Recurring expenses list */}
        {tab === 'recurring' && (
          <div className="space-y-2">
            {recurringExpenses.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <Repeat className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">אין הוצאות קבועות</p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  הוסף הוצאה קבועה
                </button>
              </div>
            )}

            {recurringExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7FAF8]">
                    <Repeat className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {expense.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          CATEGORY_COLORS[expense.category] ||
                            CATEGORY_COLORS.other
                        )}
                      >
                        {CATEGORY_LABELS[expense.category] || expense.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {INTERVAL_LABELS[expense.frequency]}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
            ))}

            {recurringExpenses.length > 0 && (
              <div className="rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 px-4 py-3 text-center">
                <p className="text-xs text-gray-500">סה&quot;כ הוצאות קבועות חודשיות</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(totalRecurringMonthly)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expense form modal */}
      {showForm && (
        <ExpenseForm
          onClose={() => setShowForm(false)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

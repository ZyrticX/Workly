'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  BarChart3,
  TrendingUp,
  Users,
  CalendarX,
  Clock,
  Target,
  Sparkles,
  Loader2,
  Plus,
  X,
  Wallet,
  ChevronRight,
  ChevronLeft,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ── Types ──────────────────────────────────────────────

interface KPIData {
  monthRevenue: number
  netProfit: number
  cancellationRate: number
  newClients: number
  utilization: number // percentage of booked hours vs available
  revenueTrend: number | null // % change from previous month
}

interface MonthSummary {
  totalAppts: number
  completedAppts: number
  cancelledAppts: number
  avgRevenue: number
  topService: string | null
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

interface Goal {
  id: string
  metric: string
  target: number
  current: number
  period: 'weekly' | 'monthly' | 'quarterly'
  label: string
}

interface AIInsight {
  id: string
  text: string
  type: 'tip' | 'warning' | 'positive'
}

// ── Metric Card ────────────────────────────────────────

function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  trend,
}: {
  label: string
  value: string | number
  suffix?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend?: { value: number; positive: boolean }
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              trend.positive
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            )}
          >
            {trend.positive ? '+' : ''}
            {trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        {suffix && <span className="text-sm font-normal text-gray-400 me-1">{suffix}</span>}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// ── Goal Progress ──────────────────────────────────────

function GoalProgress({ goal }: { goal: Goal }) {
  const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0
  const periodLabels: Record<string, string> = {
    weekly: 'שבועי',
    monthly: 'חודשי',
    quarterly: 'רבעוני',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{goal.label}</p>
          <p className="text-xs text-gray-400">יעד {periodLabels[goal.period]}</p>
        </div>
        <span className="text-sm font-bold text-gray-700">
          {goal.current} / {goal.target}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct >= 100
              ? 'bg-green-500'
              : pct >= 70
                ? 'bg-[var(--color-primary)]'
                : pct >= 40
                  ? 'bg-amber-400'
                  : 'bg-red-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-400 text-end" dir="ltr">
        {pct.toFixed(0)}%
      </p>
    </div>
  )
}

// ── Set Goal Modal ─────────────────────────────────────

const METRIC_OPTIONS = [
  { value: 'revenue', label: 'הכנסה חודשית (₪)' },
  { value: 'clients', label: 'לקוחות חדשים' },
  { value: 'appointments', label: 'מספר תורים' },
  { value: 'utilization', label: 'ניצולת (%)' },
  { value: 'cancellation_rate', label: 'שיעור ביטולים מקסימלי (%)' },
]

function SetGoalModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (goal: { metric: string; target: number; period: string; label: string }) => void
}) {
  const [metric, setMetric] = useState('revenue')
  const [target, setTarget] = useState<number>(0)
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')

  const selectedLabel =
    METRIC_OPTIONS.find((m) => m.value === metric)?.label || metric

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        dir="rtl"
        className="relative w-full max-w-sm mx-4 rounded-2xl bg-white shadow-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">הגדר יעד חדש</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            מדד
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base bg-white min-h-[48px]"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            יעד
          </label>
          <input
            type="number"
            value={target || ''}
            onChange={(e) => setTarget(Number(e.target.value))}
            min={0}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base min-h-[48px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            תקופה
          </label>
          <div className="flex gap-2">
            {([
              { value: 'weekly', label: 'שבועי' },
              { value: 'monthly', label: 'חודשי' },
              { value: 'quarterly', label: 'רבעוני' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-xs font-medium transition-all min-h-[44px]',
                  period === opt.value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onSave({ metric, target, period, label: selectedLabel })
          }
          disabled={target <= 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Target className="h-4 w-4" />
          שמור יעד
        </button>
      </div>
    </div>
  )
}

// ── AI Insight Card ────────────────────────────────────

function InsightCard({ insight }: { insight: AIInsight }) {
  const typeStyles: Record<string, string> = {
    tip: 'border-blue-200 bg-blue-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    positive: 'border-green-200 bg-green-50/50',
  }
  const iconStyles: Record<string, string> = {
    tip: 'text-blue-500',
    warning: 'text-amber-500',
    positive: 'text-green-500',
  }

  return (
    <div className={cn('rounded-xl border p-3', typeStyles[insight.type])}>
      <div className="flex items-start gap-2">
        <Sparkles className={cn('mt-0.5 h-4 w-4 shrink-0', iconStyles[insight.type])} />
        <p className="text-sm text-gray-700 leading-relaxed">{insight.text}</p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────

export default function KPIsPage() {
  const { businessId, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<KPIData>({
    monthRevenue: 0,
    netProfit: 0,
    cancellationRate: 0,
    newClients: 0,
    utilization: 0,
    revenueTrend: null,
  })
  const [summary, setSummary] = useState<MonthSummary>({
    totalAppts: 0, completedAppts: 0, cancelledAppts: 0, avgRevenue: 0, topService: null,
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [goals, setGoals] = useState<Goal[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [loadingInsights, setLoadingInsights] = useState(false)

  const now = new Date()
  const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth()

  const goToPrevMonth = () => {
    setSelectedMonth(prev => prev.month === 0
      ? { year: prev.year - 1, month: 11 }
      : { ...prev, month: prev.month - 1 })
  }
  const goToNextMonth = () => {
    if (isCurrentMonth) return
    setSelectedMonth(prev => prev.month === 11
      ? { year: prev.year + 1, month: 0 }
      : { ...prev, month: prev.month + 1 })
  }

  // Load KPIs
  const loadKPIs = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const startOfMonth = new Date(selectedMonth.year, selectedMonth.month, 1).toISOString()
    const endOfMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 1).toISOString()
    const prevStart = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toISOString()
    const prevEnd = startOfMonth
    const startOfMonthDate = startOfMonth.split('T')[0]
    const endOfMonthDate = endOfMonth.split('T')[0]

    try {
      const [
        revenueResult,
        expensesResult,
        cancellationsResult,
        newClientsResult,
        totalApptsResult,
        goalsResult,
        prevRevenueResult,
        serviceBreakdownResult,
      ] = await Promise.all([
        // Revenue (selected month)
        supabase
          .from('appointments')
          .select('price')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('start_time', startOfMonth)
          .lt('start_time', endOfMonth),

        // Expenses (selected month)
        supabase
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId)
          .gte('expense_date', startOfMonthDate)
          .lt('expense_date', endOfMonthDate),

        // All appointments this month (for cancellation rate + summary)
        supabase
          .from('appointments')
          .select('status')
          .eq('business_id', businessId)
          .gte('start_time', startOfMonth)
          .lt('start_time', endOfMonth),

        // New clients this month
        supabase
          .from('contacts')
          .select('id', { count: 'exact' })
          .eq('business_id', businessId)
          .gte('created_at', startOfMonth)
          .lt('created_at', endOfMonth),

        // Total appointments this month (for utilization)
        supabase
          .from('appointments')
          .select('duration_minutes')
          .eq('business_id', businessId)
          .neq('status', 'cancelled')
          .gte('start_time', startOfMonth)
          .lt('start_time', endOfMonth),

        // Goals
        supabase
          .from('business_goals')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),

        // Previous month revenue (for trend)
        supabase
          .from('appointments')
          .select('price')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('start_time', prevStart)
          .lt('start_time', prevEnd),

        // Service breakdown (for top service)
        supabase
          .from('appointments')
          .select('service_type')
          .eq('business_id', businessId)
          .neq('status', 'cancelled')
          .gte('start_time', startOfMonth)
          .lt('start_time', endOfMonth),
      ])

      const revenue =
        revenueResult.data?.reduce((s, a) => s + (Number(a.price) || 0), 0) ?? 0
      const totalExpenses =
        expensesResult.data?.reduce((s, e) => s + (Number(e.amount) || 0), 0) ?? 0
      const prevRevenue =
        prevRevenueResult.data?.reduce((s, a) => s + (Number(a.price) || 0), 0) ?? 0

      const totalAppts = cancellationsResult.data?.length ?? 0
      const cancelledAppts =
        cancellationsResult.data?.filter((a) => a.status === 'cancelled').length ?? 0
      const completedAppts =
        cancellationsResult.data?.filter((a) => a.status === 'completed').length ?? 0
      const cancellationRate =
        totalAppts > 0 ? (cancelledAppts / totalAppts) * 100 : 0

      // Utilization: booked minutes / available minutes (assuming 8h * 22 work days)
      const bookedMinutes =
        totalApptsResult.data?.reduce(
          (s, a) => s + (Number(a.duration_minutes) || 0),
          0
        ) ?? 0
      const availableMinutes = 8 * 60 * 22
      const utilization =
        availableMinutes > 0
          ? Math.min((bookedMinutes / availableMinutes) * 100, 100)
          : 0

      // Revenue trend
      const revenueTrend = prevRevenue > 0
        ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
        : null

      // Top service
      const serviceCounts: Record<string, number> = {}
      serviceBreakdownResult.data?.forEach(a => {
        const svc = (a.service_type as string) || 'אחר'
        serviceCounts[svc] = (serviceCounts[svc] || 0) + 1
      })
      const topService = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null

      setKpis({
        monthRevenue: revenue,
        netProfit: revenue - totalExpenses,
        cancellationRate,
        newClients: newClientsResult.count ?? 0,
        utilization,
        revenueTrend,
      })

      setSummary({
        totalAppts,
        completedAppts,
        cancelledAppts,
        avgRevenue: completedAppts > 0 ? Math.round(revenue / completedAppts) : 0,
        topService,
      })

      // Map goals with current values
      if (goalsResult.data) {
        setGoals(
          goalsResult.data.map((g) => {
            let current = 0
            switch (g.metric) {
              case 'revenue':
                current = revenue
                break
              case 'clients':
                current = newClientsResult.count ?? 0
                break
              case 'appointments':
                current = totalAppts - cancelledAppts
                break
              case 'utilization':
                current = utilization
                break
              case 'cancellation_rate':
                current = cancellationRate
                break
            }
            return {
              id: g.id,
              metric: g.metric,
              target: g.target,
              current,
              period: g.period,
              label: g.label || g.metric,
            }
          })
        )
      }
    } catch (err) {
      console.error('Failed to load KPIs:', err)
    }

    setLoading(false)
  }, [businessId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadKPIs()
  }, [loadKPIs])

  // Load AI insights
  const loadInsights = useCallback(async () => {
    if (!businessId) return
    setLoadingInsights(true)

    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, kpis }),
      })

      if (res.ok) {
        const data = await res.json()
        setInsights(
          (data.insights || []).map((text: string, i: number) => ({
            id: `insight-${i}`,
            text,
            type: i === 0 ? 'positive' : i === 1 ? 'tip' : 'warning',
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load insights:', err)
    }

    setLoadingInsights(false)
  }, [businessId, kpis])

  useEffect(() => {
    if (!loading && businessId) {
      loadInsights()
    }
  }, [loading, businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save goal
  const handleSaveGoal = async (goal: {
    metric: string
    target: number
    period: string
    label: string
  }) => {
    if (!businessId) return

    try {
      await supabase.from('business_goals').insert({
        business_id: businessId,
        metric: goal.metric,
        target: goal.target,
        period: goal.period,
        label: goal.label,
      })

      setShowGoalModal(false)
      loadKPIs()
    } catch (err) {
      console.error('Failed to save goal:', err)
    }
  }

  // Currency formatter
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

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
                <BarChart3 className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">מדדים ויעדים</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                disabled={isCurrentMonth}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 pb-24 space-y-6">
        {/* KPI Metric Cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">מדדים עיקריים</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="הכנסה חודשית"
              value={formatCurrency(kpis.monthRevenue)}
              icon={TrendingUp}
              color="bg-green-100 text-green-600"
              trend={kpis.revenueTrend !== null ? { value: kpis.revenueTrend, positive: kpis.revenueTrend >= 0 } : undefined}
            />
            <MetricCard
              label="רווח נקי"
              value={formatCurrency(kpis.netProfit)}
              icon={Wallet}
              color={
                kpis.netProfit >= 0
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600'
              }
            />
            <MetricCard
              label="שיעור ביטולים"
              value={kpis.cancellationRate.toFixed(1)}
              suffix="%"
              icon={CalendarX}
              color={
                kpis.cancellationRate <= 10
                  ? 'bg-green-100 text-green-600'
                  : kpis.cancellationRate <= 25
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-red-100 text-red-600'
              }
            />
            <MetricCard
              label="לקוחות חדשים (שבועי)"
              value={kpis.newClients}
              icon={Users}
              color="bg-blue-100 text-blue-600"
            />
            <div className="col-span-2">
              <MetricCard
                label="ניצולת יומן"
                value={kpis.utilization.toFixed(0)}
                suffix="%"
                icon={Clock}
                color="bg-purple-100 text-purple-600"
              />
            </div>
          </div>
        </section>

        {/* Monthly Summary */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">
            <Calendar className="inline h-4 w-4 ms-1" />
            סיכום {HEBREW_MONTHS[selectedMonth.month]}
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{summary.totalAppts}</p>
                <p className="text-[11px] text-gray-500">סה״כ תורים</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{summary.completedAppts}</p>
                <p className="text-[11px] text-gray-500">הושלמו</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">{summary.cancelledAppts}</p>
                <p className="text-[11px] text-gray-500">בוטלו</p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">ממוצע לתור</span>
              <span className="font-semibold text-gray-800">{formatCurrency(summary.avgRevenue)}</span>
            </div>
            {summary.topService && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">שירות מוביל</span>
                <span className="font-semibold text-gray-800">{summary.topService}</span>
              </div>
            )}
          </div>
        </section>

        {/* Personal Goals */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">יעדים אישיים</h2>
            <button
              type="button"
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
            >
              <Plus className="h-3.5 w-3.5" />
              יעד חדש
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-10 text-center">
              <Target className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">עוד לא הגדרת יעדים</p>
              <button
                type="button"
                onClick={() => setShowGoalModal(true)}
                className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                הגדר יעד ראשון
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {goals.map((goal) => (
                <GoalProgress key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </section>

        {/* AI Insights */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">
              <Sparkles className="inline h-4 w-4 text-[var(--color-primary)] ms-1" />
              תובנות AI
            </h2>
            {loadingInsights && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>

          {!loadingInsights && insights.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">
                ה-AI מנתח את הנתונים שלך...
              </p>
            </div>
          )}

          <div className="space-y-2">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      </div>

      {/* Goal modal */}
      {showGoalModal && (
        <SetGoalModal
          onClose={() => setShowGoalModal(false)}
          onSave={handleSaveGoal}
        />
      )}
    </div>
  )
}

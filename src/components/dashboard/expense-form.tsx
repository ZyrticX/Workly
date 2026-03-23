'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, type ExpenseInput } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  Receipt,
  Calendar,
  Repeat,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ── Types ──────────────────────────────────────────────

interface ExpenseFormProps {
  onClose: () => void
  onSaved: () => void
}

const CATEGORIES = [
  { value: 'rent', label: 'שכירות' },
  { value: 'materials', label: 'חומרים' },
  { value: 'equipment', label: 'ציוד' },
  { value: 'marketing', label: 'שיווק' },
  { value: 'insurance', label: 'ביטוח' },
  { value: 'taxes', label: 'מיסים' },
  { value: 'employees', label: 'עובדים' },
  { value: 'other', label: 'אחר' },
]

// ── Component ──────────────────────────────────────────

export default function ExpenseForm({ onClose, onSaved }: ExpenseFormProps) {
  const { businessId } = useAuth()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: undefined,
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      receiptUrl: '',
      isRecurring: false,
    },
  })

  // Handle receipt photo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)

    const reader = new FileReader()
    reader.onload = (ev) => {
      setReceiptPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile || !businessId) return null

    const ext = receiptFile.name.split('.').pop()
    const path = `receipts/${businessId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, receiptFile)

    if (error) {
      console.error('Receipt upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(path)

    return urlData.publicUrl
  }

  // Submit
  const onSubmit = async (data: ExpenseInput) => {
    if (!businessId) return
    setSaving(true)

    try {
      // Upload receipt if provided
      let receiptUrl = data.receiptUrl || null
      if (receiptFile) {
        receiptUrl = await uploadReceipt()
      }

      if (isRecurring) {
        // Insert as recurring expense
        await supabase.from('recurring_expenses').insert({
          business_id: businessId,
          category: data.category,
          amount: data.amount,
          description: data.description,
          frequency: recurringInterval,
          is_active: true,
        })
      } else {
        // Insert as one-time expense
        await supabase.from('expenses').insert({
          business_id: businessId,
          category: data.category,
          amount: data.amount,
          description: data.description,
          expense_date: data.date,
          receipt_url: receiptUrl,
        })
      }

      setSaved(true)
      setTimeout(() => {
        onSaved()
        onClose()
      }, 800)
    } catch (err) {
      console.error('Failed to save expense:', err)
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        dir="rtl"
        className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom,24px)]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-bold text-gray-900">הוצאה חדשה</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור טופס הוצאה"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              קטגוריה
            </label>
            <select
              {...register('category')}
              aria-label="בחר קטגוריה"
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-base bg-white transition-ios min-h-[48px]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
                errors.category ? 'border-red-400' : 'border-gray-200'
              )}
            >
              <option value="">בחר קטגוריה</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              סכום
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                className={cn(
                  'w-full rounded-xl border pe-8 ps-3 py-2.5 text-base transition-ios min-h-[48px]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
                  errors.amount ? 'border-red-400' : 'border-gray-200'
                )}
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                &#x20AA;
              </span>
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              תיאור
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder="למשל: קניית חומרים לסלון"
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-base transition-ios min-h-[48px]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
                errors.description ? 'border-red-400' : 'border-gray-200'
              )}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              <Calendar className="inline h-4 w-4 ms-1" />
              תאריך
            </label>
            <input
              type="date"
              {...register('date')}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-base transition-ios min-h-[48px]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
                errors.date ? 'border-red-400' : 'border-gray-200'
              )}
            />
            {errors.date && (
              <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>
            )}
          </div>

          {/* Receipt upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              צילום קבלה (אופציונלי)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="קבלה"
                  className="h-32 w-full rounded-lg border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null)
                    setReceiptPreview(null)
                  }}
                  aria-label="הסר צילום קבלה"
                  className="absolute top-2 end-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow min-h-[44px] min-w-[44px]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="העלה צילום קבלה"
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-6 text-sm text-gray-400 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-colors min-h-[44px]"
              >
                <Upload className="h-5 w-5" />
                לחץ להעלאת תמונה
              </button>
            )}
          </div>

          {/* Recurring toggle */}
          <div className="rounded-lg border border-gray-100 bg-[#F7FAF8] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  הוצאה חוזרת
                </span>
              </div>
              <label className="relative inline-flex cursor-pointer items-center min-h-[44px]">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
              </label>
            </div>

            {isRecurring && (
              <div className="mt-3 flex gap-2">
                {([
                  { value: 'weekly', label: 'שבועי' },
                  { value: 'monthly', label: 'חודשי' },
                  { value: 'yearly', label: 'שנתי' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecurringInterval(opt.value)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all min-h-[44px]',
                      recurringInterval === opt.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || saved}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all',
              saved
                ? 'bg-green-500'
                : saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-[0.98]'
            )}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : null}
            {saving ? 'שומר...' : saved ? 'נשמר!' : 'שמור הוצאה'}
          </button>
        </form>
      </div>
    </div>
  )
}

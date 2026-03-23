'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactSchema, type ContactInput } from '@/lib/validations'
import { X, Loader2, Plus } from 'lucide-react'
import { useToastContext } from '@/components/ui/toast'

interface ContactFormProps {
  initialData?: Partial<ContactInput> & { id?: string }
  onClose: () => void
  onSaved: () => void
}

export function ContactForm({ initialData, onClose, onSaved }: ContactFormProps) {
  const { toast } = useToastContext()
  const isEdit = Boolean(initialData?.id)
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      phone: initialData?.phone ?? '',
      notes: initialData?.notes ?? '',
      tags: initialData?.tags ?? [],
    },
  })

  function addTag() {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  async function onSubmit(data: ContactInput) {
    setSubmitting(true)
    setServerError('')

    const payload = { ...data, tags }

    try {
      const url = isEdit ? `/api/contacts?id=${initialData!.id}` : '/api/contacts'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast(isEdit ? 'איש הקשר עודכן בהצלחה' : 'איש קשר חדש נוצר בהצלחה', 'success')
        onSaved()
      } else {
        const result = await res.json()
        const errMsg = result.error ?? 'שגיאה בשמירת איש הקשר'
        setServerError(errMsg)
        toast(errMsg, 'error')
      }
    } catch {
      setServerError('שגיאה בחיבור לשרת')
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[85dvh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom,24px)]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8EFE9] px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-[#1B2E24]">
            {isEdit ? 'עריכת איש קשר' : 'איש קשר חדש'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-[#6B7B73]" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">
              שם <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="שם מלא"
              className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 min-h-[48px]"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">
              טלפון <span className="text-red-500">*</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              dir="ltr"
              placeholder="05XXXXXXXX"
              className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 text-start"
            />
            {errors.phone && (
              <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Tags (chips) */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">תגיות</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] text-xs font-medium rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 transition-colors"
                    aria-label={`הסר ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="הוסף תגית..."
                className="flex-1 px-3 py-2 border border-[#E8EFE9] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 min-h-[48px]"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 border border-[#E8EFE9] rounded-xl text-[#6B7B73] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 transition-colors min-h-[48px] min-w-[44px]"
                aria-label="הוסף תגית"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">הערות</label>
            <textarea
              {...register('notes')}
              rows={3}
              maxLength={1000}
              placeholder="הערות נוספות..."
              className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 resize-none"
            />
            {errors.notes && (
              <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                שומר...
              </>
            ) : isEdit ? (
              'שמור שינויים'
            ) : (
              'צור איש קשר'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

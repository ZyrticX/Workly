'use client'

import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="min-h-full space-y-6">
      <Link href="/" className="flex items-center gap-1 text-sm text-[#5A6E62] hover:text-[#1B2E24] transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        חזרה
      </Link>
      <h1 className="text-xl font-bold text-[#1B2E24]">דוחות</h1>
      <div className="glass-card shadow-ios rounded-2xl p-8 text-center space-y-4">
        <BarChart3 size={48} className="mx-auto text-[#8FA89A]" />
        <h2 className="text-lg font-medium text-[#1B2E24]">דוחות חודשיים</h2>
        <p className="text-sm text-[#5A6E62]">
          הדוחות יהיו זמינים לאחר חודש פעילות ראשון
        </p>
      </div>
    </div>
  )
}

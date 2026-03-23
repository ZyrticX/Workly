import { Suspense } from 'react'
import { BottomNav } from '@/components/ui/bottom-nav'
import { Sidebar } from '@/components/ui/sidebar'
import { MobileHeader } from '@/components/ui/mobile-header'
import { ToastProvider } from '@/components/ui/toast'

function DashboardSkeleton() {
  return (
    <div className="flex-1 min-h-screen bg-mesh flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 text-[var(--color-primary)] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-[var(--color-text-muted)]">טוען...</span>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen overflow-x-hidden">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area */}
        <Suspense fallback={<DashboardSkeleton />}>
          <main className="flex-1 min-h-screen bg-mesh animate-page-in">
            {/* Mobile header with user menu */}
            <MobileHeader />

            <div
              className={
                'mx-auto max-w-lg px-4 py-6 pb-24 min-h-[calc(100dvh-3.5rem)] ' +
                'lg:max-w-full lg:px-8 lg:py-8 lg:pb-8 lg:min-h-screen'
              }
            >
              {children}
            </div>
          </main>
        </Suspense>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </ToastProvider>
  )
}

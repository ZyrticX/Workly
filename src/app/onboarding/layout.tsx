'use client'

import {
  OnboardingProvider,
  useOnboardingContext,
  STEP_LABELS,
} from '@/components/onboarding/onboarding-context'

function OnboardingProgressBar() {
  const { currentStep, totalSteps } = useOnboardingContext()

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Step label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text">
            {STEP_LABELS[currentStep - 1]}
          </span>
          <span className="text-sm text-text-muted">
            {currentStep} מתוך {totalSteps}
          </span>
        </div>

        {/* Progress track */}
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step dots - visible on desktop */}
        <div className="hidden md:flex items-center justify-between mt-3">
          {STEP_LABELS.map((label, index) => {
            const stepNum = index + 1
            const isCompleted = stepNum < currentStep
            const isCurrent = stepNum === currentStep

            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    isCompleted
                      ? 'bg-[var(--color-primary)] text-white'
                      : isCurrent
                        ? 'bg-[var(--color-primary-dark)] text-white'
                        : 'bg-border text-text-muted'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span className={`text-[10px] ${isCurrent ? 'text-text font-medium' : 'text-text-muted'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OnboardingFooter() {
  return (
    <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
      <button
        type="button"
        onClick={async () => {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.href = '/login'
        }}
        className="text-sm text-red-500 hover:text-red-600 transition-colors"
      >
        התנתק
      </button>
    </footer>
  )
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-surface flex flex-col" dir="rtl">
        <OnboardingProgressBar />
        <div className="flex-1 max-w-2xl mx-auto px-4 py-6 md:py-10 animate-page-in w-full">
          {children}
        </div>
        <OnboardingFooter />
      </div>
    </OnboardingProvider>
  )
}

'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface OnboardingContextType {
  currentStep: number
  setCurrentStep: (step: number) => void
  totalSteps: number
}

const OnboardingContext = createContext<OnboardingContextType>({
  currentStep: 1,
  setCurrentStep: () => {},
  totalSteps: 9,
})

export function useOnboardingContext() {
  return useContext(OnboardingContext)
}

const STEP_LABELS = [
  'ברוך הבא',
  'פרטי עסק',
  'שירותים',
  'שעות פעילות',
  'סגנון AI',
  'חיבור וואטסאפ',
  'בדיקה',
  'סיכום',
  'השקה!',
]

export { STEP_LABELS }

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [currentStep, setCurrentStep] = useState(1)

  return (
    <OnboardingContext.Provider value={{ currentStep, setCurrentStep, totalSteps: 9 }}>
      {children}
    </OnboardingContext.Provider>
  )
}

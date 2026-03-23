'use client'

import { useState, useEffect } from 'react'

export interface Service {
  id: string
  name: string
  duration: number
  price: number
}

// Service templates by business type
const SERVICE_TEMPLATES: Record<string, Service[]> = {
  'מספרה': [
    { id: '1', name: 'תספורת גברים', duration: 30, price: 60 },
    { id: '2', name: 'תספורת נשים', duration: 45, price: 120 },
    { id: '3', name: 'צבע שיער', duration: 90, price: 250 },
    { id: '4', name: 'החלקה', duration: 120, price: 400 },
    { id: '5', name: 'פן', duration: 30, price: 80 },
    { id: '6', name: 'תספורת ילדים', duration: 20, price: 45 },
  ],
  'קוסמטיקה': [
    { id: '1', name: 'טיפול פנים בסיסי', duration: 60, price: 200 },
    { id: '2', name: 'טיפול פנים מתקדם', duration: 90, price: 350 },
    { id: '3', name: 'פילינג', duration: 45, price: 180 },
    { id: '4', name: 'שעווה - פנים', duration: 15, price: 40 },
    { id: '5', name: 'שעווה - רגליים', duration: 30, price: 80 },
    { id: '6', name: 'עיצוב גבות', duration: 20, price: 50 },
  ],
  'ציפורניים': [
    { id: '1', name: 'מניקור', duration: 45, price: 80 },
    { id: '2', name: 'פדיקור', duration: 60, price: 100 },
    { id: '3', name: 'ג\'ל', duration: 60, price: 150 },
    { id: '4', name: 'אקריל', duration: 90, price: 200 },
    { id: '5', name: 'הסרת ג\'ל', duration: 30, price: 50 },
    { id: '6', name: 'מניקור + פדיקור', duration: 90, price: 160 },
  ],
  'מאמן אישי': [
    { id: '1', name: 'אימון אישי', duration: 60, price: 200 },
    { id: '2', name: 'אימון זוגי', duration: 60, price: 300 },
    { id: '3', name: 'תוכנית אימונים', duration: 45, price: 150 },
    { id: '4', name: 'ייעוץ תזונה', duration: 45, price: 180 },
  ],
  'בריאות': [
    { id: '1', name: 'ייעוץ ראשוני', duration: 60, price: 300 },
    { id: '2', name: 'טיפול המשך', duration: 45, price: 200 },
    { id: '3', name: 'עיסוי רפואי', duration: 60, price: 250 },
  ],
  'default': [
    { id: '1', name: 'שירות 1', duration: 30, price: 100 },
    { id: '2', name: 'שירות 2', duration: 60, price: 200 },
  ],
}

interface StepServicesProps {
  businessType: string
  initialServices?: Service[]
  onChange: (services: Service[]) => void
}

export default function StepServices({ businessType, initialServices, onChange }: StepServicesProps) {
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    if (initialServices && initialServices.length > 0) {
      setServices(initialServices)
    } else {
      const template = SERVICE_TEMPLATES[businessType] || SERVICE_TEMPLATES['default']
      setServices(template)
    }
  }, [businessType, initialServices])

  const updateService = (id: string, field: keyof Service, value: string | number) => {
    const updated = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    )
    setServices(updated)
    onChange(updated)
  }

  const addService = () => {
    const newService: Service = {
      id: Date.now().toString(),
      name: '',
      duration: 30,
      price: 0,
    }
    const updated = [...services, newService]
    setServices(updated)
    onChange(updated)
  }

  const removeService = (id: string) => {
    const updated = services.filter((s) => s.id !== id)
    setServices(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text">השירותים שלך</h3>
        <span className="text-sm text-text-muted">{services.length} שירותים</span>
      </div>

      <p className="text-sm text-text-secondary">
        טענו עבורך תבנית התחלתית. ערוך, הוסף או הסר שירותים לפי הצורך.
      </p>

      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="bg-white border border-border rounded-[var(--radius-card)] p-4 space-y-3"
          >
            {/* Service name */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => updateService(service.id, 'name', e.target.value)}
                  placeholder="שם השירות"
                  className="w-full px-3 py-2 rounded-[var(--radius-badge)] border border-border bg-white text-text placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => removeService(service.id)}
                className="p-2 text-text-muted hover:text-danger hover:bg-danger-bg rounded-[var(--radius-badge)] transition-colors"
                aria-label="הסר שירות"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Duration + Price row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">משך (דקות)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={service.duration}
                  onChange={(e) => updateService(service.id, 'duration', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-[var(--radius-badge)] border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted">מחיר (₪)</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={service.price}
                  onChange={(e) => updateService(service.id, 'price', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-[var(--radius-badge)] border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add service button */}
      <button
        type="button"
        onClick={addService}
        className="w-full py-3 px-4 rounded-[var(--radius-button)] border-2 border-dashed border-border text-text-secondary font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        הוסף שירות
      </button>
    </div>
  )
}

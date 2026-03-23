import { CalendarView } from '@/components/calendar/calendar-view'

export const metadata = {
  title: 'יומן | WhatsApp AI Agent',
  description: 'ניהול תורים ופגישות',
}

export default function CalendarPage() {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1B2E24]">יומן תורים</h1>
      </div>
      <CalendarView initialDate={today} />
    </div>
  )
}

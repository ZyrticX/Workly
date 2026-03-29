'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [agreed, setAgreed] = useState(false)
  const [signed, setSigned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1B2E24'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    setIsDrawing(true)
    setSigned(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSigned(false)
  }

  async function handleSubmit() {
    if (!agreed || !signed) return
    setSaving(true)
    setError('')

    try {
      const signatureData = canvasRef.current?.toDataURL('image/png') || ''

      const res = await fetch('/api/tos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData }),
      })

      if (res.ok) {
        router.push('/')
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה באישור')
      }
    } catch {
      setError('שגיאה בשמירה')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1B2E24] text-white p-6 text-center">
          <h1 className="text-xl font-bold">תנאי שימוש — Workly</h1>
          <p className="text-sm text-white/70 mt-1">יש לקרוא ולאשר לפני השימוש במערכת</p>
        </div>

        {/* Terms Content */}
        <div className="p-6 max-h-[40vh] overflow-y-auto text-sm text-[#1B2E24] space-y-4 leading-relaxed border-b border-[#E8EFE9]">
          <h3 className="font-bold">1. תיאור השירות</h3>
          <p>המערכת מספקת מענה אוטומטי להודעות WhatsApp, ניהול שיחות ואוטומציות נוספות. השירות ניתן כפי שהוא (AS IS), ללא התחייבות לזמינות מלאה או ללא תקלות.</p>

          <h3 className="font-bold">2. אחריות והגבלת אחריות</h3>
          <p>המשתמש מסכים כי השימוש במערכת הוא באחריותו הבלעדית. החברה לא תהיה אחראית לכל נזק ישיר או עקיף, כולל אובדן לקוחות, הכנסות או טעויות במענה. בכל מקרה, האחריות של החברה לא תעלה על הסכום ששולם בפועל.</p>

          <h3 className="font-bold">3. שירותים חיצוניים</h3>
          <p>המערכת תלויה בשירותים חיצוניים (כגון WhatsApp). החברה אינה אחראית לחסימות, שינויים, תקלות או השבתות מצד גורמים אלו.</p>

          <h3 className="font-bold">4. שימוש אסור</h3>
          <p>אסור להשתמש במערכת לצורך שליחת ספאם, פעילות בלתי חוקית, הונאה או הטעיה. החברה רשאית לחסום משתמשים שיפרו תנאים אלו ללא הודעה מוקדמת.</p>

          <h3 className="font-bold">5. פרטיות</h3>
          <p>ייתכן והמערכת תשמור שיחות לצורך שיפור השירות. המשתמש אחראי לעמידה בחוקי פרטיות מול לקוחותיו.</p>

          <h3 className="font-bold">6. זמינות השירות</h3>
          <p>החברה אינה מתחייבת לזמינות רציפה של השירות, וייתכנו תקלות או הפסקות.</p>

          <h3 className="font-bold">7. הפסקת שירות</h3>
          <p>החברה רשאית להפסיק או להגביל גישה למערכת בכל עת, לפי שיקול דעתה.</p>

          <h3 className="font-bold">8. קניין רוחני</h3>
          <p>כל הזכויות במערכת שייכות לחברה בלבד. אין להעתיק, לשכפל או להפיץ את המערכת.</p>

          <h3 className="font-bold">9. שינויים בתנאים</h3>
          <p>החברה רשאית לעדכן תנאים אלו בכל עת. המשך שימוש מהווה הסכמה לתנאים המעודכנים.</p>

          <h3 className="font-bold">10. דין וסמכות שיפוט</h3>
          <p>התנאים כפופים לחוקי מדינת ישראל. סמכות השיפוט הבלעדית תהיה בבתי המשפט בישראל.</p>
        </div>

        {/* Signature Area */}
        <div className="p-6 space-y-4">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm text-[#1B2E24]">
              קראתי והסכמתי לכל תנאי השימוש המפורטים למעלה
            </span>
          </label>

          {/* Signature Canvas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#1B2E24]">חתימה דיגיטלית</label>
              {signed && (
                <button onClick={clearSignature} className="text-xs text-red-500 hover:text-red-700">
                  נקה חתימה
                </button>
              )}
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-24 border-2 border-dashed border-[#E8EFE9] rounded-xl bg-gray-50 cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!signed && <p className="text-xs text-[#8FA89A] mt-1">חתום כאן עם העכבר או האצבע</p>}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!agreed || !signed || saving}
            className="w-full py-3 btn-primary text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'שומר...' : 'אני מסכים/ה — אישור וחתימה'}
          </button>
        </div>
      </div>
    </div>
  )
}

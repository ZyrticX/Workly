import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Workly — הסוכן החכם שלך בוואטסאפ',
  description: 'מערכת AI לניהול עסק דרך WhatsApp. קובעת תורים, עונה ללקוחות, מנהלת יומן — 24/7.',
  openGraph: {
    title: 'Workly — הסוכן החכם שלך בוואטסאפ',
    description: 'מערכת AI לניהול עסק דרך WhatsApp. קובעת תורים, עונה ללקוחות, מנהלת יומן — 24/7.',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Workly" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold text-gray-900">Workly</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition">יתרונות</a>
            <a href="#how" className="hover:text-gray-900 transition">איך זה עובד</a>
            <a href="#pricing" className="hover:text-gray-900 transition">מחירים</a>
          </div>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:bg-[#128C7E] transition-all hover:shadow-lg hover:shadow-[#25D366]/20"
          >
            כניסה למערכת
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#25D366]/10 text-[#128C7E] text-sm font-medium px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse" />
            פועל 24/7 בלי הפסקה
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-tight mb-6">
            הסוכן החכם
            <br />
            <span className="bg-gradient-to-l from-[#25D366] to-[#128C7E] bg-clip-text text-transparent">
              שלך בוואטסאפ
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Workly מציב סוכן AI על מספר ה-WhatsApp של העסק שלך.
            הוא עונה ללקוחות, קובע תורים, מנהל יומן ומוכר שירותים —
            <strong className="text-gray-700"> בזמן שאתה עובד.</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-[#25D366] text-white text-lg font-bold rounded-2xl hover:bg-[#128C7E] transition-all hover:shadow-xl hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
            >
              התחל בחינם →
            </Link>
            <a
              href="#how"
              className="px-8 py-4 bg-gray-50 text-gray-700 text-lg font-medium rounded-2xl hover:bg-gray-100 transition-all border border-gray-200"
            >
              איך זה עובד?
            </a>
          </div>

          <p className="text-xs text-gray-400 mt-4">בלי כרטיס אשראי · הגדרה ב-5 דקות · ביטול בכל עת</p>
        </div>
      </section>

      {/* ── Chat Preview ── */}
      <section className="pb-20 px-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-[#E5DDD5] rounded-3xl p-6 shadow-2xl shadow-gray-200/50 space-y-3">
            {/* Incoming */}
            <div className="flex justify-end">
              <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                <p className="text-sm text-gray-800">היי, רוצה לקבוע תור לתספורת מחר</p>
                <p className="text-[10px] text-gray-400 mt-1 text-left">09:14</p>
              </div>
            </div>

            {/* Bot response */}
            <div className="flex justify-start">
              <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                <p className="text-sm text-gray-800">מה קורה אחי! 💈 מחר יש לי ב-10:00 או 14:30. מה מתאים?</p>
                <p className="text-[10px] text-gray-400 mt-1 text-left">09:14</p>
              </div>
            </div>

            {/* Incoming */}
            <div className="flex justify-end">
              <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                <p className="text-sm text-gray-800">10 מעולה</p>
                <p className="text-[10px] text-gray-400 mt-1 text-left">09:15</p>
              </div>
            </div>

            {/* Bot confirm */}
            <div className="flex justify-start">
              <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                <p className="text-sm text-gray-800">מסודר! תספורת מחר ב-10:00. נתראה מלך! 👑</p>
                <p className="text-[10px] text-gray-400 mt-1 text-left">09:15</p>
              </div>
            </div>

            <div className="text-center">
              <span className="text-xs text-gray-500 bg-white/60 px-3 py-1 rounded-full">✨ תור נקבע אוטומטית ביומן</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              הכל אוטומטי. הכל חכם.
            </h2>
            <p className="text-gray-500 text-lg">מה Workly עושה בשבילך כל יום</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '💬', title: 'מענה חכם 24/7', desc: 'עונה ללקוחות בוואטסאפ כמו בן אדם. מתאים סגנון לסוג העסק.' },
              { icon: '📅', title: 'קביעת תורים', desc: 'בודק זמינות ביומן, מציע שעות פנויות, וקובע תור — הכל אוטומטית.' },
              { icon: '🧠', title: 'AI שמכיר את העסק', desc: 'יודע את השירותים, המחירים, שעות העבודה. עונה על כל שאלה.' },
              { icon: '👥', title: 'ניהול לקוחות', desc: 'מזהה לקוחות חוזרים, זוכר שמות, מנהל CRM אוטומטי.' },
              { icon: '📊', title: 'דאשבורד חכם', desc: 'תורים, הכנסות, לקוחות חדשים, ביטולים — הכל במבט אחד.' },
              { icon: '🔔', title: 'תזכורות אוטומטיות', desc: 'שולח תזכורת בוואטסאפ שעה לפני כל תור. מפחית no-shows.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:shadow-gray-100/50 hover:-translate-y-1 transition-all duration-300">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              3 צעדים ואתה באוויר
            </h2>
            <p className="text-gray-500 text-lg">הגדרה פשוטה, תוצאות מיידיות</p>
          </div>

          <div className="space-y-12">
            {[
              { step: '01', title: 'נרשמים ומגדירים', desc: 'שם העסק, שירותים, מחירים, שעות עבודה. או שהAI שלנו שואל וממלא בשבילך.', color: 'bg-blue-500' },
              { step: '02', title: 'מחברים WhatsApp', desc: 'סורקים QR ב-30 שניות. לא צריך API מיוחד — עובד עם כל מספר רגיל.', color: 'bg-[#25D366]' },
              { step: '03', title: 'הסוכן עובד', desc: 'מהרגע הזה הסוכן עונה ללקוחות, קובע תורים, ומנהל את העסק. אתה רק עובד.', color: 'bg-purple-500' },
            ].map((s, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className={`${s.color} text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0`}>
                  {s.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-6 bg-[#1B2E24]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '24/7', label: 'זמינות' },
            { num: '< 3 שניות', label: 'זמן תגובה' },
            { num: '5 דקות', label: 'זמן הגדרה' },
            { num: '78%', label: 'פחות לקוחות שנוטשים' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-2xl md:text-3xl font-black text-[#25D366]">{s.num}</div>
              <div className="text-sm text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              מחירים פשוטים
            </h2>
            <p className="text-gray-500 text-lg">בלי התחייבות, בלי הפתעות</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter',
                price: '99',
                desc: 'לעסקים שמתחילים',
                features: ['סוכן AI בוואטסאפ', 'עד 200 הודעות/חודש', 'יומן + CRM', 'תזכורות אוטומטיות'],
                cta: 'התחל בחינם',
                popular: false,
              },
              {
                name: 'Pro',
                price: '199',
                desc: 'הכי פופולרי',
                features: ['הכל ב-Starter', 'ללא הגבלת הודעות', 'AI עסקי (BI Chat)', 'שדרוג AI מתקדם', 'תמיכה מועדפת'],
                cta: 'התחל עכשיו',
                popular: true,
              },
              {
                name: 'Business',
                price: '349',
                desc: 'לעסקים גדולים',
                features: ['הכל ב-Pro', 'מספר WhatsApp נוסף', 'API access', 'דוחות מתקדמים', 'מנהל חשבון אישי'],
                cta: 'צור קשר',
                popular: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`rounded-3xl p-8 border-2 transition-all ${
                  plan.popular
                    ? 'border-[#25D366] bg-[#25D366]/5 shadow-xl shadow-[#25D366]/10 scale-105'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1 rounded-full inline-block mb-4">
                    הכי פופולרי ⭐
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-900">₪{plan.price}</span>
                  <span className="text-sm text-gray-400">/חודש</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-[#25D366]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-[#25D366] text-white hover:bg-[#128C7E] hover:shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#1B2E24] to-[#0D1A12]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            מוכן שהעסק שלך יעבוד בשבילך?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            תוך 5 דקות יהיה לך סוכן AI שעונה ללקוחות, קובע תורים, ומנהל את הכל.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-4 bg-[#25D366] text-white text-lg font-bold rounded-2xl hover:bg-[#128C7E] transition-all hover:shadow-xl hover:shadow-[#25D366]/30 hover:-translate-y-1"
          >
            התחל בחינם עכשיו →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Workly" className="w-6 h-6 rounded" />
            <span className="font-bold text-gray-700">Workly</span>
            <span className="text-sm text-gray-400">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-700">תנאי שימוש</Link>
            <a href="mailto:info@workly.co.il" className="hover:text-gray-700">צור קשר</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

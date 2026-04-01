import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import {
  MessageCircle,
  CalendarCheck,
  Brain,
  Users,
  BarChart3,
  Bell,
  Check,
  ArrowLeft,
  Zap,
  Shield,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react'

const WHATSAPP_CONTACT = 'https://wa.me/972544961231?text=%D7%94%D7%99%D7%99%2C+%D7%90%D7%A0%D7%99+%D7%A8%D7%95%D7%A6%D7%94+%D7%9C%D7%A9%D7%9E%D7%95%D7%A2+%D7%A2%D7%9C+Workly'

export const metadata: Metadata = {
  title: 'Workly — העסק שלך עובד גם כשאתה לא',
  description:
    'הלקוחות שלך מקבלים מענה מיידי בוואטסאפ, תורים נקבעים אוטומטית, והיומן מתמלא — 24/7.',
  openGraph: {
    title: 'Workly — העסק שלך עובד גם כשאתה לא',
    description:
      'הלקוחות שלך מקבלים מענה מיידי בוואטסאפ, תורים נקבעים אוטומטית, והיומן מתמלא — 24/7.',
    url: 'https://auto-crm.org',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07070D] text-white overflow-x-hidden" dir="rtl">
      {/* ── Inline Keyframes ── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(0.9); }
          66% { transform: translate(25px, -25px) scale(1.05); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }
        .animate-gradient-shift { animation: gradient-shift 8s ease infinite; background-size: 200% 200%; }
        .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
        .animate-orb-1 { animation: orb-float-1 12s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-float-2 15s ease-in-out infinite; }
        .typing-dot-1 { animation: typing-dot 1.4s ease-in-out infinite; }
        .typing-dot-2 { animation: typing-dot 1.4s ease-in-out 0.2s infinite; }
        .typing-dot-3 { animation: typing-dot 1.4s ease-in-out 0.4s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-float,
          .animate-glow-pulse,
          .animate-gradient-shift,
          .animate-slide-up,
          .animate-orb-1,
          .animate-orb-2,
          .typing-dot-1,
          .typing-dot-2,
          .typing-dot-3 {
            animation: none !important;
          }
        }
      `}</style>

      {/* ── Floating Glass Navbar ── */}
      <nav className="fixed top-4 inset-x-4 z-50 mx-auto max-w-6xl">
        <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] rounded-2xl px-6 h-16 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Workly" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">Workly</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors duration-200 cursor-pointer">יתרונות</a>
            <a href="#how" className="hover:text-white transition-colors duration-200 cursor-pointer">איך זה עובד</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-200 cursor-pointer">מחירים</a>
          </div>
          <a
            href={WHATSAPP_CONTACT}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:bg-[#1eba58] transition-all duration-200 shadow-[0_0_20px_rgba(37,211,102,0.3)] hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] cursor-pointer"
          >
            דברו איתנו
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#25D366]/20 blur-[120px] animate-orb-1" />
          <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-[#128C7E]/15 blur-[100px] animate-orb-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.07] blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div className="text-center lg:text-right">
            <div className="inline-flex items-center gap-2 bg-white/[0.06] backdrop-blur-md border border-white/[0.08] text-[#25D366] text-sm font-medium px-4 py-2 rounded-full mb-8">
              <span className="w-2 h-2 bg-[#25D366] rounded-full animate-glow-pulse" />
              פועל עכשיו על עסקים בכל הארץ
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.15] mb-6">
              העסק שלך
              <br />
              <span className="bg-gradient-to-l from-[#25D366] via-emerald-400 to-[#128C7E] bg-clip-text text-transparent animate-gradient-shift">
                לא ישן לעולם
              </span>
            </h1>

            <p className="text-base md:text-lg text-white/50 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              הלקוחות שלך שולחים הודעה בוואטסאפ — ומקבלים מענה תוך שניות.
              תורים נקבעים, היומן מתמלא, תזכורות יוצאות.
              <span className="text-white/70 font-medium"> אתה פשוט עובד.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href={WHATSAPP_CONTACT}
                target="_blank"
                rel="noopener noreferrer"
                className="group px-8 py-4 bg-[#25D366] text-white text-lg font-bold rounded-2xl hover:bg-[#1eba58] transition-all duration-300 shadow-[0_0_30px_rgba(37,211,102,0.3)] hover:shadow-[0_0_50px_rgba(37,211,102,0.5)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                דברו איתנו
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
              </a>
              <a
                href="#how"
                className="px-8 py-4 bg-white/[0.04] text-white/80 text-lg font-medium rounded-2xl hover:bg-white/[0.08] transition-all duration-200 border border-white/[0.08] hover:border-white/[0.15] cursor-pointer text-center"
              >
                איך זה עובד?
              </a>
            </div>

            <p className="text-xs text-white/25 mt-5">
              הגדרה ב-5 דקות&ensp;·&ensp;24/7 זמינות&ensp;·&ensp;ביטול בכל עת
            </p>
          </div>

          {/* Phone Mockup with Chat */}
          <div className="flex justify-center lg:justify-start animate-float">
            <div className="relative w-[300px] md:w-[340px]">
              {/* Phone Frame */}
              <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-[2.5rem] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
                {/* Screen */}
                <div className="bg-[#0B141A] rounded-[2rem] overflow-hidden">
                  {/* WhatsApp Header */}
                  <div className="bg-[#1F2C34] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Workly</div>
                      <div className="text-[10px] text-[#25D366]">online</div>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="p-3 space-y-2.5 min-h-[280px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0ibTAgMCAxMCAxME0yMCAwbDEwIDEwTTAgMjBsMTAgMTBNMjAgMjBsMTAgMTAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2EpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')]">
                    {/* Customer message */}
                    <div className="flex justify-end">
                      <div className="bg-[#005C4B] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                        <p className="text-[13px] text-white/90">היי, רוצה לקבוע תור לתספורת מחר</p>
                        <p className="text-[9px] text-white/30 mt-0.5 text-left">09:14</p>
                      </div>
                    </div>

                    {/* Workly response */}
                    <div className="flex justify-start">
                      <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                        <p className="text-[13px] text-white/90">אהלן! מחר יש ב-10:00 או 14:30 — מה מתאים לך?</p>
                        <p className="text-[9px] text-white/30 mt-0.5 text-left">09:14</p>
                      </div>
                    </div>

                    {/* Customer reply */}
                    <div className="flex justify-end">
                      <div className="bg-[#005C4B] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                        <p className="text-[13px] text-white/90">10 מעולה</p>
                        <p className="text-[9px] text-white/30 mt-0.5 text-left">09:15</p>
                      </div>
                    </div>

                    {/* Workly confirm */}
                    <div className="flex justify-start">
                      <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                        <p className="text-[13px] text-white/90">מעולה! תספורת מחר ב-10:00 בבוקר. נרשמת ביומן, נתראה!</p>
                        <p className="text-[9px] text-white/30 mt-0.5 text-left">09:15</p>
                      </div>
                    </div>

                    {/* Typing indicator */}
                    <div className="flex justify-start">
                      <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm px-3 py-2.5">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot-1" />
                          <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot-2" />
                          <span className="w-1.5 h-1.5 bg-white/40 rounded-full typing-dot-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white/[0.08] backdrop-blur-xl border border-white/[0.1] rounded-full px-5 py-2.5 flex items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] whitespace-nowrap">
                <CalendarCheck className="w-4 h-4 text-[#25D366]" />
                <span className="text-xs font-medium text-white/80">תור נקבע אוטומטית</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <ChevronDown className="w-5 h-5 text-white/20" />
        </div>
      </section>

      {/* ── Social Proof / Stats ── */}
      <section className="relative py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '24/7', label: 'זמינות מלאה', icon: Clock },
              { value: '< 3 שניות', label: 'זמן תגובה', icon: Zap },
              { value: '5 דקות', label: 'זמן הגדרה', icon: Sparkles },
              { value: '78%', label: 'פחות לקוחות שנוטשים', icon: Shield },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-300 cursor-default group"
              >
                <stat.icon className="w-5 h-5 text-[#25D366]/60 mx-auto mb-3 group-hover:text-[#25D366] transition-colors duration-300" />
                <div className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-xs text-white/35 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features — Bento Grid ── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              הכל קורה{' '}
              <span className="bg-gradient-to-l from-[#25D366] to-emerald-400 bg-clip-text text-transparent">
                אוטומטית
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mx-auto">
              מהרגע שלקוח שולח הודעה — הכל מתנהל. בלי שתצטרך לגעת.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Large card — spans 2 cols on lg */}
            <div className="lg:col-span-2 bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                <MessageCircle className="w-6 h-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold mb-2">שיחה טבעית בוואטסאפ</h3>
              <p className="text-white/40 leading-relaxed max-w-md">
                הלקוחות מרגישים שהם מדברים עם מישהו מהצוות. Workly מתאים את השפה, הטון והסגנון לעסק שלך — כמו עובד שמכיר את העסק על בוריו.
              </p>
            </div>

            {/* Regular card */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                <CalendarCheck className="w-6 h-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold mb-2">תורים נקבעים לבד</h3>
              <p className="text-white/40 leading-relaxed">
                בדיקת זמינות, הצעת שעות, אישור וכניסה ליומן — הכל בשיחה אחת.
              </p>
            </div>

            {/* Regular card */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                <Brain className="w-6 h-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold mb-2">מכיר את העסק שלך</h3>
              <p className="text-white/40 leading-relaxed">
                שירותים, מחירים, שעות פעילות, מדיניות ביטולים — Workly יודע הכל ועונה במקומך.
              </p>
            </div>

            {/* Regular card */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                <Users className="w-6 h-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold mb-2">זוכר כל לקוח</h3>
              <p className="text-white/40 leading-relaxed">
                לקוח חוזר? Workly מזהה אותו, זוכר את השם וההיסטוריה, ומתייחס אליו אישית.
              </p>
            </div>

            {/* Large card — spans 2 cols on lg */}
            <div className="lg:col-span-2 bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group lg:flex lg:items-start lg:gap-8">
              <div className="shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 lg:mb-0 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                  <BarChart3 className="w-6 h-6 text-[#25D366]" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">דאשבורד עם תמונה מלאה</h3>
                <p className="text-white/40 leading-relaxed max-w-md">
                  תורים היום, הכנסות החודש, לקוחות חדשים, ביטולים — הכל במבט אחד. בלי לפתוח אקסל.
                </p>
              </div>
            </div>

            {/* Regular card */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-5 group-hover:bg-[#25D366]/20 transition-colors duration-300">
                <Bell className="w-6 h-6 text-[#25D366]" />
              </div>
              <h3 className="text-xl font-bold mb-2">תזכורות שמגיעות לבד</h3>
              <p className="text-white/40 leading-relaxed">
                שעה לפני כל תור, הלקוח מקבל תזכורת בוואטסאפ. פחות no-shows, יותר הכנסות.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="py-20 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#25D366]/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              שלושה צעדים.{' '}
              <span className="bg-gradient-to-l from-[#25D366] to-emerald-400 bg-clip-text text-transparent">
                זהו.
              </span>
            </h2>
            <p className="text-white/40 text-lg">מהרגע שנרשמת — העסק שלך עובד אחרת</p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'ספר ל-Workly על העסק',
                desc: 'שם, שירותים, מחירים, שעות עבודה. או פשוט תדבר עם המערכת — והיא תמלא הכל בשבילך.',
              },
              {
                step: '02',
                title: 'חבר את הוואטסאפ',
                desc: 'סריקת QR אחת. 30 שניות. עובד עם כל מספר רגיל — בלי API מיוחד, בלי ציוד נוסף.',
              },
              {
                step: '03',
                title: 'הלקוחות מקבלים מענה',
                desc: 'מהרגע הזה כל הודעה מקבלת תגובה, תורים נקבעים, תזכורות יוצאות. אתה חופשי לעבוד.',
              },
            ].map((s, i) => (
              <div
                key={i}
                className="flex gap-6 items-start bg-white/[0.03] backdrop-blur-sm border border-white/[0.05] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-xl font-black shrink-0 shadow-[0_0_20px_rgba(37,211,102,0.2)]">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1.5">{s.title}</h3>
                  <p className="text-white/40 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              מחיר פשוט.{' '}
              <span className="bg-gradient-to-l from-[#25D366] to-emerald-400 bg-clip-text text-transparent">
                בלי הפתעות.
              </span>
            </h2>
            <p className="text-white/40 text-lg">בלי התחייבות, בלי עלויות נסתרות</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Starter',
                price: '99',
                desc: 'לעסקים שמתחילים',
                features: [
                  'מענה אוטומטי בוואטסאפ',
                  'עד 200 הודעות/חודש',
                  'יומן + ניהול לקוחות',
                  'תזכורות אוטומטיות',
                ],
                cta: 'דברו איתנו',
                popular: false,
              },
              {
                name: 'Pro',
                price: '199',
                desc: 'הכי פופולרי',
                features: [
                  'הכל ב-Starter',
                  'ללא הגבלת הודעות',
                  'BI Chat — תשאל את העסק שאלות',
                  'התאמת שפה וסגנון מתקדמת',
                  'תמיכה מועדפת',
                ],
                cta: 'בואו נתחיל',
                popular: true,
              },
              {
                name: 'Business',
                price: '349',
                desc: 'לעסקים שגדלים',
                features: [
                  'הכל ב-Pro',
                  'מספר WhatsApp נוסף',
                  'גישת API',
                  'דוחות מתקדמים',
                  'מנהל חשבון אישי',
                ],
                cta: 'צור קשר',
                popular: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-3xl p-8 transition-all duration-300 ${
                  plan.popular
                    ? 'bg-white/[0.07] border-2 border-[#25D366]/40 shadow-[0_0_40px_rgba(37,211,102,0.12)]'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-gradient-to-r from-[#25D366] to-emerald-400 text-white px-4 py-1 rounded-full shadow-[0_0_15px_rgba(37,211,102,0.3)]">
                    הכי פופולרי
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-white/35 mb-5">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black">{plan.price}&#8362;</span>
                  <span className="text-sm text-white/30 mr-1">/חודש</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-white/55">
                      <Check className="w-4 h-4 text-[#25D366] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={WHATSAPP_CONTACT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block w-full text-center py-3.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                    plan.popular
                      ? 'bg-[#25D366] text-white hover:bg-[#1eba58] shadow-[0_0_20px_rgba(37,211,102,0.25)] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)]'
                      : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#25D366]/[0.06] blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">
            מוכן שהעסק שלך
            <br />
            <span className="bg-gradient-to-l from-[#25D366] via-emerald-400 to-[#128C7E] bg-clip-text text-transparent animate-gradient-shift">
              יעבוד בשבילך?
            </span>
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
            תוך 5 דקות הלקוחות שלך מקבלים מענה מיידי, תורים נקבעים, והיומן מתמלא. בלי שתרים אצבע.
          </p>
          <a
            href={WHATSAPP_CONTACT}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-10 py-5 bg-[#25D366] text-white text-xl font-bold rounded-2xl hover:bg-[#1eba58] transition-all duration-300 shadow-[0_0_40px_rgba(37,211,102,0.3)] hover:shadow-[0_0_60px_rgba(37,211,102,0.5)] hover:-translate-y-1 cursor-pointer"
          >
            דברו איתנו
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform duration-200" />
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Workly" width={24} height={24} className="rounded" />
            <span className="font-bold text-white/60">Workly</span>
            <span className="text-sm text-white/20">&#169; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/terms" className="hover:text-white/60 transition-colors duration-200 cursor-pointer">
              תנאי שימוש
            </Link>
            <a href="mailto:info@auto-crm.org" className="hover:text-white/60 transition-colors duration-200 cursor-pointer">
              צור קשר
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

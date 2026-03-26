'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard,
  Building2,
  Users,
  Smartphone,
  HeartPulse,
  CreditCard,
  Wallet,
  FileText,
  MessageSquareMore,
  LogOut,
} from 'lucide-react'

const navItems = [
  { label: 'ראשי', href: '/admin', icon: LayoutDashboard },
  { label: 'עסקים', href: '/admin/businesses', icon: Building2 },
  { label: 'משתמשים', href: '/admin/users', icon: Users },
  { label: 'מספרים', href: '/admin/phones', icon: Smartphone },
  { label: 'בריאות', href: '/admin/health', icon: HeartPulse },
  { label: 'סימים', href: '/admin/sims', icon: CreditCard },
  { label: 'חיובים', href: '/admin/billing', icon: Wallet },
  { label: 'לוגים', href: '/admin/logs', icon: FileText },
  { label: 'טיקטים', href: '/admin/tickets', icon: MessageSquareMore },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/admin-login'
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-lg">⚡</div>
          <div>
            <p className="text-sm font-bold leading-tight">Workly Admin</p>
            <p className="text-[11px] text-white/50">פאנל ניהול ראשי</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
              isActive(item.href)
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>התנתק</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 start-0 h-screen w-60 bg-[#1B2E24] text-white flex-col z-40">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#1B2E24] text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <span className="text-sm font-bold">Workly Admin</span>
          <div className="w-10" /> {/* spacer */}
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile Drawer - slides in from the right in RTL */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 right-0 h-screen w-72 bg-[#1B2E24] text-white flex flex-col z-50 shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  )
}

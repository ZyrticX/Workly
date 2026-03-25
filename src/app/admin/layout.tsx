import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

const ALLOWED_ADMIN_EMAILS = [
  'smartmindsai31@gmail.com',
  'evgeniy.orel@open-israel.co.il',
  'test@admin.com',
  'workly@admin.com',
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin-login')
  }

  if (!user.email || !ALLOWED_ADMIN_EMAILS.includes(user.email)) {
    redirect('/admin-login')
  }

  return (
    <div className="min-h-screen bg-[#F7FAF8]" dir="rtl">
      <AdminSidebar />
      <div className="lg:me-60">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#E8EFE9]">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#1B2E24]">פאנל ניהול</h1>
            <span className="text-xs text-[#8FA89A]">{user.email}</span>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

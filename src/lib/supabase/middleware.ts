import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that don't require auth
const PUBLIC_PATHS = ['/login', '/register', '/api/webhooks', '/api/cron', '/admin-login', '/landing']

// Paths that skip onboarding check
const SKIP_ONBOARDING_CHECK = ['/onboarding', '/api/', '/login', '/register', '/admin', '/terms']

// Admin-only emails (pure admin users without a business)
const ADMIN_ONLY_EMAILS = ['workly@admin.com', 'test@admin.com']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Not logged in → redirect to login (except public paths)
  if (!user && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Admin-only user on non-admin page → redirect to /admin
  if (user && user.email && ADMIN_ONLY_EMAILS.includes(user.email) && !pathname.startsWith('/admin') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // 3. Logged in → check if onboarding is complete (except skip paths)
  if (user && !SKIP_ONBOARDING_CHECK.some(p => pathname.startsWith(p))) {
    try {
      const { data: bu } = await supabase
        .from('business_users')
        .select('business_id, businesses(status)')
        .eq('user_id', user.id)
        .single()

      // No business at all → send to onboarding (unless admin)
      if (!bu) {
        if (user.email && ADMIN_ONLY_EMAILS.includes(user.email)) {
          const url = request.nextUrl.clone()
          url.pathname = '/admin'
          return NextResponse.redirect(url)
        }
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      const bizStatus = (bu as Record<string, unknown>).businesses as { status: string } | null

      const { data: onboarding } = await supabase
        .from('onboarding_progress')
        .select('is_completed')
        .eq('business_id', bu.business_id)
        .single()

      // No onboarding record OR not completed OR business still in onboarding status → send to onboarding
      if (!onboarding || !onboarding.is_completed || bizStatus?.status === 'onboarding') {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      // 4. Check TOS acceptance (only for non-terms pages)
      if (!pathname.startsWith('/terms')) {
        const { data: tos } = await supabase
          .from('tos_acceptances')
          .select('id')
          .eq('user_id', user.id)
          .eq('tos_version', '1.0')
          .limit(1)
          .single()

        if (!tos) {
          const url = request.nextUrl.clone()
          url.pathname = '/terms'
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // If query fails, let user through (don't block on errors)
    }
  }

  return supabaseResponse
}

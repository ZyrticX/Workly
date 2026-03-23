import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', bu.business_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const unreadCount = (data || []).filter(n => !n.is_read).length

    return NextResponse.json({ notifications: data || [], unreadCount })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (ids && ids.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('business_id', bu.business_id)
        .in('id', ids)
    } else {
      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('business_id', bu.business_id)
        .eq('is_read', false)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

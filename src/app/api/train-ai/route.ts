import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - load current ai_advanced config
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
      .from('business_settings')
      .select('ai_advanced')
      .eq('business_id', bu.business_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ai_advanced: data?.ai_advanced || null })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

// POST - save ai_advanced config
export async function POST(request: NextRequest) {
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
    const { ai_advanced } = body

    if (!ai_advanced) {
      return NextResponse.json({ error: 'חסר מידע ai_advanced' }, { status: 400 })
    }

    const { error } = await supabase
      .from('business_settings')
      .upsert(
        {
          business_id: bu.business_id,
          ai_advanced,
        },
        { onConflict: 'business_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Invalidate Redis cache so bot picks up new AI config immediately
    try {
      const { invalidatePattern } = await import('@/lib/cache/redis')
      await invalidatePattern(`biz:${bu.business_id}:*`)
    } catch (cacheErr) {
      console.error('[train-ai] Cache invalidation failed:', cacheErr)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
